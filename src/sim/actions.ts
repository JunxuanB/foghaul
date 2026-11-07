import { BALANCE } from '../config/balance';
import { ITEMS, PART_IDS, type ItemId } from '../config/items';
import { BIOME_ITEM, RECIPES, ROLE_BIOME, type RecipeId } from '../config/recipes';
import { ENDING_LINES, FLIGHT_LINES } from '../config/text';
import { ISLANDS } from '../config/world';
import { advance } from './advance';
import { canSleepNow, untilMorning } from './clock';
import { peopleCap, relieve } from './economy';
import { bureauHourly, exportGoods, upgradeCost } from './endgame';
import {
  addToStock,
  canPay,
  carried,
  deliverNeeds,
  giveToPlayer,
  holdFree,
  missingCost,
  needsDone,
  packFree,
  pay,
  stockRoom,
  whereStock,
} from './inventory';
import { canEnter, lightCircle, lightCorridor, look } from './map';
import { checkReveals, lightFrom } from './reveal';
import { updateUnlocks } from './tutorial';
import { placeAtDock, positionError } from './interact';
import { fail, OK, say } from './log';
import { islandM, itemM, m, recipeM, roleM, stockP, type Msg } from './msg';
import { headcountOf, isHungry, presentPeople, sameJob, teachableJobs } from './people';
import { gainPlayerXp, learnRecipe, playerLevel } from './progression';
import { chance } from './rng';
import { onMove, takeCrate } from './seaEvents';
import { createRoute, deleteRoute, freeRafts, priorityUnlocked, reserveUnlocked, routeEndpoints, targetUnlocked } from './transport';
import type { Command, GameState, Island, Job, Result, Stock } from './types';
import { findIsland, island, islandAt, person, stockAdd, stockGet } from './util';
import { deliverVillage, resolveWaterDispute, villageOf } from './villages';

const H = BALANCE.home;
const A = BALANCE.actions;

export function here(state: GameState): Island | undefined {
  return findIsland(state, state.player.at);
}

/** 玩家可以直接使用这座岛的库存 */
export function canUseStock(isl: Island | undefined): isl is Island {
  return !!isl && isl.owned;
}

function needHere(state: GameState): Result | Island {
  const isl = here(state);
  if (!isl) return fail('err.notDocked');
  return isl;
}

function isResult(x: Result | Island): x is Result {
  return (x as Result).ok !== undefined;
}

// ---------------------------------------------------------------- 移动

function move(state: GameState, dx: number, dy: number): Result {
  const p = state.player;
  if (p.at) return fail('err.leaveFirst');
  if (!p.hasRaft) return fail('err.noRaft');
  const steps = p.twoStep && playerLevel(state, 'sail') >= BALANCE.progression.sailTwoStepLevel ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!canEnter(state, nx, ny)) {
      if (i === 0) return fail(nx < 0 || ny < 0 || nx >= state.width || ny >= state.height ? 'err.mapEdge' : 'err.fog');
      break;
    }
    p.x = nx;
    p.y = ny;
    state.pendingCrate = null;
    state.stats.moves++;
    for (const f of look(state)) say(state, 'log.discovered', { isl: islandM(f.id) }, 'got');
    gainPlayerXp(state, 'sail', 1);
    advance(state, BALANCE.time.moveMinutes);
    if (p.at) return OK; // 死亡重生了
    const arrived = islandAt(state, nx, ny);
    if (arrived && arrived.discovered) {
      say(state, 'log.arrived', { isl: islandM(arrived.id) });
      break;
    }
    if (onMove(state) && state.player.hp <= 0) break;
  }
  return OK;
}

function dock(state: GameState): Result {
  const p = state.player;
  if (p.at) return fail('err.alreadyDocked');
  const isl = islandAt(state, p.x, p.y);
  if (!isl || !isl.discovered) return fail('err.noIsland');
  p.at = isl.id;
  placeAtDock(state, isl.id);
  state.pendingCrate = null;
  if (!isl.visited) {
    isl.visited = true;
    say(state, 'island.' + isl.id + '.intro');
  }
  if (isl.kind === 'passenger' || isl.kind === 'islet' || isl.kind === 'native') {
    const t = ISLANDS.find((x) => x.id === isl.id)!;
    const need = t.rescueNeed ?? t.recruitNeed;
    if (need && !needsDone(need, isl.needProgress)) say(state, isl.kind === 'native' ? 'log.nativeWants' : 'log.passengerWants', 'hint');
  }
  return OK;
}

