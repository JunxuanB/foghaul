// 点阵雾（从设计稿 B 移植）：浓度 = 地图给的底色 + 两层飘动噪声，按 Bayer 阈值决定哪里有雾。
// 大部分是苔雾，噪声高的地方是海雾，所以雾里有一团团云影。
import { BAYER, fbm } from '../../art/noise';
import { DAY, rgb } from '../../art/palette';
import { FOG } from '../../config/visual';

const NT = new Float32Array(256 * 256);
let ntReady = false;
function noiseTable() {
  if (ntReady) return NT;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) NT[y * 256 + x] = fbm(x / 32, y / 32, 41, 8);
  ntReady = true;
  return NT;
}

const C1 = rgb(DAY.fog1 as string);
const C2 = rgb(DAY.fog2 as string);

/**
 * 把雾画进 img。mask 是地图上每像素的底色浓度（0–1），mw、mh 为地图大小，
 * (cx, cy) 为画布左上角在地图上的坐标，t 为秒。返回画面里有没有雾。
 * 两层噪声朝同一个方向、以不同速度慢慢飘（反向飘动看久了会晕）。
 */
export function paintFog(img: ImageData, mask: Float32Array, mw: number, mh: number, cx: number, cy: number, t: number): boolean {
  const N = noiseTable();
  const W = img.width;
  const H = img.height;
  const d = img.data;
  const ox = t * FOG.driftX;
  const oy = t * FOG.driftY;
  let any = false;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wx = x + cx;
      const wy = y + cy;
      const j = (y * W + x) * 4;
      const m = wx >= 0 && wy >= 0 && wx < mw && wy < mh ? mask[wy * mw + wx] : 1;
      if (m <= 0) {
        d[j + 3] = 0;
        continue;
      }
      const a = N[((((wy + oy) | 0) & 255) << 8) | (((wx + ox) | 0) & 255)];
      const b = N[((((wy * 0.8 + oy * FOG.layer2 + 97) | 0) & 255) << 8) | (((wx * 0.8 + ox * FOG.layer2 + 31) | 0) & 255)];
      const nb = a + b - 1;
      const v = m * FOG.gain + nb * FOG.noise + FOG.bias;
      const bb = BAYER[((y & 3) << 2) | (x & 3)] / 16;
      if (v > FOG.on + bb * FOG.onBayer) {
        const c = nb > FOG.dense + bb * FOG.denseBayer ? C2 : C1;
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
        d[j + 3] = 255;
        any = true;
      } else d[j + 3] = 0;
    }
  return any;
}
