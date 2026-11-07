// 欢迎页的小画：夜里的雾海、灯塔和木筏（用同一套程序精灵，按夜晚调色板画）。
import { allSprites, px, stamp } from '../../art/draw';
import { BAYER, fbm } from '../../art/noise';
import { pal } from '../../art/palette';

export function paintCover(cv: HTMLCanvasElement): void {
  const c = cv.getContext('2d');
  if (!c) return;
  const W = cv.width;
  const H = cv.height;
  const P = pal('dusk');
  const S = allSprites();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = fbm(x / 20, y / 6, 9);
      px(c, P, y > 52 ? (n > 0.6 ? 'd2' : 'd1') : n > 0.55 ? 'd1' : 'd0', x, y);
      const fog = (1 - y / 52) * 0.9 + (fbm(x / 26, y / 9, 4) - 0.5) * 0.8;
      if (y < 60 && fog > 0.3 + (BAYER[((y & 3) << 2) | (x & 3)] / 16) * 0.5) px(c, P, fog > 0.7 ? 'fog2' : 'fog1', x, y);
    }
  for (let x = 120; x < 230; x++) {
    const top = 64 - Math.round(Math.sin(((x - 120) / 110) * Math.PI) * 10);
    for (let y = top; y < 72; y++) px(c, P, y === top ? 'gr3' : y < top + 3 ? 'gr2' : 'sa2', x, y);
  }
  stamp(c, S.light, 196, 66, P);
  stamp(c, S.stree, 150, 64, P);
  stamp(c, S.tree, 168, 62, P);
  stamp(c, S.raft, 60, 80, P);
  px(c, P, 'foam', 40, 80, 6, 1);
  px(c, P, 'foam', 76, 81, 5, 1);
}
