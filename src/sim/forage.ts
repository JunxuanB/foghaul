// 可刷新的采集点（树、草药丛）：每天早上随机长出一些，玩家手动采几次就采完。
// 只影响玩家手动采集；岛上设施的生产（伐木场等）不受影响。
// 位置候选来自 world/island.ts 的 forageSpots（纯函数），今天长在哪几个由存档的随机数挑。
import { BALANCE } from '../config/balance';
import { MAPS } from '../config/maps';
import { forageSpots } from '../world/island';
import { randInt } from './rng';
import type { ForageKind, ForageNode, GameState } from './types';

const KINDS: ForageKind[] = ['tree', 'herb'];

export function nodesOn(state: GameState, islandId: string): ForageNode[] {
  return state.forage[islandId] ?? [];
}

/** 在某座岛上新长出最多 n 个 kind，返回实际长出的数量 */
export function plantForage(state: GameState, islandId: string, kind: ForageKind, n: number): number {
  if (!MAPS[islandId]) return 0;
  const B = BALANCE.forage;
  const list = (state.forage[islandId] ??= []);
  const alive = list.filter((x) => x.kind === kind && x.left > 0).length;
  n = Math.min(n, B[kind].max - alive);
  const spots = forageSpots(islandId, state.seed, kind);
  const minGap = Math.max(B.spacing.tree, B.spacing[kind]);
  const w = state.walk;
  let made = 0;
  for (let tries = 0; made < n && tries < n * 30 && spots.length; tries++) {
    const [x, y] = spots[randInt(state, 0, spots.length - 1)];
    if (list.some((o) => Math.hypot(o.x - x, o.y - y) < minGap)) continue;
    // 不长在人物脚下
    if (w.island === islandId && Math.hypot(w.x - x, w.y - y) < 18) continue;
    const sprites = B[kind].sprites;
    list.push({
      id: `${kind}@${state.forageSeq++}`,
      kind,
      sprite: sprites[randInt(state, 0, sprites.length - 1)],
      x,
      y,
      left: randInt(state, B[kind].yield[0], B[kind].yield[1]),
    });
    made++;
  }
  return made;
}

/** 开局：每座有地图的岛长出初始的树和草药 */
export function initForage(state: GameState): void {
  for (const id of Object.keys(MAPS)) for (const k of KINDS) plantForage(state, id, k, BALANCE.forage[k].start);
}

/** 每天早上：清掉采完的（树桩、空草丛），再长出新的 */
export function dailyForage(state: GameState): void {
  for (const id of Object.keys(state.forage)) {
    state.forage[id] = state.forage[id].filter((x) => x.left > 0);
    for (const k of KINDS) plantForage(state, id, k, BALANCE.forage[k].perDay);
  }
}
