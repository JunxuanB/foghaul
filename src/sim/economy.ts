import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from '../config/items';
import { RECIPES, ROLE_BIOME } from '../config/recipes';
import { spawnNative } from './create';
import { addToStock, stockRoom } from './inventory';
import { say } from './log';
import { islandM, m } from './msg';
import { canDo, facilityRole, isHungry, residentsOf, roleOf, workersAt } from './people';
import { gainPersonXp, levelInfo, playerLevel } from './progression';
import { chance, rand } from './rng';
import type { GameState, Island, MealState } from './types';
import { stockAdd, stockGet } from './util';

const E = BALANCE.economy;

export function outputMult(state: GameState): number {
  return 1 + state.bureau.upgrades.output * BALANCE.endgame.upgrades.output.per;
}

export function peopleCap(isl: Island): number {
  if (isl.kind === 'home' || isl.kind === 'bureau' || isl.kind === 'recipeVillage' || isl.kind === 'laborVillage') return 99;
  return E.levels[isl.level - 1].people;
}

/** 当前每小时产能（批次或原料单位），以及说明（词典键 work.*） */
export function islandRate(state: GameState, isl: Island): { rate: number; working: number; note: string } {
  const fac = isl.facility;
  if (!fac || !isl.owned) return { rate: 0, working: 0, note: 'work.noFacility' };
  if (isl.sleepy) return { rate: 0, working: 0, note: 'work.sleepy' };
  const workers = workersAt(state, isl);
  if (!workers.length) return { rate: 0, working: 0, note: 'work.nobody' };
  const hungry = isl.lastMeal === 'none';
  const active = workers.filter((p) => p.type === 'passenger' || !hungry);
  if (!active.length) return { rate: 0, working: 0, note: 'work.starved' };

  const base = fac.kind === 'produce' ? E.produceRate[fac.item] ?? 1 : RECIPES[fac.recipe].batchesPerHour;
  const lvIdx = isl.lastMeal === 'partial' ? Math.max(0, isl.level - 2) : isl.level - 1;
  let mult = E.levels[lvIdx].mult * outputMult(state);
  // 加工建在绑定群系上
  if (fac.kind === 'process') {
    const role = RECIPES[fac.recipe].role;
    const b = role ? ROLE_BIOME[role] : null;
    if (b && isl.biome === b) mult *= 1 + E.biomeBonus;
  }
  // 乘客工种等级加成（该乘客断供时失效）
  const role = facilityRole(fac);
  const master = role ? roleOf(state, role) : undefined;
  if (master && master.active && !isHungry(state, master)) {
    const lv = levelInfo(master.xp, BALANCE.progression.passenger).level;
    mult *= 1 + (lv - 1) * BALANCE.progression.passengerBonusPerLevel;
  }
  let rate = 0;
  for (const p of active) {
    // 断供的乘客只保留基础产出
    const m = p.type === 'passenger' && hungry ? E.levels[0].mult : mult;
    rate += base * m;
  }
  const note = hungry ? 'work.baseOnly' : isl.lastMeal === 'partial' ? 'work.partial' : 'work.ok';
  return { rate, working: active.length, note };
}

/** 居民接下来若干小时需要的口粮（加工和外运不能动这部分） */
export function residentReserve(state: GameState, isl: Island, item: ItemId): number {
  const def = ITEMS[item];
  if (!def.drink && def.foodTier === undefined && item !== 'salt') return 0;
  const n = residentsOf(state, isl).length;
  if (!n) return 0;
  const meals = Math.ceil(E.residentReserveHours / 8);
  if (def.drink) return n * meals;
  if (item === 'salt') return isl.level >= 3 ? meals : 0;
  // 食物：为本级及以下档次的食物预留
  const tier = isl.kind === 'home' ? 1 : Math.min(3, isl.level);
  return (def.foodTier ?? 99) <= tier ? n * meals : 0;
}

/** 可以被加工或外运的数量 */
export function spareStock(state: GameState, isl: Island, item: ItemId, extraReserve = 0): number {
  return Math.max(0, stockGet(isl.stock, item) - residentReserve(state, isl, item) - extraReserve);
}

