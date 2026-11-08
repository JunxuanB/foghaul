// 岛屿地图生成（纯 TS，不依赖 Phaser / DOM）：规则层用 layout 判断“人物在不在东西旁边”，
// 画面层用 raster 画地形和做碰撞。同一个模板 + 种子结果永远一样。
import { OBJ_DEFS, type ObjKind, type RelRect } from '../config/buildings';
import type { MapTemplate } from '../config/maps';
import { templateFor } from './templates';
import { fbm, hash } from '../art/noise';
import { BALANCE } from '../config/balance';

export const TILE = 16;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldObj {
  /** 在这张图里唯一：精灵名#序号 */
  id: string;
  kind: ObjKind;
  sprite: string;
  /** 底边中点 */
  x: number;
  y: number;
  foot: Rect | null;
  hit: Rect | null;
}

export interface Layout {
  template: MapTemplate;
  /** 像素尺寸 */
  pw: number;
  ph: number;
  objects: WorldObj[];
  spawn: [number, number];
  dock: Rect | null;
  /** 木筏停靠位置（底边中点） */
  raftAt: [number, number] | null;
}

/** 地形类别 */
/** 木筏停靠处的水深（高度低于 -RAFT_DEPTH 才算够深，不压在浪花上） */
const RAFT_DEPTH = 10;

export const T = { deep: 0, mid: 1, surf: 2, sand: 3, grass: 4, path: 5, field: 6 } as const;

const seedOf = (t: MapTemplate, seed: number) => (t.island.seed * 131 + (Math.abs(seed | 0) % 9973)) | 0;

/** 岛的高度：海岸为 0，海里为负 */
export function heightAt(t: MapTemplate, seed: number, x: number, y: number): number {
  const I = t.island;
  const n = (fbm(x / I.noiseScale, y / I.noiseScale, seedOf(t, seed)) - 0.5) * I.noise;
  const dx = (x - I.cx) / I.rx;
  const dy = (y - I.cy) / I.ry;
  return (1 - Math.sqrt(dx * dx + dy * dy)) * I.k + n;
}

const abs = (x: number, y: number, r: RelRect | undefined): Rect | null => (r ? { x: x + r.x, y: y + r.y, w: r.w, h: r.h } : null);

const layouts = new Map<string, Layout>();

export function layout(id: string, seed: number): Layout {
  const key = id + ':' + seed;
  const hit = layouts.get(key);
  if (hit) return hit;
  const t = templateFor(id);
  if (!t) throw new Error('no map template ' + id);
  const objects: WorldObj[] = [];
  const count: Record<string, number> = {};
  const add = (sprite: string, x: number, y: number) => {
    const def = OBJ_DEFS[sprite];
    const n = (count[sprite] = (count[sprite] ?? 0) + 1);
    objects.push({
      id: `${sprite}#${n}`,
      kind: def?.kind ?? 'decor',
      sprite,
      x,
      y,
      foot: abs(x, y, def?.foot),
      hit: abs(x, y, def?.hit ?? def?.foot),
    });
  };
  for (const [s, x, y] of t.objects) add(s, x, y);

  // 浅滩钓点：从中心朝目标方向走到岸外
  if (t.shoal) {
    const { cx, cy } = t.island;
    const dx = t.shoal.x - cx;
    const dy = t.shoal.y - cy;
    const L = Math.hypot(dx, dy);
    let k = 0.3;
    while (k < 2 && heightAt(t, seed, cx + (dx / L) * L * k, cy + (dy / L) * L * k) > -t.shoal.out) k += 0.005;
    add('shoal', Math.round(cx + dx * k), Math.round(cy + dy * k) + 6);
  }

  let dock: Rect | null = null;
  let raftAt: [number, number] | null = null;
  if (t.dock) {
    const d = t.dock;
    dock = { x: d.x - (d.w >> 1), y: d.y, w: d.w, h: d.len };
    objects.push({ id: 'dock#1', kind: 'dock', sprite: '', x: d.x, y: d.y + d.len, foot: null, hit: { ...dock } });
    // 木筏停在码头旁边、刚过浪花的水里（太靠外会在外圈的雾里看不见）
    const rx = d.x + (d.w >> 1) + 22;
    let ry = d.y;
    while (ry < d.y + d.len - 2 && heightAt(t, seed, rx, ry - 14) > -RAFT_DEPTH) ry += 2;
    raftAt = [rx, Math.min(d.y + d.len - 2, ry)];
  }
  const out: Layout = { template: t, pw: t.w * TILE, ph: t.h * TILE, objects, spawn: t.spawn, dock, raftAt };
  layouts.set(key, out);
  return out;
}