function leave(state: GameState): Result {
  const p = state.player;
  if (!p.at) return fail('err.atSea');
  if (!p.hasRaft) return fail('err.noRaft');
  p.at = null;
  return OK;
}

// ---------------------------------------------------------------- 海上求生

function drinkSea(state: GameState): Result {
  const d = BALANCE.survival.seaDrink;
  const p = state.player;
  p.water = Math.min(BALANCE.survival.maxWater, p.water + d.water);
  p.hp = Math.max(0, p.hp + d.hp);
  say(state, 'log.drinkSea', { water: d.water, hp: -d.hp });
  advance(state, d.minutes);
  return OK;
}

function fishSea(state: GameState): Result {
  const f = BALANCE.survival.seaFish;
  if (chance(state, f.successChance)) {
    const left = giveToPlayer(state, 'fish', 1);
    say(state, left ? 'log.fishSeaFull' : 'log.fishSea');
  } else if (chance(state, f.jellyChance / (1 - f.successChance))) {
    state.player.hp = Math.max(0, state.player.hp + f.jellyHp);
    say(state, 'log.jelly', { hp: -f.jellyHp });
  } else {
    say(state, 'log.fishMiss');
  }
  advance(state, f.minutes);
  return OK;
}

// ---------------------------------------------------------------- 主岛

function gather(state: GameState, what: 'branch' | 'chop' | 'shoreFish' | 'herb'): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'home') return fail('err.homeOnly');
  const lumber = state.people.find((x) => x.role === 'lumberjack')?.active;
  // 采集到的东西默认放进背包，满了放货舱，再满了放主岛仓库
  const give = (item: ItemId, n: number) => n - giveToPlayer(state, item, n, 'pack');
  if (what === 'branch' || what === 'chop') {
    const chop = what === 'chop';
    if (chop && !lumber) return fail('err.needLumberjack');
    const g = chop ? H.chop : H.branch;
    const k = give('wood', g.wood);
    say(state, k ? (chop ? 'log.chop' : 'log.branch') : 'log.stockFull', { n: k, item: itemM('wood') });
    advance(state, g.minutes);
  } else if (what === 'shoreFish') {
    if (chance(state, H.shoreFish.chance)) {
      const k = give('fish', 1);
      say(state, k ? 'log.shoreFish' : 'log.stockFull', { item: itemM('fish') });
    } else say(state, 'log.shoreFishMiss');
    advance(state, H.shoreFish.minutes);
  } else {
    if (state.flags.herbsLeft <= 0) return fail('err.noHerbs');
    const k = give('herb', 1);
    if (k) state.flags.herbsLeft--;
    say(state, 'log.herb', { left: state.flags.herbsLeft });
    advance(state, H.herb.minutes);
  }
  return OK;
}

function plant(state: GameState, plot: number): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'home') return fail('err.homeOnly');
  if (!state.people.find((x) => x.role === 'farmer')?.active) return fail('err.needFarmer');
  if (state.flags.farm[plot] !== null && state.flags.farm[plot] !== undefined) return fail('err.plotBusy');
  state.flags.farm[plot] = state.time;
  say(state, 'log.plant');
  advance(state, H.farm.plantMinutes);
  return OK;
}

export function plotReady(state: GameState, plot: number): boolean {
  const t = state.flags.farm[plot];
  return t !== null && t !== undefined && state.time - t >= H.farm.growMinutes;
}

function harvest(state: GameState, plot: number): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'home') return fail('err.homeOnly');
  if (!plotReady(state, plot)) return fail('err.notRipe');
  const k = H.farm.yield - giveToPlayer(state, 'wheat', H.farm.yield, 'pack');
  state.flags.farm[plot] = null;
  say(state, 'log.harvest', { n: k });
  advance(state, H.farm.plantMinutes);
  return OK;
}

// ---------------------------------------------------------------- 物品

