// 农田围栏：画成几段按底边排序的精灵（不画进地面），人物站在围栏后面时会被挡住。
// 挡路的范围在 world/island.ts 的 fenceRects，两边要对齐。
import { allSprites, mkCanvas, px, stamp } from '../../art/draw';
import { DAY } from '../../art/palette';
import type { MapTemplate } from '../../config/maps';

export interface FencePiece {
  canvas: HTMLCanvasElement;
  /** 画布左上角（世界坐标） */
  x: number;
  y: number;
  /** 排序用的底边 y */
  depth: number;
}

/** 一段横向围栏：两条横杆 + 每 10 像素一根桩 */
function rail(x0: number, x1: number, base: number): FencePiece {
  const post = allSprites().post;
  const w = x1 - x0 + post.w + 2;
  const h = post.h + 2;
  const cv = mkCanvas(w, h);
  const c = cv.getContext('2d')!;
  const ox = x0 - (post.w >> 1) - 1;
  const oy = base - post.h;
  for (const ry of [base - 9, base - 5]) {
    px(c, DAY, 'w2', x0 - ox, ry - oy, x1 - x0, 1);
    px(c, DAY, 'w0', x0 - ox, ry + 1 - oy, x1 - x0, 1);
  }
  for (let x = x0; x <= x1; x += 10) stamp(c, post, x - ox, base - oy, DAY);
  return { canvas: cv, x: ox, y: oy, depth: base };
}

function postAt(x: number, base: number): FencePiece {
  const post = allSprites().post;
  const cv = mkCanvas(post.w, post.h);
  stamp(cv.getContext('2d')!, post, post.w >> 1, post.h - 1, DAY);
  return { canvas: cv, x: x - (post.w >> 1), y: base - post.h + 1, depth: base };
}

export function fencePieces(t: MapTemplate): FencePiece[] {
  const F = t.field;
  if (!F) return [];
  const out = [rail(F.x0, F.x1, F.y0), rail(F.x0, F.x1, F.y1 + 2)];
  for (let y = F.y0 + 10; y < F.y1; y += 10) out.push(postAt(F.x0, y), postAt(F.x1, y));
  return out;
}