const spotCache = new Map<string, [number, number][]>();

/**
 * 某种采集点能长在哪些位置（底边中点）：在模板的区域里、草地上、离小路 / 农田 / 固定物体 / 出生点 / 码头够远。
 * 纯函数、按种子缓存；具体今天长在哪几个位置由规则层用存档的随机数挑（sim/forage.ts）。
 */
export function forageSpots(id: string, seed: number, kind: 'tree' | 'herb'): [number, number][] {
  const key = id + ':' + seed + ':' + kind;
  const hit = spotCache.get(key);
  if (hit) return hit;
  const L = layout(id, seed);
  const t = L.template;
  const B = BALANCE.forage;
  const out: [number, number][] = [];
  const zones = t.forage[kind];
  const sp = B.spacing[kind];
  for (let y = B.grid; y < L.ph - B.grid; y += B.grid)
    for (let x = B.grid; x < L.pw - B.grid; x += B.grid) {
      // 网格点轻微错开，看起来不那么整齐
      const jx = x + Math.round((hashXY(x, y, 1) - 0.5) * B.grid * 0.6);
      const jy = y + Math.round((hashXY(x, y, 2) - 0.5) * B.grid * 0.6);
      if (!zones.some((z) => Math.hypot(jx - z.cx, jy - z.cy) <= z.r)) continue;
      // 树干下面要是结实的草地（离海岸够远）
      if (heightAt(t, seed, jx, jy) < (kind === 'tree' ? 22 : 18)) continue;
      let pd = Infinity;
      for (const P of t.paths) for (let k = 0; k < P.length - 1; k++) pd = Math.min(pd, segDist(jx, jy, P[k][0], P[k][1], P[k + 1][0], P[k + 1][1]));
      if (pd < t.pathWidth + B.keepClear.path) continue;
      const F = t.field;
      if (F && jx > F.x0 - 16 && jx < F.x1 + 16 && jy > F.y0 - 20 && jy < F.y1 + 16) continue;
      if (Math.hypot(jx - L.spawn[0], jy - L.spawn[1]) < B.keepClear.spawn) continue;
      if (L.dock && rectDist(jx, jy, L.dock) < B.keepClear.spawn) continue;
      if (L.objects.some((o) => (o.foot ? rectDist(jx, jy, o.foot) : Math.hypot(o.x - jx, o.y - jy)) < sp)) continue;
      // 也避开跟着存档出现的东西的位置（人、灯塔、设施、工作台、储物箱、请求板）
      if (slotPoints(t).some(([x, y]) => Math.hypot(x - jx, y - jy) < sp + 10)) continue;
      out.push([jx, jy]);
    }
  spotCache.set(key, out);
  return out;
}

const hashXY = (x: number, y: number, s: number) => hash(x, y, 300 + s);

/** 模板里所有槽位的位置 */
export function slotPoints(t: MapTemplate): [number, number][] {
  const S = t.slots;
  if (!S) return [];
  const out: [number, number][] = [];
  for (const [k, v] of Object.entries(S)) {
    if (!v) continue;
    if (k === 'npc') out.push(...(v as [number, number][]));
    else out.push(v as [number, number]);
  }
  return out;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  let s = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  return Math.hypot(px - ax - s * dx, py - ay - s * dy);
}

export interface Raster {
  w: number;
  h: number;
  /** 每像素的地形类别（T） */
  cls: Uint8Array;
  hgt: Float32Array;
  /** 离小路的距离 */
  pd: Float32Array;
  /** 1 = 能走（陆地、码头，且不在物体底座里） */
  walk: Uint8Array;
  /** 16 像素一格的可走记录（整格都能走才算），给寻路和以后的存档用 */
  tiles: Uint8Array;
  /** 外圈雾的浓度 0–1 */
  fog: Float32Array;
}

const rasters = new Map<string, Raster>();