/** 制作前的检查：返回 null 表示可以做，否则返回原因。原料从身上和（网络内的）岛上仓库一起扣。 */
export function craftBlock(state: GameState, recipe: RecipeId): Msg | null {
  const r = RECIPES[recipe];
  if (!state.player.recipes.includes(recipe) || r.noFacility) return m('err.unknownRecipe');
  if (r.special === 'raft' && state.player.hasRaft) return m('err.hasRaft');
  const isl = here(state);
  const src = canUseStock(isl) ? isl : undefined;
  const bulk = Object.keys(r.outputs).some((k) => !ITEMS[k as ItemId].portable);
  if (bulk && !src) return m('err.needOwnedIsland');
  if (!canPay(state, src, r.inputs as Stock)) return m('err.missing', { list: stockP(missingCost(state, src, r.inputs as Stock)) });
  if (bulk && src && Object.entries(r.outputs).some(([k, v]) => stockRoom(state, src, k as ItemId) < (v ?? 0))) return m('err.stockFull');
  const carry = Object.entries(r.outputs).reduce((n, [k, v]) => n + (ITEMS[k as ItemId].portable ? v ?? 0 : 0), 0);
  const freed = Object.values(r.inputs).reduce((n, v) => n + (v ?? 0), 0);
  const room = packFree(state) + holdFree(state) + freed + (src ? 99 : 0);
  if (carry > room) return m('err.noRoom');
  return null;
}

export function craftable(state: GameState, recipe: RecipeId): boolean {
  return craftBlock(state, recipe) === null;
}

/** 随时随地都能制作；散装产物（海水提炼的水）需要在网络内的岛上 */
function craft(state: GameState, recipe: RecipeId, times = 1): Result {
  const r = RECIPES[recipe];
  const first = craftBlock(state, recipe);
  if (first) return { ok: false, msg: first };
  const isl = here(state);
  const src = canUseStock(isl) ? isl : undefined;
  if (r.special === 'raft') {
    pay(state, src, r.inputs as Stock);
    state.player.hasRaft = true;
    say(state, 'log.raftBuilt', 'got');
    advance(state, r.manualMinutes);
    return OK;
  }
  let done = 0;
  const made: Stock = {};
  for (let i = 0; i < times; i++) {
    if (i > 0 && craftBlock(state, recipe)) break;
    pay(state, src, r.inputs as Stock);
    for (const [k, v] of Object.entries(r.outputs)) {
      const id = k as ItemId;
      // 能带走的产物放进背包（满了放货舱、再放岛上仓库），散装的水留在岛上仓库
      if (!ITEMS[id].portable && src) addToStock(state, src, id, v ?? 0);
      else giveToPlayer(state, id, v ?? 0, 'pack');
      stockAdd(made, id, v ?? 0);
    }
    done++;
  }
  const bulk = Object.keys(made).some((k) => !ITEMS[k as ItemId].portable);
  say(state, 'log.crafted', { made: stockP(made), where: bulk ? m('where.stock') : m('where.carried') });
  advance(state, r.manualMinutes * done);
  return OK;
}

function consume(state: GameState, from: 'pack' | 'hold' | 'stock', item: ItemId): Result {
  const def = ITEMS[item];
  if (!def.eat) return fail('err.inedible');
  if (from === 'stock' && !canUseStock(here(state))) return fail('err.cantUseStock');
  const s = whereStock(state, from);
  if (!s || stockGet(s, item) <= 0) return fail('err.noneLeft');
  stockAdd(s, item, -1);
  const p = state.player;
  const S = BALANCE.survival;
  const e = def.eat;
  if (e.hp) p.hp = Math.min(S.maxHp, p.hp + e.hp);
  if (e.water) p.water = Math.min(S.maxWater, p.water + e.water);
  if (e.food) p.food = Math.min(S.maxFood, p.food + e.food);
  say(state, 'log.consume.' + (def.verb ?? 'eat'), { item: itemM(item) });
  return OK;
}

function transfer(state: GameState, item: ItemId, from: 'pack' | 'hold' | 'stock', to: 'pack' | 'hold' | 'stock', n: number): Result {
  if (from === to) return OK;
  const def = ITEMS[item];
  const isl = here(state);
  if ((from === 'stock' || to === 'stock') && !canUseStock(isl)) return fail('err.cantUseStock');
  if (to !== 'stock' && !def.portable) return fail('err.notPortable', { item: itemM(item) });
  if (to === 'hold' && !state.player.hasRaft) return fail('err.noRaft');
  const src = whereStock(state, from);
  const dst = whereStock(state, to);
  if (!src || !dst) return fail('err.notDocked');
  let k = Math.min(n, stockGet(src, item));
  if (to === 'pack' && !def.key) k = Math.min(k, packFree(state));
  if (to === 'hold' && !def.key) k = Math.min(k, holdFree(state));
  if (to === 'stock' && isl) k = Math.min(k, stockRoom(state, isl, item));
  if (k <= 0) return fail(stockGet(src, item) <= 0 ? 'err.noneLeft' : 'err.noRoom');
  stockAdd(src, item, -k);
  stockAdd(dst, item, k);
  if (to === 'stock' && isl) relieve(state, isl);
  return OK;
}

