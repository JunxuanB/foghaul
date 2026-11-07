// 海面（纯 TS，不依赖 Phaser / DOM）：海图比例下每座岛是一块小陆地，周围一圈浅水。
// 规则层用它决定出海时木筏放在哪；画面层用它画海面和做木筏碰撞。
import { BALANCE } from '../config/balance';
import { SEA_ART } from '../config/visual';
import { fbm } from '../art/noise';

export interface SeaIsland {
  id: string;
  /** 海图格子坐标 */
  x: number;
  y: number;
  kind: string;
}

export interface SeaRaster {
  w: number;
  h: number;
  /** 每像素的高度：0 以上是陆地，越负越深 */
  hgt: Float32Array;
  /** 每像素属于哪座岛（islands 里的下标，-1 为远海） */
  own: Int8Array;
  islands: SeaIsland[];
}

const T = BALANCE.sail.tile;

/** 岛中心的像素坐标 */
export function islandCenter(i: SeaIsland): [number, number] {
  return [i.x * T + T / 2, i.y * T + T / 2];
}

export function islandSize(kind: string): { rx: number; ry: number } {
  return SEA_ART.island[kind] ?? SEA_ART.island.passenger;
}

/** 一座岛在 (x, y) 处的高度 */
function blob(i: SeaIsland, seed: number, x: number, y: number): number {
  const [cx, cy] = islandCenter(i);
  const { rx, ry } = islandSize(i.kind);
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const n = (fbm(x / 14, y / 14, (seed % 997) + i.x * 31 + i.y * 17) - 0.5) * SEA_ART.noise;
  return (1 - Math.sqrt(dx * dx + dy * dy)) * SEA_ART.k + n;
}

const cache = new Map<string, SeaRaster>();

/** 整片海面：只画已经出现（revealed）的岛。岛的集合变了就重新生成 */
export function seaRaster(islands: SeaIsland[], seed: number, wTiles: number, hTiles: number): SeaRaster {
  const key = seed + ':' + islands.map((i) => `${i.id}@${i.x},${i.y}`).join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const w = wTiles * T;
  const h = hTiles * T;
  const hgt = new Float32Array(w * h).fill(-60);
  const own = new Int8Array(w * h).fill(-1);
  islands.forEach((isl, k) => {
    const [cx, cy] = islandCenter(isl);
    const { rx, ry } = islandSize(isl.kind);
    const R = 2.2;
    for (let y = Math.max(0, Math.floor(cy - ry * R)); y < Math.min(h, Math.ceil(cy + ry * R)); y++)
      for (let x = Math.max(0, Math.floor(cx - rx * R)); x < Math.min(w, Math.ceil(cx + rx * R)); x++) {
        const v = blob(isl, seed, x + 0.5, y + 0.5);
        const i = y * w + x;
        if (v > hgt[i]) {
          hgt[i] = v;
          own[i] = k;
        }
      }
  });
  const out = { w, h, hgt, own, islands };
  cache.clear();
  cache.set(key, out);
  return out;
}

export function isLand(r: SeaRaster, x: number, y: number): boolean {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= r.w || yi >= r.h) return true;
  return r.hgt[yi * r.w + xi] >= 0;
}

/** (x, y) 离某座岛的陆地有多近（像素，粗略：沿 8 个方向找） */
export function nearLandOf(r: SeaRaster, x: number, y: number, maxDist: number): number {
  let best = -1;
  for (let d = 2; d <= maxDist; d += 2)
    for (let a = 0; a < 8; a++) {
      const px = Math.floor(x + Math.cos((a * Math.PI) / 4) * d);
      const py = Math.floor(y + Math.sin((a * Math.PI) / 4) * d);
      if (px < 0 || py < 0 || px >= r.w || py >= r.h) continue;
      const i = py * r.w + px;
      if (r.hgt[i] >= 0) return r.own[i];
    }
  return best;
}

/**
 * 出海时木筏放的位置：优先岛的正南方，离岸 launchGap 像素（高度系数和噪声保证那里是水）；
 * 南边不行（出了地图或在雾里，由 ok 判断）就依次试北、东、西。只用岛的位置和种类，规则层和画面层算出来一样。
 */
export function launchPoint(i: SeaIsland, ok: (x: number, y: number) => boolean = () => true): [number, number] {
  const [cx, cy] = islandCenter(i);
  const { rx, ry } = islandSize(i.kind);
  const g = SEA_ART.noise + BALANCE.sail.launchGap;
  const tries: [number, number][] = [
    [cx, cy + ry + g],
    [cx, cy - ry - g],
    [cx + rx + g, cy],
    [cx - rx - g, cy],
  ];
  return tries.find(([x, y]) => ok(x, y)) ?? tries[0];
}
