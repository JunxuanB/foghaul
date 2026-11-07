// 精灵构建器（从设计稿 B 移植）：在一张角色名网格上画形状，最后自动描 1 像素夜海色轮廓。
import { vn } from './noise';

/** 明暗档：d 越小越亮（光从左上来） */
export const sh4 = (d: number): number => (d < -0.45 ? 3 : d < 0.12 ? 2 : d < 0.55 ? 1 : 0);

export interface ShadeOpts {
  tex?: number;
  amp?: number;
  seed?: number;
  lo?: number;
  hi?: number;
  bias?: number;
  rot?: number;
}

export type Meta = Record<string, unknown>;

export class G {
  w: number;
  h: number;
  d: string[];
  meta: Meta = {};
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill('');
  }
  set(x: number, y: number, r: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = r;
    return this;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : '';
  }
  rect(x: number, y: number, w: number, h: number, r: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, r);
    return this;
  }
  ell(cx: number, cy: number, rx: number, ry: number, r: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, r);
      }
    return this;
  }
  /** 带明暗的椭圆：材质 mat + 档位 */
  ellS(cx: number, cy: number, rx: number, ry: number, mat: string, o: ShadeOpts = {}): this {
    const R = o.rot ? Math.max(rx, ry) : 0;
    const ca = Math.cos(o.rot || 0);
    const sa = Math.sin(o.rot || 0);
    for (let y = Math.floor(cy - (R || ry)); y <= Math.ceil(cy + (R || ry)); y++)
      for (let x = Math.floor(cx - (R || rx)); x <= Math.ceil(cx + (R || rx)); x++) {
        const dx0 = x + 0.5 - cx;
        const dy0 = y + 0.5 - cy;
        const nx = (dx0 * ca + dy0 * sa) / rx;
        const ny = (-dx0 * sa + dy0 * ca) / ry;
        if (nx * nx + ny * ny > 1) continue;
        let d = nx * 0.55 + ny * 0.85 + (o.bias || 0);
        if (o.tex) d += (vn(x / o.tex, y / o.tex, o.seed || 1) - 0.5) * (o.amp || 0.6);
        let i = sh4(d);
        if (o.lo != null) i = Math.max(o.lo, i);
        if (o.hi != null) i = Math.min(o.hi, i);
        this.set(x, y, mat + i);
      }
    return this;
  }
  /** 竖直圆柱：按列取明暗表 */
  cyl(x: number, y: number, w: number, h: number, mat: string, map: number[]): this {
    for (let i = 0; i < w; i++) {
      const s = map[Math.min(map.length - 1, Math.floor(((i + 0.5) / w) * map.length))];
      for (let j = 0; j < h; j++) this.set(x + i, y + j, mat + s);
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, r: string): this {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.set(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t), r);
    }
    return this;
  }
  /** 外轮廓 1 像素。`z`（影子）和 `~` 开头（埋在沙里、网眼）的不描 */
  outline(): this {
    const solid = (v: string) => !!v && v !== 'z' && v[0] !== '~';
    const o = this.d.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.d[y * this.w + x];
        if (v && v !== 'z') continue;
        if (solid(this.get(x - 1, y)) || solid(this.get(x + 1, y)) || solid(this.get(x, y - 1)) || solid(this.get(x, y + 1)))
          o[y * this.w + x] = 'o';
      }
    this.d = o;
    return this;
  }
}
