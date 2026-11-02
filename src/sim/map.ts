import { BALANCE } from '../config/balance';
import type { GameState, Island } from './types';
import { euclid } from './util';

const M = BALANCE.map;

export interface LightSource {
  x: number;
  y: number;
  r: number;
}

export function lightSources(state: GameState): LightSource[] {
  const out: LightSource[] = [];
  for (const i of state.islands) {
    if (i.kind === 'home' || i.buildings.lighthouse) out.push({ x: i.x, y: i.y, r: M.lightRadius });
  }
  return out;
}

export function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function bureauIsland(state: GameState): Island | undefined {
  return state.islands.find((i) => i.kind === 'bureau');
}

/** 进出口局周围的浓雾（修好飞机前一直存在） */
export function inFogBank(state: GameState, x: number, y: number): boolean {
  if (state.flags.flightDone) return false;
  const b = bureauIsland(state);
  if (!b) return false;
  return euclid(x, y, b.x, b.y) <= M.fogBankRadius;
}

export function isLitBy(sources: LightSource[], x: number, y: number): boolean {
  for (const s of sources) if (euclid(x, y, s.x, s.y) <= s.r) return true;
  return false;
}

export function isLit(state: GameState, x: number, y: number, sources = lightSources(state)): boolean {
  if (inFogBank(state, x, y)) return false;
  if (state.flags.flightDone) {
    const b = bureauIsland(state);
    if (b && euclid(x, y, b.x, b.y) <= M.lightRadius) return true;
  }
  return isLitBy(sources, x, y);
}

export function canEnter(state: GameState, x: number, y: number, sources?: LightSource[]): boolean {
  return inBounds(state, x, y) && isLit(state, x, y, sources);
}

export function seenIdx(state: GameState, x: number, y: number): number {
  return y * state.width + x;
}

export function isSeen(state: GameState, x: number, y: number): boolean {
  return state.seen[seenIdx(state, x, y)] === 1;
}

/** 标记视野并发现附近岛屿，返回新发现的岛 */
export function look(state: GameState): Island[] {
  const { x, y } = state.player;
  const r = M.seenRadius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(state, nx, ny)) state.seen[seenIdx(state, nx, ny)] = 1;
    }
  }
  const found: Island[] = [];
  for (const i of state.islands) {
    if (i.discovered) continue;
    if (i.kind === 'bureau' && !state.flags.flightDone) continue;
    if (Math.max(Math.abs(i.x - x), Math.abs(i.y - y)) <= M.discoverRadius) {
      i.discovered = true;
      found.push(i);
    }
  }
  return found;
}

/** 在可通行区域内 BFS 寻路（四方向），返回步数序列；用于测试和调试 */
export function findPath(
  state: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): { dx: number; dy: number }[] | null {
  const W = state.width;
  const H = state.height;
  const sources = lightSources(state);
  const prev = new Int32Array(W * H).fill(-1);
  const start = sy * W + sx;
  const goal = ty * W + tx;
  prev[start] = start;
  const q = [start];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === goal) break;
    const cx = c % W;
    const cy = (c / W) | 0;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (prev[n] !== -1) continue;
      if (!canEnter(state, nx, ny, sources)) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const steps: { dx: number; dy: number }[] = [];
  let c = goal;
  while (c !== start) {
    const p = prev[c];
    steps.push({ dx: (c % W) - (p % W), dy: ((c / W) | 0) - ((p / W) | 0) });
    c = p;
  }
  return steps.reverse();
}
