import { m, islandM, type Msg } from './msg';
import type { GameState } from './types';
import { dirOf, island, manhattan } from './util';

/** 方向描述：“从 X 往东北约 N 格” */
export function whereMsg(state: GameState, targetId: string, fromId: string): Msg {
  const t = island(state, targetId);
  const f = island(state, fromId);
  const d = dirOf(t.x - f.x, t.y - f.y);
  return m('where', { from: islandM(f.id), dir: m(d.key), n: manhattan(t.x, t.y, f.x, f.y) });
}

/** 从人现在的位置（海上为木筏所在的格子）到某座岛的方向和格数 */
export function towardsMsg(state: GameState, targetId: string): Msg {
  const t = island(state, targetId);
  const p = state.player;
  const d = dirOf(t.x - p.x, t.y - p.y);
  return m('ui.towards', { arrow: d.arrow, isl: islandM(t.id), dir: m(d.key), n: Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y)) });
}

/** 记录对某座岛的方向提示，key 的模板里用 {where} 插入方向 */
export function giveHint(state: GameState, targetId: string, fromId: string, key: string): Msg {
  const msg = m(key, { where: whereMsg(state, targetId, fromId) });
  state.hints[targetId] = msg;
  return msg;
}