// ---------------------------------------------------------------- 救援、招募、交付

function syncBasicRecipes(state: GameState): void {
  const pl = state.player;
  const eng = state.people.find((x) => x.role === 'engineer');
  if (pl.recipes.includes('cup') && pl.recipes.includes('distill') && !pl.recipes.includes('bottledWater')) {
    learnRecipe(state, 'bottledWater');
  }
  if (eng?.active && pl.recipes.includes('cup') && !eng.recipes.includes('bottledWater')) eng.recipes.push('bottledWater');
}

function rescue(state: GameState, isl: Island): void {
  const pass = state.people.find((x) => x.type === 'passenger' && x.loc.kind === 'island' && x.loc.id === isl.id && !x.active);
  if (!pass || !pass.role) return;
  pass.active = true;
  const role = pass.role;
  say(state, `rescue.${role}.thanks`);
  if (role !== 'pilot') {
    isl.owned = true;
    const b = ROLE_BIOME[role];
    if (b) isl.facility = { kind: 'produce', item: BIOME_ITEM[b] };
    for (const [k, v] of Object.entries(BALANCE.economy.rescueStartStock)) addToStock(state, isl, k as ItemId, v);
  }
  const learn = (r: RecipeId) => learnRecipe(state, r);
  if (role === 'engineer') learn('distill');
  if (role === 'lumberjack') {
    learn('cup');
    pass.recipes.push('cup');
  }
  if (role === 'doctor') {
    learn('medkit');
    pass.recipes.push('medkit');
  }
  syncBasicRecipes(state);
  say(state, `rescue.${role}.teach`, 'got');
}

function recruit(state: GameState, isl: Island): void {
  for (const p of state.people) if (p.type === 'native' && p.loc.kind === 'island' && p.loc.id === isl.id) p.active = true;
  isl.owned = true;
  say(state, 'log.recruited', { isl: islandM(isl.id) }, 'got');
}

function deliver(state: GameState): Result {
  const r = needHere(state);
  if (isResult(r)) return r;
  const isl = r;
  const vid = villageOf(isl);
  if (vid) {
    const res = deliverVillage(state, vid);
    if (res.ok) advance(state, A.deliverMinutes);
    return res;
  }
  const t = ISLANDS.find((x) => x.id === isl.id)!;
  const need = t.rescueNeed ?? t.recruitNeed;
  if (!need) return fail('err.nothingWanted');
  if (needsDone(need, isl.needProgress) && (isl.owned || t.kind === 'islet')) return fail('err.nothingWanted');
  const given = deliverNeeds(state, need, isl.needProgress);
  if (!Object.keys(given).length) return fail('err.nothingToGive');
  say(state, 'log.delivered', { to: islandM(isl.id), given: stockP(given) });
  if (needsDone(need, isl.needProgress)) {
    if (t.rescueNeed) rescue(state, isl);
    else recruit(state, isl);
  }
  advance(state, A.deliverMinutes);
  return OK;
}

// ---------------------------------------------------------------- 建设

export function buildCost(state: GameState, what: 'lighthouse' | 'bed' | 'depot' | 'helipad' | 'holdUpgrade'): Stock | null {
  if (what === 'holdUpgrade') {
    const c = H.holdUpgrade.woodCosts[state.player.holdUpgrades];
    return c === undefined ? null : { wood: c };
  }
  if (what === 'lighthouse') {
    const costs = BALANCE.buildings.lighthouse.costs;
    const built = state.islands.filter((i) => i.kind !== 'home' && i.buildings.lighthouse).length;
    return costs[Math.min(built, costs.length - 1)] as Stock;
  }
  return BALANCE.buildings[what].cost as Stock;
}

