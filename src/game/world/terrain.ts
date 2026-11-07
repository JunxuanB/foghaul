// 把岛屿地形画成一张白天调色板的大图（地面、小路、农田、码头、草丛小花、贝壳）。
// 浪花和水面闪光会动，另画（见 water.ts）。
import { allSprites, mkCanvas, px, stamp } from '../../art/draw';
import { hash, vn } from '../../art/noise';
import { DAY, rgb, type Pal } from '../../art/palette';
import { T, type Layout, type Raster } from '../../world/island';

export function paintTerrain(L: Layout, R: Raster, P: Pal = DAY): HTMLCanvasElement {
  const W = R.w;
  const H = R.h;
  const cv = mkCanvas(W, H);
  const ctx = cv.getContext('2d')!;
  const id = ctx.createImageData(W, H);
  const D = id.data;
  const C: Record<string, [number, number, number]> = {};
  for (const k of ['d0', 'd1', 'd2', 'h0', 'h1', 'h2', 'sa0', 'sa1', 'sa2', 'sa3', 'gr0', 'gr1', 'gr2', 'gr3', 'pa0', 'pa1', 'pa2', 'so0', 'so1', 'so2'])
    C[k] = rgb(P[k] as string);
  const F = L.template.field;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = R.hgt[i];
      const r = hash(x, y, 5);
      let col: [number, number, number];
      switch (R.cls[i]) {
        case T.deep: {
          const q = vn(x / 14, y / 3.2, 21);
          col = q > 0.73 ? C.d2 : q < 0.18 ? C.d0 : C.d1;
          break;
        }
        case T.mid:
          col = v > -18 ? C.h2 : v > -27 ? C.h1 : C.h0;
          if (vn(x / 12, y / 3, 22) > 0.8) col = v > -18 ? C.h1 : C.h2;
          break;
        case T.surf:
          col = C.h2;
          break;
        case T.sand: {
          if (v < 2.5) col = C.sa1;
          else {
            const rip = Math.sin(x * 0.28 + y * 1.05 + vn(x / 10, y / 10, 23) * 6);
            col = rip > 0.86 ? C.sa1 : r > 0.975 ? C.sa3 : r < 0.02 ? C.sa0 : C.sa2;
          }
          break;
        }
        case T.grass: {
          if (v < 13.4) col = C.gr0;
          else {
            const q = vn(x / 9, y / 9, 11);
            col = q < 0.28 ? C.gr1 : q > 0.72 ? C.gr3 : C.gr2;
            if (r < 0.03) col = C.gr3;
            else if (r > 0.975) col = C.gr1;
          }
          break;
        }
        case T.path: {
          const pd = R.pd[i];
          col = pd > 4.4 ? C.pa0 : r < 0.1 ? C.pa1 : C.pa2;
          if (pd <= 4.4 && r > 0.985) col = C.pa0;
          break;
        }
        default: {
          // 农田空地（还没开垦）：冷色的垄
          const ry = F ? (y - F.y0) % 8 : 0;
          col = ry < 2 ? C.gr1 : ry < 5 ? C.pa0 : C.gr0;
          if (r > 0.97) col = C.gr2;
        }
      }
      const j = i * 4;
      D[j] = col[0];
      D[j + 1] = col[1];
      D[j + 2] = col[2];
      D[j + 3] = 255;
    }
  ctx.putImageData(id, 0, 0);

  // 草丛、小花、贝壳（避开物体）
  const boxes = L.objects.filter((o) => o.foot).map((o) => o.foot!);
  for (let cy = 0; cy < H; cy += 10)
    for (let cx = 0; cx < W; cx += 10) {
      const x = cx + Math.floor(hash(cx, cy, 41) * 8);
      const y = cy + Math.floor(hash(cx, cy, 42) * 8);
      if (y + 3 >= H) continue;
      const c = R.cls[y * W + x];
      const rr = hash(cx, cy, 43);
      if (boxes.some((b) => x >= b.x - 6 && x < b.x + b.w + 6 && y >= b.y - 10 && y < b.y + b.h + 4)) continue;
      if (R.cls[(y + 3) * W + x] !== c) continue;
      if (c === T.grass && R.hgt[y * W + x] > 16) {
        // 草丛稀疏一些，小花更少（暖色只给人造的东西和火光）
        if (rr > 0.42) continue;
        if (rr < 0.36) {
          px(ctx, P, 'gr3', x + 2, y);
          px(ctx, P, 'gr3', x + 1, y + 1);
          px(ctx, P, 'gr3', x + 3, y + 1);
          px(ctx, P, 'gr0', x, y + 2);
          px(ctx, P, 'gr0', x + 2, y + 2);
          px(ctx, P, 'gr0', x + 4, y + 2);
        } else {
          const fc = ['fv', 'fw', 'fv', 'fr'][(hash(cx, cy, 44) * 4) | 0];
          px(ctx, P, 'l1', x + 1, y + 2);
          px(ctx, P, fc, x + 1, y);
          px(ctx, P, fc, x, y + 1);
          px(ctx, P, fc, x + 2, y + 1);
          px(ctx, P, fc === 'fr' ? 'fy' : 'fw', x + 1, y + 1);
        }
      } else if (c === T.sand && rr < 0.16 && R.hgt[y * W + x] > 3) {
        px(ctx, P, 'fw', x, y, 2, 1);
        px(ctx, P, 'sa0', x + 2, y);
        px(ctx, P, 'sa0', x, y + 1, 2, 1);
      }
    }

  // 码头：木板、桩、外框
  if (L.dock) {
    const { x: x0, y: y0, w, h } = L.dock;
    const x1 = x0 + w;
    const y1 = y0 + h;
    for (let y = y0; y < y1; y++) {
      const k = (y - y0) % 5;
      px(ctx, P, k === 4 ? 'w0' : k === 0 ? 'w3' : 'w2', x0, y, w, 1);
      if (k !== 4 && hash(1, y, 51) < 0.3) px(ctx, P, 'w1', x0 + 2 + Math.floor(hash(2, y, 51) * (w - 4)), y);
    }
    px(ctx, P, 'o', x0 - 1, y0, 1, h + 1);
    px(ctx, P, 'o', x1, y0, 1, h + 1);
    px(ctx, P, 'w1', x0, y1, w, 2);
    px(ctx, P, 'w0', x0, y1 + 2, w, 1);
    px(ctx, P, 'o', x0 - 1, y1 + 3, w + 2, 1);
    for (const p of [y0 + 20, y0 + 44, y1 - 6]) {
      for (const sx of [x0 - 3, x1]) {
        px(ctx, P, 'w1', sx, p, 3, 7);
        px(ctx, P, 'w0', sx + 2, p, 1, 7);
        px(ctx, P, 'o', sx - 1, p + 7, 5, 1);
      }
    }
  }

  // 农田空地的围栏
  if (F) {
    const post = allSprites().post;
    const rail = (y: number) => {
      px(ctx, P, 'w2', F.x0, y, F.x1 - F.x0, 1);
      px(ctx, P, 'w0', F.x0, y + 1, F.x1 - F.x0, 1);
    };
    rail(F.y0 - 9);
    rail(F.y0 - 5);
    for (let x = F.x0; x <= F.x1; x += 10) stamp(ctx, post, x, F.y0, P);
    for (let y = F.y0 + 10; y < F.y1; y += 10) {
      stamp(ctx, post, F.x0, y, P);
      stamp(ctx, post, F.x1, y, P);
    }
    rail(F.y1 - 7);
    rail(F.y1 - 3);
    for (let x = F.x0; x <= F.x1; x += 10) stamp(ctx, post, x, F.y1 + 2, P);
  }
  return cv;
}

/** 浪花和闪光要用的海岸像素、深水点 */
export function waterFx(R: Raster, L: Layout): { surf: Float32Array; glints: Float32Array } {
  const W = R.w;
  const surf: number[] = [];
  const dock = L.dock;
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = R.hgt[i];
      if (R.cls[i] > T.surf || v <= -10) continue;
      if (dock && x >= dock.x - 4 && x <= dock.x + dock.w + 4 && y >= dock.y - 2 && y <= dock.y + dock.h + 4) continue;
      surf.push(x, y, v, vn(x / 7, y / 7, 71));
    }
  const glints: number[] = [];
  const want = Math.round((R.w * R.h) / 2200);
  for (let k = 0; glints.length / 3 < want && k < 20000; k++) {
    const x = 4 + Math.floor(hash(k, 1, 33) * (W - 8));
    const y = 4 + Math.floor(hash(k, 2, 33) * (R.h - 8));
    const i = y * W + x;
    if (R.cls[i] <= T.mid && R.hgt[i] < -14) glints.push(x, y, hash(k, 3, 33));
  }
  return { surf: Float32Array.from(surf), glints: Float32Array.from(glints) };
}
