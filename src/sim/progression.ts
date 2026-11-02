import { BALANCE } from '../config/balance';
import { WEAPONS } from '../config/world';
import type { GameState, Person } from './types';
import type { RecipeId } from '../config/recipes';
import { say } from './log';
import { m } from './msg';

const P = BALANCE.progression;

export interface LevelInfo {
  level: number;
  xp: number;
  /** 当前级起点 */
  from: number;
  /** 下一级所需（满级为 null） */
  next: number | null;
  /** 进度 0..1 */
  ratio: number;
}

export function levelInfo(xp: number, table: number[]): LevelInfo {
  let level = 1;
  for (let i = 1; i < table.length; i++) if (xp >= table[i]) level = i + 1;
  const from = table[level - 1];
  const next = level < table.length ? table[level] : null;
  const ratio = next === null ? 1 : (xp - from) / (next - from);
  return { level, xp, from, next, ratio: Math.max(0, Math.min(1, ratio)) };
}

export type PlayerSkill = 'sail' | 'attack' | 'manage';

export function playerLevel(state: GameState, skill: PlayerSkill): number {
  return levelInfo(state.player.xp[skill], P[skill]).level;
}

export function gainPlayerXp(state: GameState, skill: PlayerSkill, n: number): void {
  const before = playerLevel(state, skill);
  state.player.xp[skill] += n;
  const after = playerLevel(state, skill);
  if (after > before) {
    let extra = '';
    if (skill === 'sail' && after === P.sailTwoStepLevel) extra = 'skillup.twoStep';
    else if (skill === 'attack' && after === BALANCE.sea.combat.critFromLevel) extra = 'skillup.crit';
    else if (skill === 'manage') extra = 'skillup.manage';
    say(state, 'log.skillUp', { skill: m('skill.' + skill), lv: after, extra: extra ? m(extra) : '' });
  }
}

export function personTable(p: Person): number[] {
  return p.role === 'pilot' ? P.pilot : P.passenger;
}

export function personLevel(p: Person): number {
  return levelInfo(p.xp, personTable(p)).level;
}

export function gainPersonXp(state: GameState, p: Person, n: number): void {
  const before = personLevel(p);
  p.xp += n;
  const after = personLevel(p);
  if (after > before) {
    let extra = 'personup.work';
    if (p.role === 'pilot') {
      if (after === P.unlockReserveLevel) extra = 'personup.reserve';
      else if (after === P.unlockTargetLevel) extra = 'personup.target';
      else if (after === P.unlockPriorityLevel) extra = 'personup.priority';
      else extra = 'personup.speed';
    }
    say(state, 'log.personUp', { who: p.name, lv: after, extra: m(extra) });
  }
}

export function force(state: GameState): number {
  const c = BALANCE.sea.combat;
  const weapon = state.player.weapons.reduce((m, w) => Math.max(m, WEAPONS[w].force), 0);
  return c.baseForce + playerLevel(state, 'attack') * c.forcePerLevel + weapon;
}

/** 最好的武器的词典键 */
export function bestWeaponKey(state: GameState): string {
  let best: string | null = null;
  let f = -1;
  for (const w of state.player.weapons)
    if (WEAPONS[w].force > f) {
      f = WEAPONS[w].force;
      best = w;
    }
  return best ? 'weapon.' + best : 'weapon.none';
}

export function pilotLevel(state: GameState): number {
  const p = state.people.find((x) => x.role === 'pilot');
  return p && p.active ? personLevel(p) : 0;
}

/** 玩家学会一个配方：加进制作页，标记为“新”，写日志 */
export function learnRecipe(state: GameState, r: RecipeId): void {
  if (state.player.recipes.includes(r)) return;
  state.player.recipes.push(r);
  if (!state.newRecipes.includes(r)) state.newRecipes.push(r);
  if (!state.recipePopup.includes(r)) state.recipePopup.push(r);
  say(state, 'log.newRecipe', { recipe: { k: 'recipe.' + r } }, 'got');
}