function build(state: GameState, what: 'lighthouse' | 'bed' | 'depot' | 'helipad' | 'holdUpgrade'): Result {
  const at = here(state);
  if (!at) return fail('err.notDocked');
  // 灯塔可以修在任何岛上（村落、礁石也行）；其他建筑只能修在网络内的岛
  if (what === 'lighthouse' && at.kind === 'bureau') return fail('err.cantBuildHere');
  if (what !== 'lighthouse' && !canUseStock(at)) return fail('err.needOwnedIsland');
  const isl = at;
  const src = canUseStock(isl) ? isl : undefined;
  const cost = buildCost(state, what);
  if (!cost) return fail('err.maxed');
  if (what === 'holdUpgrade') {
    if (isl.kind !== 'home') return fail('err.homeOnly');
    if (!state.player.hasRaft) return fail('err.noRaft');
  } else {
    if (isl.buildings[what]) return fail('err.built');
    if (what === 'helipad' && !state.flags.planeRepaired) return fail('err.needPlane');
  }
  if (!canPay(state, src, cost)) return fail('err.missing', { list: stockP(missingCost(state, src, cost)) });
  pay(state, src, cost);
  if (what === 'holdUpgrade') {
    state.player.holdUpgrades++;
    state.player.holdCap += H.holdUpgrade.step;
    say(state, 'log.holdUp', { cap: state.player.holdCap }, 'got');
    advance(state, 60);
    return OK;
  }
  isl.buildings[what] = true;
  if (what === 'lighthouse') lightFrom(state, isl);
  say(state, 'log.built.' + what, { isl: islandM(isl.id) }, 'got');
  advance(state, BALANCE.buildings[what].minutes);
  return OK;
}

function sleep(state: GameState): Result {
  const isl = here(state);
  if (!isl || !isl.buildings.bed) return fail('err.noBed');
  if (!canSleepNow(state.time)) return fail('err.tooEarly');
  const before = { ...state.stats.produced };
  advance(state, untilMorning(state.time), { sleeping: true });
  state.player.hp = Math.max(state.player.hp, BALANCE.survival.sleepHealTo);
  const diff: Stock = {};
  for (const [k, v] of Object.entries(state.stats.produced)) {
    const d = (v ?? 0) - (before[k as ItemId] ?? 0);
    if (d > 0) diff[k as ItemId] = d;
  }
  say(state, Object.keys(diff).length ? 'log.sleptProduced' : 'log.slept', { made: stockP(diff) });
  return OK;
}

function wait(state: GameState, minutes: number): Result {
  if (!state.player.at) return fail('err.notDocked');
  advance(state, Math.max(10, Math.min(240, minutes)));
  return OK;
}

function wake(state: GameState): Result {
  const isl = here(state);
  if (!isl || !isl.sleepy) return fail('err.notSleepy');
  isl.sleepy = false;
  say(state, 'log.woke', { isl: islandM(isl.id) });
  advance(state, A.wakeMinutes);
  return OK;
}

// ---------------------------------------------------------------- 人员

function pickUp(state: GameState, id: string): Result {
  const isl = here(state);
  if (!isl) return fail('err.notDocked');
  const p = person(state, id);
  if (!p.active || p.loc.kind !== 'island' || p.loc.id !== isl.id) return fail('err.notHere');
  if (p.learning) return fail('err.learning');
  if (!state.player.hasRaft) return fail('err.noRaft');
  if (state.player.aboard.length >= BALANCE.inventory.seats) return fail('err.seatsFull');
  p.loc = { kind: 'raft' };
  p.lastIsland = isl.id;
  state.player.aboard.push(p.id);
  say(state, 'log.pickUp', { who: p.name });
  return OK;
}

function dropOff(state: GameState, id: string): Result {
  const isl = here(state);
  if (!isl) return fail('err.notDocked');
  const p = person(state, id);
  if (p.loc.kind !== 'raft') return fail('err.notAboard');
  const allowed = isl.owned || isl.kind === 'recipeVillage' || isl.kind === 'laborVillage';
  if (!allowed) return fail('err.cantDropHere');
  if (headcountOf(state, isl) >= peopleCap(isl)) return fail('err.islandFull', { cap: peopleCap(isl) });
  p.loc = { kind: 'island', id: isl.id };
  p.lastIsland = isl.id;
  state.player.aboard = state.player.aboard.filter((x) => x !== id);
  say(state, 'log.dropOff', { who: p.name, isl: islandM(isl.id) });
  return OK;
}

export function trainCost(job: Job): Stock {
  const c = BALANCE.economy.trainCost;
  return { ...(job.kind === 'crew' ? c.crew : job.kind === 'produce' ? c.produce : c.process) } as Stock;
}

