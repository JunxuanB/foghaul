// 地图生成：开局只确定主岛和进出口局（藏在浓雾里）的位置。
// 其他岛在剧情解锁时才放置（见 reveal.ts），落在新打开的海域里。
import { BALANCE } from '../config/balance';
import type { Biome } from '../config/recipes';
import { makeRng } from './rng';
import { rand } from './rng';
import type { GameState } from './types';
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

/** 已放置的岛（含进出口局的保留位置） */
function placed(state: GameState): Spot[] {
  return state.islands.filter((i) => i.revealed || i.kind === 'bureau' || i.kind === 'home');
}

/**
 * 在锚点岛附近找一个位置：优先放在还没打开的迷雾里，离锚点一段航程，和其他岛保持间距。
 * 找不到时逐步放宽条件，保证总能放下。
 */
export function findSpot(state: GameState, anchor: Spot): Spot {
  const W = state.width;
  const H = state.height;
  const others = placed(state);
  const bureau = state.islands.find((i) => i.kind === 'bureau')!;
  const tries: { min: number; max: number; spacing: number; fogOnly: boolean }[] = [
    { min: M.neighborMin, max: M.neighborMax, spacing: M.minSpacing, fogOnly: true },
    { min: M.neighborMin - 2, max: M.neighborMax + 4, spacing: M.minSpacing, fogOnly: true },
    { min: M.neighborMin - 2, max: M.neighborMax + 8, spacing: M.minSpacing - 1, fogOnly: false },
    { min: 6, max: 40, spacing: 5, fogOnly: false },
    { min: 3, max: 99, spacing: 3, fogOnly: false },
  ];
  const margin = 2;
  for (const t of tries) {
    const cands: Spot[] = [];
    for (let y = margin; y < H - margin; y++)
      for (let x = margin; x < W - margin; x++) {
        const d = manhattan(x, y, anchor.x, anchor.y);
        if (d < t.min || d > t.max) continue;
        if (euclid(x, y, bureau.x, bureau.y) <= M.fogBankRadius + 3) continue;
        if (others.some((o) => manhattan(x, y, o.x, o.y) < t.spacing)) continue;
        if (t.fogOnly && state.lit[y * W + x]) continue;
        cands.push({ x, y });
      }
    if (cands.length) return cands[Math.floor(rand(state) * cands.length)];
  }
  throw new Error('no room for island');
}