export function produce(state: GameState, minutes: number): void {
  for (const isl of state.islands) {
    if (!isl.owned || !isl.facility) continue;
    const { rate, note } = islandRate(state, isl);
    isl.workNote = note;
    if (rate <= 0) continue;
    isl.prodAcc += (rate * minutes) / 60;
    const fac = isl.facility;
    while (isl.prodAcc >= 1) {
      if (fac.kind === 'produce') {
        if (stockRoom(state, isl, fac.item) < 1) {
          isl.workNote = 'work.full';
          isl.prodAcc = 1;
          break;
        }
        addToStock(state, isl, fac.item, 1);
        recordProduced(state, fac.item, 1, true);
      } else {
        const r = RECIPES[fac.recipe];
        const ok = Object.entries(r.inputs).every(([k, v]) => spareStock(state, isl, k as ItemId) >= (v ?? 0));
        if (!ok) {
          isl.workNote = 'work.noInput';
          isl.prodAcc = 1;
          break;
        }
        const room = Object.entries(r.outputs).every(([k, v]) => stockRoom(state, isl, k as ItemId) >= (v ?? 0));
        if (!room) {
          isl.workNote = 'work.full';
          isl.prodAcc = 1;
          break;
        }
        for (const [k, v] of Object.entries(r.inputs)) stockAdd(isl.stock, k as ItemId, -(v ?? 0));
        for (const [k, v] of Object.entries(r.outputs)) {
          addToStock(state, isl, k as ItemId, v ?? 0);
          recordProduced(state, k as ItemId, v ?? 0, false);
        }
      }
      isl.prodAcc -= 1;
    }
  }
}

function recordProduced(state: GameState, item: ItemId, n: number, base: boolean): void {
  stockAdd(state.stats.produced, item, n);
  if (!base) return;
  // 生产型乘客按本工种全网累计产量获得经验
  for (const p of state.people) {
    if (!p.active || !p.role) continue;
    const b = ROLE_BIOME[p.role];
    if (b && canDo(p, { kind: 'produce', item })) gainPersonXp(state, p, n);
  }
}

// ---------------- 吃饭 ----------------

const FOOD_IDS: ItemId[] = ['fish', 'honeycomb', 'grilledFish', 'bread', 'sandwich', 'feast'];

function takeFood(isl: Island, tier: number): 'exact' | 'higher' | 'lower' | null {
  const byTier = (cmp: (t: number) => boolean) =>
    FOOD_IDS.filter((f) => cmp(ITEMS[f].foodTier ?? 0)).sort((a, b) => (ITEMS[a].foodTier ?? 0) - (ITEMS[b].foodTier ?? 0));
  const tries: [ItemId[], 'exact' | 'higher' | 'lower'][] = [
    [byTier((t) => t === tier), 'exact'],
    [byTier((t) => t > tier), 'higher'],
    [byTier((t) => t < tier).reverse(), 'lower'],
  ];
  for (const [list, kind] of tries) {
    for (const f of list) {
      if (stockGet(isl.stock, f) > 0) {
        stockAdd(isl.stock, f, -1);
        return kind;
      }
    }
  }
  return null;
}

export function meal(state: GameState): void {
  for (const isl of state.islands) mealAt(state, isl, true);
}

/** 断供的岛收到补给后马上吃一顿（不计入升级进度） */
export function relieve(state: GameState, isl: Island): void {
  if (isl.lastMeal !== 'none') return;
  const n = residentsOf(state, isl).length;
  if (!n) return;
  const water = stockGet(isl.stock, 'water') + stockGet(isl.stock, 'bottledWater');
  const food = FOOD_IDS.reduce((s, f) => s + stockGet(isl.stock, f), 0);
  if (water < n || food < n) return;
  mealAt(state, isl, false);
  if (isl.lastMeal !== 'none') say(state, 'log.relieved', { isl: islandM(isl.id) }, 'got');
}