function train(state: GameState, id: string, trainerId: string, job: Job): Result {
  const isl = here(state);
  if (!canUseStock(isl)) return fail('err.needOwnedIsland');
  const native = person(state, id);
  if (native.type !== 'native' || !native.active) return fail('err.notNative');
  if (native.loc.kind !== 'island' || native.loc.id !== isl.id) return fail('err.notHere');
  const trainer = presentPeople(state).find((x) => x.id === trainerId);
  if (!trainer) return fail('err.trainerAbsent');
  if (isHungry(state, trainer)) return fail('err.trainerHungry', { who: trainer.name });
  if (!teachableJobs(trainer, isl).some((j) => sameJob(j, job))) return fail('err.cantTeach');
  if (sameJob(native.job, job)) return fail('err.sameJob');
  const cost = trainCost(job);
  if (!canPay(state, isl, cost)) return fail('err.missing', { list: stockP(missingCost(state, isl, cost)) });
  pay(state, isl, cost);
  const was = native.job;
  native.job = job;
  if (job.kind !== 'crew') {
    isl.facility = { ...job };
    isl.prodAcc = 0;
  }
  state.flags.firstTraining = true;
  say(state, was ? 'log.retrained' : 'log.trained', { who: native.name, job: jobKey(job) }, 'got');
  gainPlayerXp(state, 'manage', 1);
  advance(state, A.trainMinutes);
  return OK;
}

function jobKey(job: Job) {
  if (job.kind === 'crew') return m('job.crew');
  if (job.kind === 'produce') return m('job.produce', { item: itemM(job.item) });
  return m('job.process', { recipe: recipeM(job.recipe) });
}

function learn(state: GameState, id: string, recipe: RecipeId): Result {
  const isl = here(state);
  const vid = isl ? villageOf(isl) : null;
  if (!isl || !vid) return fail('err.villageOnly');
  const v = state.villages[vid];
  if (!v.pendingRecipes.includes(recipe)) return fail('err.notOffered');
  const p = presentPeople(state).find((x) => x.id === id);
  if (!p || p.role !== RECIPES[recipe].role) return fail('err.wrongStudent', { role: roleM(RECIPES[recipe].role ?? 'pilot') });
  if (p.learning) return fail('err.learning');
  if (p.loc.kind === 'raft') {
    state.player.aboard = state.player.aboard.filter((x) => x !== p.id);
    p.loc = { kind: 'island', id: isl.id };
  }
  p.lastIsland = isl.id;
  p.learning = { recipe, until: state.time + A.learnMinutes, village: vid };
  say(state, 'log.learnStart', { who: p.name, recipe: recipeM(recipe), h: A.learnMinutes / 60 });
  return OK;
}

// ---------------------------------------------------------------- 运输

function buildTransportRaft(state: GameState): Result {
  const isl = here(state);
  if (!canUseStock(isl)) return fail('err.needOwnedIsland');
  const eng = presentPeople(state).find((x) => x.role === 'engineer');
  if (!eng) return fail('err.needEngineer');
  if (!eng.recipes.includes('transportRaft')) return fail('err.engineerCantRaft');
  const cost = RECIPES.transportRaft.inputs as Stock;
  if (!canPay(state, isl, cost)) return fail('err.missing', { list: stockP(missingCost(state, isl, cost)) });
  pay(state, isl, cost);
  state.transport.rafts++;
  say(state, 'log.transportRaft', { n: state.transport.rafts }, 'got');
  advance(state, RECIPES.transportRaft.manualMinutes);
  return OK;
}

function newRoute(state: GameState, a: string, b: string, cargoAB: ItemId | null, cargoBA: ItemId | null, crewId: string): Result {
  if (a === b) return fail('err.sameEnds');
  const ends = routeEndpoints(state).map((i) => i.id);
  if (!ends.includes(a) || !ends.includes(b)) return fail('err.badEnds');
  if (freeRafts(state) <= 0) return fail('err.noFreeRaft');
  const crew = state.people.find((x) => x.id === crewId);
  if (!crew || crew.job?.kind !== 'crew' || crew.loc.kind !== 'island' || !crew.active) return fail('err.noCrew');
  for (const c of [cargoAB, cargoBA]) if (c && (!ITEMS[c].portable || ITEMS[c].key)) return fail('err.notPortable', { item: itemM(c) });
  const r = createRoute(state, a, b, cargoAB, cargoBA, crewId);
  say(state, 'log.routeNew', { no: r.no, a: islandM(a), b: islandM(b) }, 'got');
  return OK;
}

