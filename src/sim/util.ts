import { ITEMS, type ItemId } from '../config/items';
import type { GameState, Island, Person, Stock } from './types';

export function stockGet(s: Stock, id: ItemId): number {
  return s[id] ?? 0;
}

export function stockAdd(s: Stock, id: ItemId, n: number): void {
  const v = (s[id] ?? 0) + n;
  if (v <= 0) delete s[id];
  else s[id] = v;
}

export function stockTotal(s: Stock): number {
  let t = 0;
  for (const v of Object.values(s)) t += v ?? 0;
  return t;
}

/** 不计飞机零件的总量（零件不占容量） */
export function stockLoad(s: Stock): number {
  let t = 0;
  for (const [k, v] of Object.entries(s)) if (!ITEMS[k as ItemId].key) t += v ?? 0;
  return t;
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function euclid(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

const DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

/** 方向：箭头 + 词典键 dir.* */
export function dirOf(dx: number, dy: number): { arrow: string; key: string } {
  if (dx === 0 && dy === 0) return { arrow: '·', key: 'dir.here' };
  const a = Math.atan2(dy, dx);
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return { arrow: ARROWS[i], key: 'dir.' + DIRS[i] };
}

export function island(state: GameState, id: string): Island {
  const i = state.islands.find((x) => x.id === id);
  if (!i) throw new Error('no island ' + id);
  return i;
}

export function findIsland(state: GameState, id: string | null | undefined): Island | undefined {
  if (!id) return undefined;
  return state.islands.find((x) => x.id === id);
}

export function person(state: GameState, id: string): Person {
  const p = state.people.find((x) => x.id === id);
  if (!p) throw new Error('no person ' + id);
  return p;
}

export function islandAt(state: GameState, x: number, y: number): Island | undefined {
  return state.islands.find((i) => i.x === x && i.y === y);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
