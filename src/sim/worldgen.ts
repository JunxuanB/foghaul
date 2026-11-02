// 地图生成：开局只确定主岛和进出口局（藏在浓雾里）的位置。
// 其他岛在剧情解锁时才放置（见 reveal.ts）：落在锚点岛灯塔新照亮、玩家还没去过的海域里。
import { BALANCE } from '../config/balance';
import type { Biome } from '../config/recipes';
import { lightCircle } from './map';
import { makeRng, rand } from './rng';
import type { GameState, Island } from './types';
import { euclid, manhattan } from './util';

const M = BALANCE.map;

export interface Spot {
  x: number;
  y: number;
}

/** 开局：主岛在地图中部，进出口局离主岛不远但藏在浓雾里 */
export function placeHomeAndBureau(seed: number): { home: Spot; bureau: Spot } {
  const r = makeRng(seed);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const home = { x: ri(24, 35), y: ri(13, 22) };
  const bm = Math.ceil(M.fogBankRadius) + 2;
  const cands: Spot[] = [];
  for (let y = bm; y < M.height - bm; y++)
    for (let x = bm; x < M.width - bm; x++) {
      const d = manhattan(x, y, home.x, home.y);
      if (d >= M.bureauMin && d <= M.bureauMax) cands.push({ x, y });
    }
  return { home, bureau: cands[ri(0, cands.length - 1)] };
}

export const NATIVE_BIOMES: Biome[] = ['field', 'forest', 'fishing', 'stone', 'herb'];

/** 灯塔照亮的半径（主岛固定，其他岛按等级） */
export function lightRadius(isl: Island): number {
  if (isl.kind === 'home') return M.homeLightRadius;
  return M.lighthouseRadius[Math.min(M.lighthouseRadius.length, isl.level) - 1];
}

/** 从锚点出发、在可探索海域里能走到的格子 */
function reachableFrom(state: GameState, a: Spot): Uint8Array {
  const W = state.width;
  const H = state.height;
  const seen = new Uint8Array(W * H);
  const q = [a.y * W + a.x];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const cx = c % W;
    const cy = (c / W) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (seen[n] || !state.lit[n]) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
  return seen;
}

/**
 * 给下一座主线岛找位置：在锚点岛灯塔照亮的范围里，优先选这座灯塔“新照亮”、玩家没去过的格子，
 * 和其他岛保持间距。找不到时逐步放宽；实在没有就把灯塔照得更远一圈再找。
 */
export function findSpot(state: GameState, anchor: Island): Spot {
  const W = state.width;
  const H = state.height;
  const others = state.islands.filter((i) => i.revealed || i.kind === 'bureau' || i.kind === 'home');
  const bureau = state.islands.find((i) => i.kind === 'bureau')!;
  const margin = 2;
  const scan = (R: number, own: boolean, unseen: boolean, spacing: number): Spot[] => {
    const reach = reachableFrom(state, anchor);
    const cands: Spot[] = [];
    for (let y = margin; y < H - margin; y++)
      for (let x = margin; x < W - margin; x++) {
        const i = y * W + x;
        if (!state.lit[i] || !reach[i]) continue;
        const d = euclid(x, y, anchor.x, anchor.y);
        if (d < M.placeMinDistance || d > R - 1.5) continue;
        if (own && !anchor.lightEvents.includes(state.lit[i])) continue;
        if (unseen && state.seen[i]) continue;
        if (euclid(x, y, bureau.x, bureau.y) <= M.fogBankRadius + 3) continue;
        if (others.some((o) => o !== anchor && manhattan(x, y, o.x, o.y) < spacing)) continue;
        cands.push({ x, y });
      }
    return cands;
  };
  const pick = (c: Spot[]) => c[Math.floor(rand(state) * c.length)];
  // 先在这座灯塔新照亮的海域里找；地方不够就让灯塔再往外照一圈
  for (let extra = 0; extra <= 12; extra += 3) {
    const R = lightRadius(anchor) + extra;
    if (extra > 0) anchor.lightEvents.push(lightCircle(state, anchor.x, anchor.y, R));
    for (const unseen of [true, false]) {
      const c = scan(R, true, unseen, M.minSpacing);
      if (c.length) return pick(c);
    }
  }
  // 兜底：任何已照亮的地方
  for (const spacing of [M.minSpacing, M.minSpacing - 2, 3]) {
    const c = scan(lightRadius(anchor) + 12, false, false, spacing);
    if (c.length) return pick(c);
  }
  throw new Error('no room for island');
}
