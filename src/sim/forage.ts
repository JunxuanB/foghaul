// 可刷新的采集点（树、草药丛）：每天早上随机长出一些，玩家手动采几次就采完。
// 只影响玩家手动采集；岛上设施的生产（伐木场等）不受影响。
// 位置候选来自 world/island.ts 的 forageSpots（纯函数），今天长在哪几个由存档的随机数挑。
import { BALANCE } from '../config/balance';
import { ISLANDS } from '../config/world';
import { forageSpots } from '../world/island';
import { templateFor } from '../world/templates';
import { randInt } from './rng';
import type { ForageKind, ForageNode, GameState } from './types';

const KINDS: ForageKind[] = ['tree', 'herb'];

export function nodesOn(state: GameState, islandId: string): ForageNode[] {
  return state.forage[islandId] ?? [];
}

/** 在某座岛上新长出最多 n 个 kind，返回实际长出的数量 */
/** 一座岛上某种采集点的数量：模板写了就用模板的，否则用 BALANCE.forage 的（主岛） */
export function forageCounts(islandId: string, kind: ForageKind): { start: number; perDay: number; max: number } {
  const t = templateFor(islandId);
  return t?.forageCounts?.[kind] ?? BALANCE.forage[kind];
}

export function plantForage(state: GameState, islandId: string, kind: ForageKind, n: number): number {
  const t = templateFor(islandId);
  if (!t || !t.forage[kind].length) return 0;
  const B = BALANCE.forage;
  const list = (state.forage[islandId] ??= []);
  const alive = list.filter((x) => x.kind === kind && x.left > 0).length;
  n = Math.min(n, forageCounts(islandId, kind).max - alive);
  if (n <= 0) return 0;
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

/** 开局：每座岛长出初始的树和草药（岛还没出现也先长好，位置只看这座岛自己的地图） */
export function initForage(state: GameState): void {
  for (const def of ISLANDS) for (const k of KINDS) plantForage(state, def.id, k, forageCounts(def.id, k).start);
}

/** 每天早上：清掉采完的（树桩、空草丛），再长出新的 */
export function dailyForage(state: GameState): void {
  for (const id of Object.keys(state.forage)) {
    state.forage[id] = state.forage[id].filter((x) => x.left > 0);
    for (const k of KINDS) plantForage(state, id, k, forageCounts(id, k).perDay);
  }
}
