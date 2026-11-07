// 程序美术用的确定性噪声（从设计稿 B 移植）。和玩法随机无关：玩法随机只用 sim/rng.ts。

export const mod = (a: number, n: number): number => ((a % n) + n) % n;

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 整数坐标 + 种子 → [0, 1) */
export function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 值噪声；p 为周期（可平铺） */
export function vn(x: number, y: number, s: number, p?: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = (q: number) => (p ? mod(q, p) : q);
  const a = hash(w(xi), w(yi), s);
  const b = hash(w(xi + 1), w(yi), s);
  const c = hash(w(xi), w(yi + 1), s);
  const d = hash(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, s: number, p?: number): number {
  return vn(x, y, s, p) * 0.57 + vn(x * 2, y * 2, s + 7, p && p * 2) * 0.29 + vn(x * 4, y * 4, s + 13, p && p * 4) * 0.14;
}

/** 4 × 4 Bayer 矩阵：雾、灯光边缘、时段过渡共用 */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayerAt = (x: number, y: number): number => BAYER[((y & 3) << 2) | (x & 3)];