function mealAt(state: GameState, isl: Island, scheduled: boolean): void {
  {
    const residents = residentsOf(state, isl);
    if (!residents.length || isl.kind === 'recipeVillage' || isl.kind === 'laborVillage' || isl.kind === 'bureau') {
      isl.lastMeal = null;
      isl.lastMealNote = '';
      return;
    }
    const n = residents.length;
    const tier = isl.kind === 'home' ? 1 : Math.min(3, isl.level);
    let waterShort = 0;
    for (let i = 0; i < n; i++) {
      if (stockGet(isl.stock, 'water') > 0) stockAdd(isl.stock, 'water', -1);
      else if (stockGet(isl.stock, 'bottledWater') > 0) stockAdd(isl.stock, 'bottledWater', -1);
      else waterShort++;
    }
    let foodShort = 0;
    let lower = 0;
    for (let i = 0; i < n; i++) {
      const r = takeFood(isl, tier);
      if (!r) foodShort++;
      else if (r === 'lower') lower++;
    }
    let saltShort = false;
    if (tier >= 3) {
      if (stockGet(isl.stock, 'salt') > 0) stockAdd(isl.stock, 'salt', -1);
      else saltShort = true;
    }
    const prev = isl.lastMeal;
    let st: MealState;
    let note = '';
    if (waterShort || foodShort) {
      st = 'none';
      note = waterShort && foodShort ? 'meal.noBoth' : waterShort ? 'meal.noWater' : 'meal.noFood';
    } else if (lower || saltShort) {
      st = 'partial';
      note = lower && saltShort ? 'meal.lowerSalt' : lower ? (tier === 2 ? 'meal.lower2' : 'meal.lower3') : 'meal.noSalt';
    } else {
      st = 'full';
    }
    isl.lastMeal = st;
    isl.lastMealNote = note;
    if (st === 'none' && prev !== 'none' && isl.owned) {
      const who = residents.some((p) => p.type === 'native') ? 'meal.nativesStop' : 'meal.passengersWeak';
      say(state, 'log.mealShort', { isl: islandM(isl.id), note: m(note), who: m(who) }, 'warn');
    }
    if (!scheduled) {
      if (st === 'none') isl.lastMeal = 'none';
      return;
    }
    if (st === 'full') {
      isl.mealStreak++;
      if (
        isl.mealStreak >= E.mealsToUpgrade &&
        isl.level < 3 &&
        (isl.kind === 'passenger' || isl.kind === 'native') &&
        isl.owned
      ) {
        isl.level++;
        isl.mealStreak = 0;
        say(state, 'log.islandUp', { isl: islandM(isl.id), lv: isl.level, next: m(isl.level === 2 ? 'levelup.want2' : 'levelup.want3') }, 'got');
      }
    } else {
      isl.mealStreak = 0;
    }
  }
}

// ---------------- 犯困与生育 ----------------

export function sleepyCheck(state: GameState): void {
  if (state.islands.some((i) => i.sleepy)) return;
  const lv = playerLevel(state, 'manage');
  const p = E.sleepyChancePerHour * Math.max(0.1, 1 - (lv - 1) * E.sleepyReducePerManageLevel);
  const candidates = state.islands.filter(
    (i) => i.owned && i.facility && workersAt(state, i).some((w) => w.type === 'native'),
  );
  for (const isl of candidates) {
    if (rand(state) < p) {
      isl.sleepy = true;
      say(state, 'log.sleepy', { isl: islandM(isl.id) }, 'warn');
      return;
    }
  }
}

export function births(state: GameState): void {
  for (const isl of state.islands) {
    if (!isl.owned || isl.level < 3 || isl.kind === 'home') continue;
    const n = residentsOf(state, isl).length;
    if (n === 0 || n >= peopleCap(isl)) continue;
    if (isl.lastMeal !== 'full') continue;
    if (!chance(state, E.birthChance)) continue;
    const baby = spawnNative(state, isl.id);
    if (isl.facility) baby.job = { ...isl.facility };
    say(state, 'log.birth', { isl: islandM(isl.id), name: baby.name }, 'got');
  }
}


