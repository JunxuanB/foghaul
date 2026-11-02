import { BALANCE } from '../config/balance';
import type { GameState, Island } from './types';
import { euclid } from './util';

const M = BALANCE.map;

// 可探索区域是一张显式的 0/1 位图（state.lit），由剧情解锁、灯塔和试飞逐步打开。

export function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function bureauIsland(state: GameState): Island | undefined {
  return state.islands.find((i) => i.kind === 'bureau');
}

/** 进出口局周围的浓雾（修好飞机前一直存在，任何东西都照不亮它） */
export function inFogBank(state: GameState, x: number, y: number): boolean {
  if (state.flags.flightDone) return false;
  const b = bureauIsland(state);
  if (!b) return false;
  return euclid(x, y, b.x, b.y) <= M.fogBankRadius;
}

export function isLit(state: GameState, x: number, y: number): boolean {
  return inBounds(state, x, y) && state.lit[y * state.width + x] === 1;
}

export function canEnter(state: GameState, x: number, y: number): boolean {
  return isLit(state, x, y);
}

function light(state: GameState, x: number, y: number): void {
  if (!inBounds(state, x, y) || inFogBank(state, x, y)) return;
  state.lit[y * state.width + x] = 1;
}

/** 打开一片圆形海域 */
export function lightCircle(state: GameState, cx: number, cy: number, r: number): void {
  const R = Math.ceil(r);
  for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (euclid(x, y, cx, cy) <= r) light(state, x, y);
}

/** 打开一条连接两点的航道（先横后竖或先竖后横的折线，带宽度） */
export function lightCorridor(state: GameState, ax: number, ay: number, bx: number, by: number, xFirst: boolean): void {
  const w = M.corridorHalfWidth;
  const pts: [number, number][] = [];
  let x = ax;
  let y = ay;
  pts.push([x, y]);
  const stepX = () => {
    while (x !== bx) {
      x += Math.sign(bx - x);
      pts.push([x, y]);
    }
  };
  const stepY = () => {
    while (y !== by) {
      y += Math.sign(by - y);
      pts.push([x, y]);
    }
  };
  if (xFirst) {
    stepX();
    stepY();
  } else {
    stepY();
    stepX();
  }
  for (const [px, py] of pts) for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) light(state, px + dx, py + dy);
}

export function seenIdx(state: GameState, x: number, y: number): number {
  return y * state.width + x;
}

export function isSeen(state: GameState, x: number, y: number): boolean {
  return state.seen[seenIdx(state, x, y)] === 1;
}

/** 标记视野并发现附近岛屿（只发现已解锁、位于可探索海域里的岛），返回新发现的岛 */
export function look(state: GameState): Island[] {
  const { x, y } = state.player;
  const r = M.seenRadius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (isLit(state, nx, ny)) state.seen[seenIdx(state, nx, ny)] = 1;
    }
  }
  const found: Island[] = [];
  for (const i of state.islands) {
    if (i.discovered || !i.revealed) continue;
    if (!isLit(state, i.x, i.y)) continue;
    if (Math.max(Math.abs(i.x - x), Math.abs(i.y - y)) <= M.discoverRadius) {
      i.discovered = true;
      found.push(i);
    }
  }
  return found;
}

/** 在可通行区域内 BFS 寻路（四方向），返回步数序列；用于测试和脚本玩家 */
export function findPath(
  state: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): { dx: number; dy: number }[] | null {
  const W = state.width;
  const H = state.height;
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
      if (!canEnter(state, nx, ny)) continue;
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