function updateRoute(state: GameState, cmd: Extract<Command, { t: 'updateRoute' }>): Result {
  const r = state.transport.routes.find((x) => x.id === cmd.id);
  if (!r) return fail('err.noRoute');
  if (cmd.cargoAB !== undefined) r.cargoAB = cmd.cargoAB;
  if (cmd.cargoBA !== undefined) r.cargoBA = cmd.cargoBA;
  if (cmd.priority) {
    if (!priorityUnlocked(state)) return fail('err.locked');
    r.priority = cmd.priority;
  }
  return OK;
}

// ---------------------------------------------------------------- 终局

function installPart(state: GameState, item: ItemId): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'home') return fail('err.homeOnly');
  if (!PART_IDS.includes(item) || stockGet(state.player.pack, item) <= 0) return fail('err.noneLeft');
  stockAdd(state.player.pack, item, -1);
  state.flags.partsInstalled.push(item);
  say(state, 'log.installed', { part: itemM(item), n: state.flags.partsInstalled.length, total: PART_IDS.length }, 'got');
  advance(state, 30);
  return OK;
}

function repairPlane(state: GameState): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'home') return fail('err.homeOnly');
  if (state.flags.planeRepaired) return fail('err.built');
  if (state.flags.partsInstalled.length < PART_IDS.length) return fail('err.needParts');
  if (!presentPeople(state).some((x) => x.role === 'pilot')) return fail('err.needPilot');
  const cost = BALANCE.endgame.repairCost as Stock;
  if (!canPay(state, isl, cost)) return fail('err.missing', { list: stockP(missingCost(state, isl, cost)) });
  pay(state, isl, cost);
  advance(state, 120);
  state.flags.planeRepaired = true;
  isl.buildings.helipad = true;
  state.cutscene = { kind: 'flight', lines: Array.from({ length: FLIGHT_LINES }, (_, i) => 'flight.' + i) };
  return OK;
}

function endCutscene(state: GameState): Result {
  const c = state.cutscene;
  if (!c) return OK;
  state.cutscene = null;
  if (c.kind === 'flight') {
    state.flags.flightDone = true;
    const b = island(state, 'bureau');
    const home = island(state, 'home');
    lightCircle(state, b.x, b.y, BALANCE.map.bureauLightRadius);
    lightCorridor(state, home.x, home.y, b.x, b.y, true);
    b.revealed = true;
    b.discovered = true;
    b.visited = true;
    b.buildings.helipad = true;
    state.player.x = b.x;
    state.player.y = b.y;
    state.player.at = b.id;
    look(state);
    say(state, 'island.bureau.intro');
    say(state, 'log.reportHint', 'hint');
  } else {
    say(state, 'log.endless', 'got');
  }
  return OK;
}

function report(state: GameState): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'bureau') return fail('err.bureauOnly');
  if (state.flags.reported) return fail('err.reported');
  state.flags.reported = true;
  state.bureau.nextOrderAt = state.time;
  bureauHourly(state);
  state.cutscene = { kind: 'ending', lines: Array.from({ length: ENDING_LINES }, (_, i) => 'ending.' + i) };
  return OK;
}

function doExport(state: GameState, item: ItemId, from: 'pack' | 'hold' | 'stock', n: number): Result {
  const isl = here(state);
  if (!isl || isl.kind !== 'bureau') return fail('err.bureauOnly');
  if (from === 'stock') return fail('err.cantUseStock');
  const s = whereStock(state, from);
  if (!s) return fail('err.noRaft');
  const k = Math.min(n, stockGet(s, item));
  if (k <= 0 || ITEMS[item].key || ITEMS[item].trade <= 0) return fail('err.cantExport');
  stockAdd(s, item, -k);
  const v = exportGoods(state, item, k);
  say(state, 'log.exported', { item: itemM(item), n: k, v });
  return OK;
}

function buyUpgrade(state: GameState, kind: 'speed' | 'storage' | 'output'): Result {
  if (!state.flags.reported) return fail('err.locked');
  const cost = upgradeCost(state, kind);
  if (cost === null) return fail('err.maxed');
  if (state.bureau.trade < cost) return fail('err.noTrade', { cost });
  state.bureau.trade -= cost;
  state.bureau.upgrades[kind]++;
  say(state, 'log.upgrade', { what: m('upgrade.' + kind), lv: state.bureau.upgrades[kind] }, 'got');
  return OK;
}

