// 新手引导：界面功能按进度逐步出现（类似 A Dark Room），再配合少量情境提示。
// 功能一旦出现就记进 state.unlocks，不会因为条件反复而消失。
import { carried } from './inventory';
import { say } from './log';
import { roleOf } from './people';
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

/** 顺序有意义：前面的出现后，后面的才可能出现 */
export const FEATURES: Feature[] = [
  // 第一根树枝之后才出现“当前目标”和背包
  { id: 'goal', when: (s) => wood(s) >= 1 || s.player.hasRaft },
  // 第二件事做完（时间过去半小时）后引入时间系统：时钟、昼夜、生命水食物
  { id: 'clock', when: (s) => s.time >= BALANCE.time.startMinute + 30 || s.player.hasRaft, log: 'unlock.clock' },
  // 渴了才想到喝海水
  { id: 'seawater', when: (s) => s.player.water <= 55 || s.player.hasRaft, log: 'unlock.seawater' },
  { id: 'dive', when: (s) => s.player.hasRaft },
  { id: 'shoreFish', when: (s) => wood(s) >= 2 || s.player.hasRaft, log: 'unlock.shoreFish' },
  { id: 'craft', when: (s) => wood(s) >= 3 || s.player.hasRaft || s.player.recipes.length > 1, log: 'unlock.craft' },
  { id: 'herb', when: (s) => has(s, 'shoreFish') && (s.player.hp < 100 || carried(s, 'fish') > 0 || s.player.hasRaft), log: 'unlock.herb' },
  { id: 'sea', when: (s) => s.player.hasRaft },
  { id: 'wreck', when: (s) => s.player.hasRaft, log: 'unlock.wreck' },
  { id: 'sleep', when: (s) => s.player.hasRaft || minuteOfDay(s.time) >= 18 * 60 || s.time >= 1440 },
  { id: 'islands', when: (s) => s.islands.some((i) => i.kind !== 'home' && i.discovered) },
  { id: 'people', when: (s) => s.people.some((p) => p.active) },
  { id: 'build', when: (s) => s.islands.some((i) => i.owned && i.kind !== 'home') },
  { id: 'farm', when: (s) => !!roleOf(s, 'farmer')?.active },
  { id: 'routes', when: (s) => !!roleOf(s, 'pilot')?.active },
];

export function has(state: GameState, id: string): boolean {
  return state.unlocks.includes(id);
}

export function updateUnlocks(state: GameState): void {
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
  { id: 'start', when: (s) => !s.player.hasRaft && s.player.at === 'home' && !has(s, 'clock') },
  { id: 'time', when: (s) => has(s, 'clock') && !s.player.hasRaft },
  { id: 'craft', when: (s) => !s.player.hasRaft && has(s, 'craft') },
  { id: 'raft', when: (s) => s.player.hasRaft && s.stats.moves === 0 && s.player.at === 'home' },
  { id: 'sea', when: (s) => !s.player.at && s.stats.moves < 30 },
  { id: 'night', when: (s) => s.player.hasRaft && minuteOfDay(s.time) >= 18 * 60 && s.time < 3 * 1440 },
  { id: 'rescue', when: (s) => at(s)?.kind === 'passenger' && !at(s)!.owned },
  { id: 'lighthouse', when: (s) => !!at(s) && s.lighthouseAsked.includes(at(s)!.id) && !at(s)!.buildings.lighthouse },
  { id: 'owned', when: (s) => !!at(s)?.owned && at(s)!.kind !== 'home' },
  { id: 'containers', when: (s) => !!at(s)?.owned && s.player.hasRaft && s.islands.filter((i) => i.owned).length >= 2 },
  { id: 'native', when: (s) => at(s)?.kind === 'native' && !at(s)!.owned },
  { id: 'train', when: (s) => at(s)?.kind === 'native' && !!at(s)!.owned && !s.flags.firstTraining },
  { id: 'newRecipe', when: (s) => s.newRecipes.length > 0 && s.player.recipes.length > 1 && !s.newRecipes.includes('bottledWater') },
  { id: 'water', when: (s) => s.player.recipes.includes('bottledWater') },
  { id: 'village', when: (s) => at(s)?.kind === 'recipeVillage' || at(s)?.kind === 'laborVillage' },
  { id: 'sleepy', when: (s) => !!at(s)?.sleepy },
  { id: 'routes', when: (s) => !!roleOf(s, 'pilot')?.active && s.transport.routes.length === 0 && s.player.at === 'home' },
  { id: 'bureau', when: (s) => at(s)?.kind === 'bureau' },
];

export function activeTip(state: GameState): string | null {
  for (const t of TIPS) if (!state.tips.includes(t.id) && t.when(state)) return t.id;
  return null;
}
