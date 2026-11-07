// 新手引导：界面功能按进度逐步出现（类似 A Dark Room），再配合少量情境提示。
// 功能一旦出现就记进 state.unlocks，不会因为条件反复而消失。
import { carried } from './inventory';
import { say } from './log';
import { updateGuide } from './guide';
import type { GameState } from './types';
import { island, stockGet } from './util';
import { minuteOfDay } from './clock';
import { BALANCE } from '../config/balance';

function wood(state: GameState): number {
  return carried(state, 'wood') + stockGet(island(state, 'home').stock, 'wood');
}

interface Feature {
  id: string;
  when: (s: GameState) => boolean;
  /** 出现时写一条日志（可选） */
  log?: string;
}

/** 2D 版 HUD 元素逐步出现（docs/2d-design.md 第 8 节“功能逐步出现”）。顺序有意义 */
export const FEATURES: Feature[] = [
  // 走出 3 格之后出现当前目标
  { id: 'goal', when: (s) => s.walk.moved >= BALANCE.interact.walkTilesForGoal * 16 || s.player.hasRaft },
  // 拿到第一样东西后出现快捷栏
  { id: 'hotbar', when: (s) => Object.values(s.player.pack).some((n) => (n ?? 0) > 0) || s.player.hasRaft },
  // 开局半小时后出现时间
  { id: 'clock', when: (s) => s.time >= BALANCE.time.startMinute + 30 || s.player.hasRaft, log: 'unlock.clock' },
  // 快要出海时（木头差不多够造木筏），或者真的渴了饿了，才出现生命、水、食物
  { id: 'vitals', when: (s) => wood(s) >= 6 || s.player.hasRaft || s.player.water < 50 || s.player.food < 45, log: 'unlock.vitals' },
  // 第一次有不是开场白的日志
  { id: 'log', when: (s) => has(s, 'goal') && s.log.some((l) => !l.m.k.startsWith('opening.')) },
  // 第一次出海后出现海图
  { id: 'map', when: (s) => s.stats.moves > 0 },
  // 救出第一位同伴后出现人物面板
  { id: 'people', when: (s) => s.people.some((p) => p.active) },
];

export function has(state: GameState, id: string): boolean {
  return state.unlocks.includes(id);
}

export function updateUnlocks(state: GameState): void {
  updateGuide(state);
  for (const f of FEATURES) {
    if (has(state, f.id) || !f.when(state)) continue;
    state.unlocks.push(f.id);
    if (f.log) say(state, f.log, 'hint');
  }
}

// ---------------- 情境提示 ----------------

interface Tip {
  id: string;
  when: (s: GameState) => boolean;
}

const at = (s: GameState) => (s.player.at ? island(s, s.player.at) : undefined);

/** 按优先级排列；同一时间只显示第一条满足条件、没被关闭的 */
export const TIPS: Tip[] = [
  { id: 'sea', when: (s) => !s.player.at && s.stats.moves < 30 },
  { id: 'night', when: (s) => s.player.hasRaft && minuteOfDay(s.time) >= 18 * 60 && s.time < 3 * 1440 },
  { id: 'owned', when: (s) => !!at(s)?.owned && at(s)!.kind !== 'home' },
  { id: 'containers', when: (s) => !!at(s)?.owned && s.player.hasRaft && s.islands.filter((i) => i.owned).length >= 2 },
  { id: 'native', when: (s) => at(s)?.kind === 'native' && !at(s)!.owned },
  { id: 'water', when: (s) => s.player.recipes.includes('bottledWater') },
  { id: 'village', when: (s) => at(s)?.kind === 'recipeVillage' || at(s)?.kind === 'laborVillage' },
  { id: 'sleepy', when: (s) => !!at(s)?.sleepy },
  { id: 'bureau', when: (s) => at(s)?.kind === 'bureau' },
];

export function activeTip(state: GameState): string | null {
  for (const t of TIPS) if (!state.tips.includes(t.id) && t.when(state)) return t.id;
  return null;
}
