import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from '../config/items';
import { isNight, minuteOfDay } from './clock';
import { births, meal, produce, sleepyCheck } from './economy';
import { bureauHourly } from './endgame';
import { say } from './log';
import { islandM, m, recipeM, stockP } from './msg';
import { tickTransport } from './transport';
import { learnRecipe } from './progression';
import { checkReveals } from './reveal';
import { updateUnlocks } from './tutorial';
import type { GameState } from './types';
import { findIsland, island, manhattan, stockAdd } from './util';

const S = BALANCE.survival;

export interface AdvanceOpts {
  sleeping?: boolean;
}

/** 玩家是否在有遮蔽的地方（夜里不掉血） */
export function sheltered(state: GameState): boolean {
  const isl = findIsland(state, state.player.at);
  if (!isl) return false;
  if (isl.buildings.bed) return true;
  return isl.kind === 'recipeVillage' || isl.kind === 'laborVillage' || isl.kind === 'bureau';
}

function survive(state: GameState, minutes: number, opts: AdvanceOpts): void {
  const p = state.player;
  const h = minutes / 60;
  const f = opts.sleeping ? S.sleepDrainFactor : 1;
  p.water = Math.max(0, p.water - S.waterPerHour * h * f);
  p.food = Math.max(0, p.food - S.foodPerHour * h * f);
  let dmg = 0;
  if (p.water <= 0) dmg += S.thirstHpPerHour * h;
  if (p.food <= 0) dmg += S.hungerHpPerHour * h;
  if (isNight(state.time) && !sheltered(state)) {
    dmg += (p.at ? S.nightHpPerHourIsland : S.nightHpPerHourSea) * h;
  }
  if (dmg > 0) p.hp = Math.max(0, p.hp - dmg);
}

function hourly(state: GameState): void {
  const m = minuteOfDay(state.time);
  if (BALANCE.economy.mealTimes.includes(m)) meal(state);
  if (m === BALANCE.time.dayStart) births(state);
  sleepyCheck(state);
  bureauHourly(state);
}

function finishLearning(state: GameState): boolean {
  let any = false;
  for (const p of state.people) {
    if (!p.learning || state.time < p.learning.until) continue;
    const { recipe, village } = p.learning;
    p.learning = null;
    if (!p.recipes.includes(recipe)) p.recipes.push(recipe);
    learnRecipe(state, recipe);
    const v = state.villages[village];
    v.pendingRecipes = v.pendingRecipes.filter((r) => r !== recipe);
    say(state, 'log.learned', { who: p.name, recipe: recipeM(recipe), village: m('village.' + village) }, 'got');
    any = true;
  }
  return any;
}

/** 推进全网时间。时钟、玩家消耗、生产、需求、运输一起前进。 */
export function advance(state: GameState, minutes: number, opts: AdvanceOpts = {}): void {
  let remaining = minutes;
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 100000) {
    if (state.cutscene) break;
    const t = state.time;
    const nextHour = Math.floor(t / 60 + 1e-9) * 60 + 60;
    const step = Math.min(remaining, nextHour - t);
    survive(state, step, opts);
    produce(state, step);
    tickTransport(state, step);
    state.time = t + step;
    remaining -= step;
    if (state.time >= nextHour - 1e-9) {
      state.time = nextHour;
      hourly(state);
      updateUnlocks(state);
    }
    if (finishLearning(state)) checkReveals(state);
    if (state.player.hp <= 0) {
      die(state);
      remaining += S.death.minutes;
      opts = {};
    }
  }
}

/** 死亡：丢失部分普通货物，回到最近的床；零件不会丢，随船人员回到原岛 */
export function die(state: GameState): void {
  const p = state.player;
  state.stats.deaths++;
  const lost: Partial<Record<ItemId, number>> = {};
  const loseFrom = (s: typeof p.hold, ratio: number) => {
    for (const [k, v] of Object.entries(s)) {
      const id = k as ItemId;
      if (ITEMS[id].key) continue;
      const n = Math.floor((v ?? 0) * ratio);
      if (n > 0) {
        stockAdd(s, id, -n);
        lost[id] = (lost[id] ?? 0) + n;
      }
    }
  };
  loseFrom(p.hold, S.death.holdLossRatio);
  loseFrom(p.pack, S.death.packLossRatio);
  for (const id of p.aboard) {
    const person = state.people.find((x) => x.id === id);
    if (person) person.loc = { kind: 'island', id: person.lastIsland };
  }
  p.aboard = [];
  const beds = state.islands.filter((i) => i.buildings.bed && (i.owned || i.kind === 'home'));
  beds.sort((a, b) => manhattan(a.x, a.y, p.x, p.y) - manhattan(b.x, b.y, p.x, p.y));
  const bed = beds[0] ?? island(state, 'home');
  p.x = bed.x;
  p.y = bed.y;
  p.at = bed.id;
  p.hp = S.death.respawnHp;
  p.water = Math.max(p.water, S.death.minWater);
  p.food = Math.max(p.food, S.death.minFood);
  state.pendingCrate = null;
  say(state, Object.keys(lost).length ? 'log.diedLost' : 'log.died', { lost: stockP(lost), bed: islandM(bed.id) }, 'bad');
}