function fly(state: GameState, to: string): Result {
  if (!state.flags.flightDone) return fail('err.needPlane');
  const isl = here(state);
  if (!isl || !isl.buildings.helipad) return fail('err.needHelipad');
  const dest = findIsland(state, to);
  if (!dest || !dest.buildings.helipad || !dest.discovered || dest.id === isl.id) return fail('err.badDest');
  state.player.x = dest.x;
  state.player.y = dest.y;
  state.player.at = dest.id;
  look(state);
  say(state, 'log.flew', { isl: islandM(dest.id) });
  advance(state, A.flyMinutes);
  return OK;
}

// ---------------------------------------------------------------- 分发

export function dispatch(state: GameState, cmd: Command): Result {
  if (state.cutscene && cmd.t !== 'endCutscene') return fail('err.cutscene');
  const pos = positionError(state, cmd);
  if (pos) return fail(pos.k, pos.p);
  const r = run(state, cmd);
  if (!r.ok && r.msg) say(state, r.msg, 'warn');
  checkReveals(state);
  updateUnlocks(state);
  return r;
}

function run(state: GameState, cmd: Command): Result {
  switch (cmd.t) {
    case 'move':
      return move(state, cmd.dx, cmd.dy);
    case 'dock':
      return dock(state);
    case 'leave':
      return leave(state);
    case 'drinkSea':
      return drinkSea(state);
    case 'fishSea':
      return fishSea(state);
    case 'takeCrate':
      if (!state.pendingCrate) return fail('err.noCrate');
      takeCrate(state);
      return OK;
    case 'gather':
      return gather(state, cmd.what);
    case 'craft':
      return craft(state, cmd.recipe, cmd.times);
    case 'consume':
      return consume(state, cmd.from, cmd.item);
    case 'transfer':
      return transfer(state, cmd.item, cmd.from, cmd.to, cmd.n);
    case 'deliver':
      return deliver(state);
    case 'build':
      return build(state, cmd.what);
    case 'sleep':
      return sleep(state);
    case 'wait':
      return wait(state, cmd.minutes);
    case 'wake':
      return wake(state);
    case 'pickUp':
      return pickUp(state, cmd.personId);
    case 'dropOff':
      return dropOff(state, cmd.personId);
    case 'train':
      return train(state, cmd.personId, cmd.trainerId, cmd.job);
    case 'learn':
      return learn(state, cmd.personId, cmd.recipe);
    case 'plant':
      return plant(state, cmd.plot);
    case 'harvest':
      return harvest(state, cmd.plot);
    case 'setTarget':
      state.player.target = cmd.islandId;
      return OK;
    case 'choose':
      return resolveWaterDispute(state, cmd.option);
    case 'buildTransportRaft':
      return buildTransportRaft(state);
    case 'createRoute':
      return newRoute(state, cmd.a, cmd.b, cmd.cargoAB, cmd.cargoBA, cmd.crewId);
    case 'updateRoute':
      return updateRoute(state, cmd);
    case 'deleteRoute':
      deleteRoute(state, cmd.id);
      return OK;
    case 'setReserve': {
      if (!reserveUnlocked(state)) return fail('err.locked');
      const isl = island(state, cmd.island);
      if (cmd.n <= 0) delete isl.reserve[cmd.item];
      else isl.reserve[cmd.item] = Math.round(cmd.n);
      return OK;
    }
    case 'setTargetStock': {
      if (!targetUnlocked(state)) return fail('err.locked');
      const isl = island(state, cmd.island);
      if (cmd.n === null) delete isl.target[cmd.item];
      else isl.target[cmd.item] = Math.max(0, Math.round(cmd.n));
      return OK;
    }
    case 'installPart':
      return installPart(state, cmd.item);
    case 'repairPlane':
      return repairPlane(state);
    case 'endCutscene':
      return endCutscene(state);
    case 'report':
      return report(state);
    case 'export':
      return doExport(state, cmd.item, cmd.from, cmd.n);
    case 'buyUpgrade':
      return buyUpgrade(state, cmd.kind);
    case 'fly':
      return fly(state, cmd.to);
    case 'toggleTwoStep':
      state.player.twoStep = !state.player.twoStep;
      return OK;
    case 'seenRecipes':
      state.newRecipes = [];
      return OK;
    case 'ackRecipes':
      state.recipePopup = [];
      return OK;
    case 'dismissTip':
      if (!state.tips.includes(cmd.id)) state.tips.push(cmd.id);
      return OK;
    case 'seeIntro':
      if (!state.intros.includes(cmd.kind)) state.intros.push(cmd.kind);
      return OK;
    case 'ackGuide':
      state.guide.vitalsSeen = true;
      return OK;
  }
}

export { carried };
