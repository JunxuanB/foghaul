// 灯光遮罩：实心圆 + 外圈棋盘格，加灯塔光束。画在屏幕坐标的 480 × 270 canvas 上。
import { LIGHTS } from '../../config/visual';
import { mod } from '../../art/noise';

export type Spot = [x: number, y: number, r: number];
export type Beam = [x: number, y: number, len: number, angle: number, halfWidth: number];

/** 遮罩画布比画面大 1 像素（着色器按镜头的小数偏移读） */
export function paintMask(img: ImageData, spots: Spot[], beams: Beam[]): void {
  const W = img.width;
  const H = img.height;
  const u = new Uint32Array(img.data.buffer);
  const ON = 0xffffffff;
  u.fill(0);
  for (const [cx, cy, r] of spots) {
    if (r < 1) continue;
    const R = r + LIGHTS.edge;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++)
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < r || (d < R && ((x + y) & 1) === 0)) u[y * W + x] = ON;
      }
  }
  for (const [cx, cy, L, a, hw] of beams) {
    const pts = [
      [cx, cy],
      [cx + Math.cos(a - hw) * L, cy + Math.sin(a - hw) * L],
      [cx + Math.cos(a + hw) * L, cy + Math.sin(a + hw) * L],
      [cx + Math.cos(a) * L, cy + Math.sin(a) * L],
    ];
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d > L) continue;
        const diff = Math.abs(mod(Math.atan2(dy, dx) - a + Math.PI, Math.PI * 2) - Math.PI);
        if (diff < hw && (d < L * 0.55 || ((x + y) & 1) === 0)) u[y * W + x] = ON;
      }
  }
}
