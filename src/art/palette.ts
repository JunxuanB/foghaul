// 调色板与时段（从设计稿 B 移植）。精灵里的“角色名”= 材质 + 明暗档 0–3，或 iN = 直接用 N 号色。
import { PALETTE, PHASES, PHASE_KEYS, PHASE_TRANSITION_MINUTES, type PhaseId } from '../config/visual';
import { mod } from './noise';

export const BR: readonly string[] = PALETTE;

const idxMap = (s: string): Record<string, number> => {
  const m: Record<string, number> = {};
  s.trim()
    .split(/\s+/)
    .forEach((t) => {
      const [k, v] = t.split(':');
      m[k] = +v;
    });
  return m;
};

/** 角色名 → 白天调色板里的色号 */
export const BI = idxMap(`d0:1 d1:2 d2:3 h0:3 h1:3 h2:4 foam:6 glint:5 sa0:5 sa1:5 sa2:6 sa3:6 gr0:3 gr1:3 gr2:4 gr3:5 pa0:3 pa1:6 pa2:5 so0:1 so1:8 so2:9
 ro0:2 ro1:3 ro2:4 ro3:5 line:3 smoke:6 fog1:5 fog2:6 o:1 w0:1 w1:8 w2:9 w3:10 r0:1 r1:8 r2:9 r3:10 c0:4 c1:5 c2:6 c3:7 s0:2 s1:3 s2:4 s3:5
 l0:1 l1:2 l2:3 l3:4 m0:3 m1:4 m2:6 m3:7 g0:2 g1:4 g2:6 x0:8 x1:9 x2:10 e0:4 e1:5 e2:6 e3:7 k0:9 k1:10 a0:1 a1:8 u0:1 u1:2 u2:3 p0:0 p1:1
 n0:5 n1:6 n2:7 q0:8 q1:10 q2:11 fr:9 fy:11 fv:4 fw:7 y0:10 y1:11 f0:10 f1:11 hl:11`);

/** 棋盘格影子：只在 (x + y) 为偶数的像素上画 on 色 */
export interface Checker {
  k: 'chk';
  on: string;
}
export type PalColor = string | Checker;
export type Pal = Record<string, PalColor> & { _t?: number[] };

/** 亮着但没去过的海域：整体降一档（出海时用） */
export const UNSEEN = [0, 0, 1, 2, 3, 4, 5, 6, 8, 8, 9, 10];

const cache: Record<string, Pal> = {};

/** 某个时段（可加 `_u` 表示“未探索”）的角色 → 颜色表 */
export function pal(key: string): Pal {
  if (cache[key]) return cache[key];
  const [ph, variant] = key.split('_');
  let t = PHASES[ph as PhaseId].t;
  if (variant === 'u') t = UNSEEN.map((i) => t[i]);
  const p: Pal = {};
  for (const k in BI) p[k] = BR[t[BI[k]]];
  for (let n = 0; n < 12; n++) p['i' + n] = BR[t[n]];
  p.z = { k: 'chk', on: BR[t[2]] };
  p._t = t;
  return (cache[key] = p);
}

export const DAY = pal('day');

export interface PhaseMix {
  /** 当前时段与下一个时段 */
  a: PhaseId;
  b: PhaseId;
  /** 过渡进度 0–1 */
  m: number;
  /** 灯光强度 */
  s: number;
}

/** 当天第 min 分钟的视觉时段 */
export function phaseAt(min: number): PhaseMix {
  min = mod(min, 1440);
  const K = PHASE_KEYS;
  for (let k = 0; k < K.length; k++) {
    const [t, ph] = K[k];
    if (min >= t - PHASE_TRANSITION_MINUTES && min < t) {
      const prev = K[mod(k - 1, K.length)][1];
      const m = (min - (t - PHASE_TRANSITION_MINUTES)) / PHASE_TRANSITION_MINUTES;
      return { a: prev, b: ph, m, s: PHASES[prev].s * (1 - m) + PHASES[ph].s * m };
    }
  }
  let ph = K[K.length - 1][1];
  for (const [t, p] of K) if (min >= t) ph = p;
  return { a: ph, b: ph, m: 0, s: PHASES[ph].s };
}

export const rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
