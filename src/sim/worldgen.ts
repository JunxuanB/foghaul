import { BALANCE } from '../config/balance';
import type { Biome } from '../config/recipes';
import { ISLANDS, STAGE_HOST, type IslandTemplate, type Stage } from '../config/world';
import { makeRng } from './rng';
import { euclid, manhattan } from './util';

const M = BALANCE.map;

export interface PlacedIsland {
  id: string;
  x: number;
  y: number;
  rot: number;
  biome: Biome | null;
}

export interface WorldLayout {
  islands: PlacedIsland[];
  attempts: number;
}

const STAGE_ORDER: Stage[] = ['home', 'A', 'B', 'C', 'D'];
const NATIVE_BIOMES: Biome[] = ['field', 'forest', 'fishing', 'stone', 'herb'];

/** 某阶段已经亮起的光源（主岛 + 之前各阶段的灯塔宿主） */
function sourcesBefore(stage: Stage, pos: Map<string, PlacedIsland>): PlacedIsland[] {
  const out: PlacedIsland[] = [pos.get('home')!];
  const idx = STAGE_ORDER.indexOf(stage);
  for (const s of ['B', 'C', 'D'] as const) {
    if (STAGE_ORDER.indexOf(s) < idx) out.push(pos.get(STAGE_HOST[s])!);
  }
  return out;
}

function sourcesUpTo(stage: Stage, pos: Map<string, PlacedIsland>): PlacedIsland[] {
  const out: PlacedIsland[] = [pos.get('home')!];
  const idx = STAGE_ORDER.indexOf(stage);
  for (const s of ['B', 'C', 'D'] as const) {
    if (STAGE_ORDER.indexOf(s) <= idx) out.push(pos.get(STAGE_HOST[s])!);
  }
  return out;
}

function tryLayout(rand: () => number): PlacedIsland[] | null {
  const W = M.width;
  const H = M.height;
  const R = M.lightRadius;
  const margin = 2;
  const pos = new Map<string, PlacedIsland>();
  const list: PlacedIsland[] = [];
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

  const resolveBiome = (t: IslandTemplate): Biome | null => {
    if (!t.biome) return null;
    if (t.biome === 'native') return NATIVE_BIOMES[ri(0, NATIVE_BIOMES.length - 1)];
    if (t.biome === 'forestOrStone') return rand() < 0.5 ? 'forest' : 'stone';
    return t.biome;
  };

  for (const t of ISLANDS) {
    let candidates: [number, number][] = [];
    if (t.stage === 'home') {
      candidates = [[ri(24, 35), ri(13, 22)]];
    } else if (t.stage === 'bureau') {
      const home = pos.get('home')!;
      const bm = Math.ceil(M.fogBankRadius) + 1;
      for (let y = bm; y < H - bm; y++)
        for (let x = bm; x < W - bm; x++) {
          const d = manhattan(x, y, home.x, home.y);
          if (d < 15 || d > 22) continue;
          if (list.some((p) => manhattan(x, y, p.x, p.y) < M.minSpacing + 1)) continue;
          candidates.push([x, y]);
        }
    } else {
      const parent = t.stage === 'A' ? pos.get('home')! : pos.get(STAGE_HOST[t.stage as 'B' | 'C' | 'D']);
      if (!parent) return null;
      const before = t.stage === 'A' ? [] : sourcesBefore(t.stage, pos);
      for (let y = margin; y < H - margin; y++)
        for (let x = margin; x < W - margin; x++) {
          const d = manhattan(x, y, parent.x, parent.y);
          if (d < M.neighborMin || d > M.neighborMax) continue;
          if (euclid(x, y, parent.x, parent.y) > R - 0.5) continue;
          if (before.some((s) => euclid(x, y, s.x, s.y) <= R + 0.5)) continue;
          if (list.some((p) => manhattan(x, y, p.x, p.y) < M.minSpacing)) continue;
          candidates.push([x, y]);
        }
    }
    if (!candidates.length) return null;
    const [x, y] = candidates[ri(0, candidates.length - 1)];
    const p: PlacedIsland = { id: t.id, x, y, rot: ri(0, 359), biome: resolveBiome(t) };
    pos.set(t.id, p);
    list.push(p);
  }

  // 连通性：每个阶段的岛都能在当时已亮的区域内从主岛走到
  const bureau = pos.get('bureau')!;
  for (const t of ISLANDS) {
    if (t.stage === 'home' || t.stage === 'bureau') continue;
    const srcs = sourcesUpTo(t.stage, pos);
    const target = pos.get(t.id)!;
    if (!reachable(pos.get('home')!, target, srcs, bureau)) return null;
  }
  return list;
}

function reachable(from: PlacedIsland, to: PlacedIsland, srcs: PlacedIsland[], bureau: PlacedIsland): boolean {
  const W = M.width;
  const H = M.height;
  const R = M.lightRadius;
  const ok = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < W &&
    y < H &&
    euclid(x, y, bureau.x, bureau.y) > M.fogBankRadius &&
    srcs.some((s) => euclid(x, y, s.x, s.y) <= R);
  const seen = new Uint8Array(W * H);
  const q: number[] = [from.y * W + from.x];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const cx = c % W;
    const cy = (c / W) | 0;
    if (cx === to.x && cy === to.y) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!ok(nx, ny)) continue;
      const n = ny * W + nx;
      if (seen[n]) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
  return false;
}

export function generateLayout(seed: number): WorldLayout {
  const rand = makeRng(seed);
  for (let attempt = 1; attempt <= 2000; attempt++) {
    const r = tryLayout(rand);
    if (r) return { islands: r, attempts: attempt };
  }
  throw new Error('无法生成地图，种子 ' + seed);
}
