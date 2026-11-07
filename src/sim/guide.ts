// 第一天脚本引导（docs/2d-design.md 第 8 节）：一步一件事，做完才出下一步；条件已经满足的步直接跳过。
// 每步只高亮一个对象（物体种类或界面元素）。18:00 以后不管在哪一步，都插一条“回小屋睡觉”。
import { BALANCE } from '../config/balance';
import type { ObjKind } from '../config/buildings';
import { RECIPES } from '../config/recipes';
import { minuteOfDay } from './clock';
import { carried } from './inventory';
import { m, type Msg } from './msg';
import type { GameState } from './types';
import { island, stockGet } from './util';

const RAFT_WOOD = RECIPES.raft.inputs.wood ?? 0;

function wood(s: GameState): number {
  return carried(s, 'wood') + stockGet(island(s, 'home').stock, 'wood');
}

export type GuideTarget = { kind: 'object'; obj: ObjKind } | { kind: 'player' } | { kind: 'ui'; id: string };

export interface GuideStep {
  id: string;
  target: GuideTarget;
  /** 这一步说完了 */
  done: (s: GameState) => boolean;
  /** 说明（目标卡第二行） */
  detail: (s: GameState) => Msg;
}

export const GUIDE: GuideStep[] = [
  {
    id: 'walk',
    target: { kind: 'player' },
    done: (s) => s.walk.moved >= BALANCE.interact.walkTilesForGoal * 16 || s.player.hasRaft,
    detail: () => m('guide.walk.d'),
  },
  { id: 'branch', target: { kind: 'object', obj: 'tree' }, done: (s) => wood(s) >= 1 || s.player.hasRaft, detail: () => m('guide.branch.d') },
  {
    id: 'moreWood',
    target: { kind: 'object', obj: 'tree' },
    done: (s) => wood(s) >= 3 || s.player.hasRaft,
    detail: (s) => m('guide.moreWood.d', { have: Math.min(wood(s), RAFT_WOOD), n: RAFT_WOOD }),
  },
  {
    id: 'fish',
    target: { kind: 'object', obj: 'shoal' },
    done: (s) => carried(s, 'fish') >= 1 || wood(s) >= RAFT_WOOD || s.player.hasRaft,
    detail: () => m('guide.fish.d'),
  },
  {
    id: 'wood8',
    target: { kind: 'object', obj: 'tree' },
    done: (s) => wood(s) >= RAFT_WOOD || s.player.hasRaft,
    detail: (s) => m('guide.moreWood.d', { have: Math.min(wood(s), RAFT_WOOD), n: RAFT_WOOD }),
  },
  { id: 'raft', target: { kind: 'object', obj: 'workbench' }, done: (s) => s.player.hasRaft, detail: () => m('guide.raft.d') },
  { id: 'vitals', target: { kind: 'ui', id: 'vitals' }, done: (s) => s.guide.vitalsSeen, detail: () => m('guide.vitals.d') },
];

/** 晚上插入的一步 */
export const NIGHT_STEP: GuideStep = {
  id: 'night',
  target: { kind: 'object', obj: 'bed' },
  done: () => false,
  detail: () => m('guide.night.d'),
};

/** 推进引导：跳过已满足的步（在每次 dispatch / 推进时间后调用） */
export function updateGuide(state: GameState): void {
  while (state.guide.step < GUIDE.length && GUIDE[state.guide.step].done(state)) state.guide.step++;
}

/** 当前该显示的引导步；引导结束后为 null */
export function currentGuide(state: GameState): GuideStep | null {
  const min = minuteOfDay(state.time);
  const late = min >= BALANCE.time.sleepAllowedFrom || min < BALANCE.time.dayStart;
  if (late && state.player.at === 'home' && state.time < BALANCE.time.startMinute + 1440 * 3) return NIGHT_STEP;
  return GUIDE[state.guide.step] ?? null;
}
