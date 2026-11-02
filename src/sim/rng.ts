import type { GameState } from './types';

/** mulberry32：返回下一个状态和 [0,1) 的随机数 */
export function mulberry(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [next, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

/** 独立的随机数生成器（用于地图生成等） */
export function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    const [n, r] = mulberry(s);
    s = n;
    return r;
  };
}

/** 从游戏状态里取随机数，状态随存档保存，保证可复现 */
export function rand(state: GameState): number {
  const [n, r] = mulberry(state.rng);
  state.rng = n;
  return r;
}

export function randInt(state: GameState, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function chance(state: GameState, p: number): boolean {
  return rand(state) < p;
}

export function pickWeighted<T extends string>(state: GameState, weights: Partial<Record<T, number>>): T | null {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return null;
  let r = rand(state) * total;
  for (const [k, w] of entries) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}