export function raster(id: string, seed: number): Raster {
  const key = id + ':' + seed;
  const hit = rasters.get(key);
  if (hit) return hit;
  const L = layout(id, seed);
  const t = L.template;
  const W = L.pw;
  const H = L.ph;
  const cls = new Uint8Array(W * H);
  const hgt = new Float32Array(W * H);
  const pd = new Float32Array(W * H);
  const walk = new Uint8Array(W * H);
  const fog = new Float32Array(W * H);
  const F = t.field;
  const I = t.island;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x + 0.5;
      const sy = y + 0.5;
      const i = y * W + x;
      const v = heightAt(t, seed, sx, sy);
      hgt[i] = v;
      pd[i] = 99;
      let c: number;
      if (v < -34) c = T.deep;
      else if (v < -10) c = T.mid;
      else if (v < 0) c = T.surf;
      else if (v < 12) c = T.sand;
      else {
        c = T.grass;
        let m = 1e9;
        for (const P of t.paths) for (let k = 0; k < P.length - 1; k++) m = Math.min(m, segDist(sx, sy, P[k][0], P[k][1], P[k + 1][0], P[k + 1][1]));
        pd[i] = m;
        if (m < t.pathWidth) c = T.path;
        else if (F && sx >= F.x0 && sx < F.x1 && sy >= F.y0 && sy < F.y1) c = T.field;
      }
      cls[i] = c;
      walk[i] = c >= T.sand ? 1 : 0;
      const ex = (sx - I.cx) / I.rx;
      const ey = (sy - I.cy) / I.ry;
      const r = Math.sqrt(ex * ex + ey * ey);
      const [a, b] = t.fog;
      fog[i] = r <= a ? 0 : r >= b ? 1 : (r - a) / (b - a);
    }
  if (L.dock) fill(walk, W, H, L.dock, 1);
  for (const o of L.objects) if (o.foot) fill(walk, W, H, o.foot, 0);
  for (const r of fenceRects(t)) fill(walk, W, H, r, 0);
  const TW = t.w;
  const TH = t.h;
  const tiles = new Uint8Array(TW * TH);
  for (let ty = 0; ty < TH; ty++)
    for (let tx = 0; tx < TW; tx++) {
      let all = 1;
      for (let y = ty * TILE; y < ty * TILE + TILE && all; y++) for (let x = tx * TILE; x < tx * TILE + TILE; x++) if (!walk[y * W + x]) { all = 0; break; }
      tiles[ty * TW + tx] = all;
    }
  const out: Raster = { w: W, h: H, cls, hgt, pd, walk, tiles, fog };
  rasters.set(key, out);
  return out;
}

/** 农田围栏挡路的部分（和 game/world/terrain.ts 里画的围栏对齐） */
export function fenceRects(t: MapTemplate): Rect[] {
  const F = t.field;
  if (!F) return [];
  const w = F.x1 - F.x0;
  // 上边：从下面那条横杆到桩脚都挡（人物从北边过来时站在围栏后面，被围栏挡住）
  return [
    { x: F.x0 - 3, y: F.y0 - 6, w: w + 6, h: 7 },
    { x: F.x0 - 3, y: F.y1 - 4, w: w + 6, h: 7 },
    { x: F.x0 - 3, y: F.y0 - 6, w: 6, h: F.y1 - F.y0 + 9 },
    { x: F.x1 - 3, y: F.y0 - 6, w: 6, h: F.y1 - F.y0 + 9 },
  ];
}

function fill(a: Uint8Array, W: number, H: number, r: Rect, v: number): void {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(W, Math.ceil(r.x + r.w));
  const y1 = Math.min(H, Math.ceil(r.y + r.h));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * W + x] = v;
}

/** 人物脚下的碰撞框（相对脚底中点） */
export const FEET = { x: -4, y: -3, w: 8, h: 3 };

/** 脚底中点在 (x, y) 时能不能站 */
export function canStand(r: Raster, x: number, y: number): boolean {
  const x0 = Math.floor(x + FEET.x);
  const y0 = Math.floor(y + FEET.y);
  for (let yy = y0; yy < y0 + FEET.h; yy++)
    for (let xx = x0; xx < x0 + FEET.w; xx++) {
      if (xx < 0 || yy < 0 || xx >= r.w || yy >= r.h) return false;
      if (!r.walk[yy * r.w + xx]) return false;
    }
  return true;
}

/** 点到矩形的距离（在矩形里为 0） */
export function rectDist(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
