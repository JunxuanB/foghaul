// 程序生成的精灵（从设计稿 B 移植，另加工作台、储物箱、草药丛、浅滩钓点）。
// 所有精灵画在角色名网格上，颜色在绘制时按调色板查。
import { G, sh4 } from './grid';
import { hash, mod, vn } from './noise';

type Pt = [number, number];

export function spTree(seed: number, big: boolean): G {
  const w = big ? 36 : 28, h = big ? 48 : 38, cx = w / 2, gy = h - 4, g = new G(w, h);
  g.ell(cx, gy + 0.5, big ? 12 : 9, 2.8, 'z');
  const tw = big ? 6 : 4, tt = big ? 28 : 22;
  for (let y = tt; y <= gy; y++) {
    const fl = y >= gy - 1 ? 1 : 0, x0 = Math.round(cx - tw / 2) - fl, x1 = Math.round(cx + tw / 2) + fl;
    for (let x = x0; x < x1; x++) {
      const u = (x - x0 + 0.5) / (x1 - x0);
      let i = u < 0.3 ? 2 : u < 0.7 ? 1 : 0;
      if (hash(x, y, seed) < 0.14) i = Math.max(0, i - 1);
      g.set(x, y, 'w' + i);
    }
  }
  const B = big
    ? [[10, 27, 8, 7], [26, 27, 8, 7], [18, 20, 12, 10.5], [12, 13, 7, 6], [24, 13, 7, 6]]
    : [[8, 21, 6.5, 5.5], [20, 21, 6.5, 5.5], [14, 15, 9, 8], [14, 8, 6, 5]];
  for (const [bx, by, rx, ry] of B) g.ellS(bx, by, rx, ry, 'l', { tex: 2.4, amp: 0.8, seed });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g.get(x, y) === 'l2' && hash(x, y, seed + 5) < 0.06) g.set(x, y, 'l3');
  return g.outline();
}

export function spBush(seed: number): G {
  const g = new G(20, 15);
  g.ell(10, 13, 8, 2, 'z');
  g.ellS(6, 9, 5, 4, 'l', { tex: 2, amp: 0.7, seed });
  g.ellS(14, 9, 5, 4, 'l', { tex: 2, amp: 0.7, seed: seed + 1 });
  g.ellS(10, 7, 6, 5, 'l', { tex: 2, amp: 0.7, seed: seed + 2 });
  for (const [x, y] of [[6, 7], [12, 5], [14, 9], [8, 10]]) g.set(x, y, 'fr');
  return g.outline();
}

export function spPalm(): G {
  const g = new G(40, 58), gy = 54;
  g.ell(21, gy + 0.5, 8, 2.2, 'z');
  let tx = 0, ty = 0;
  for (let i = 0; i <= 32; i++) {
    const y = gy - i, x = 15 + Math.round(Math.sin((i / 32) * 1.35) * 6), ring = i % 3 === 0;
    for (let k = 0; k < 4; k++) {
      let s = [3, 2, 2, 1][k];
      if (ring) s = Math.max(0, s - 1);
      g.set(x + k, y, 'w' + s);
    }
    tx = x + 2;
    ty = y;
  }
  for (const [a, L] of [[-2.95, 14], [-2.45, 12], [-1.95, 10], [-1.25, 10], [-0.6, 12], [-0.12, 13], [0.5, 10]]) {
    const nx = -Math.sin(a), ny = Math.cos(a);
    for (let s = 1; s <= L; s += 0.5) {
      const t = s / L, x = tx + Math.cos(a) * s, y = ty + Math.sin(a) * s + s * s * 0.045, hw = Math.sin(t * Math.PI) * 2.4 + 0.4;
      for (let q = -hw; q <= hw; q += 0.5) {
        if (Math.abs(q) > hw - 0.6 && ((s * 2) | 0) % 2) continue;
        g.set(Math.floor(x + nx * q), Math.floor(y + ny * q), 'l' + (q * ny < 0 ? (t < 0.5 ? 3 : 2) : t < 0.5 ? 1 : 0));
      }
    }
  }
  g.ellS(tx - 1, ty + 2, 2, 1.8, 'w', { lo: 0, hi: 1 });
  g.ellS(tx + 2, ty + 2.5, 2, 1.8, 'w', { lo: 0, hi: 1 });
  return g.outline();
}

export function spHouse(): G {
  const g = new G(84, 80), gy = 76;
  g.ell(42, gy, 40, 3.4, 'z');
  for (let y = 0; y < 22; y++)
    for (let x = 56; x < 64; x++) {
      const row = Math.floor(y / 3), mort = y % 3 === 2 || mod(x - 56 + (row % 2) * 2, 4) === 0;
      g.set(x, y, 's' + (mort ? 0 : x < 58 ? 3 : x > 61 ? 1 : 2));
    }
  g.rect(55, 0, 10, 2, 's1');
  g.rect(55, 0, 10, 1, 's3');
  for (let y = 38; y < 66; y++)
    for (let x = 8; x < 76; x++) {
      const r = (y - 38) % 4;
      let i = r === 0 ? 3 : r === 3 ? 1 : 2;
      if (x >= 66) i = Math.max(0, i - 1);
      if (y < 44) i = Math.max(0, i - 2);
      g.set(x, y, 'c' + i);
    }
  g.cyl(8, 38, 3, 28, 'w', [2, 1, 0]);
  g.cyl(73, 38, 3, 28, 'w', [1, 0, 0]);
  for (let y = 66; y < 75; y++)
    for (let x = 6; x < 78; x++) {
      const row = Math.floor((y - 66) / 3), off = row % 2 ? 4 : 0, mort = (y - 66) % 3 === 2 || (x + off) % 8 === 0;
      let i = mort ? 0 : hash(Math.floor((x + off) / 8), row, 4) < 0.5 ? 2 : 1;
      if (!mort && (y - 66) % 3 === 0) i = Math.min(3, i + 1);
      g.set(x, y, 's' + i);
    }
  for (let y = 6; y < 40; y++) {
    const t = (y - 6) / 34, x0 = Math.round(16 - t * 14), x1 = Math.round(68 + t * 14), row = Math.floor((y - 6) / 5), ry = (y - 6) % 5, off = row % 2 ? 3 : 0;
    for (let x = x0; x < x1; x++) {
      let i;
      if (ry === 4) i = 0;
      else if ((x + off) % 6 === 0) i = 1;
      else i = ry === 0 ? 3 : 2;
      if (x >= x1 - 3 && i > 1) i = 1;
      g.set(x, y, 'r' + i);
    }
  }
  g.rect(15, 4, 55, 2, 'r1');
  g.rect(15, 4, 55, 1, 'r3');
  g.rect(35, 46, 14, 20, 'w0');
  for (let y = 47; y < 66; y++) for (let x = 36; x < 48; x++) g.set(x, y, (x - 36) % 4 === 3 ? 'w1' : (x - 36) % 4 === 0 ? 'w3' : 'w2');
  g.rect(36, 55, 12, 1, 'w1');
  g.rect(39, 49, 6, 3, 'g1');
  g.set(39, 49, 'g2');
  g.set(45, 58, 'y0');
  const flowers = ['fr', 'fy', 'fv', 'fw'];
  for (const wx of [14, 54]) {
    g.rect(wx, 45, 16, 13, 'w0');
    g.rect(wx + 1, 46, 14, 11, 'g1');
    for (let k = 0; k < 5; k++) g.set(wx + 2 + k, 47 + k, 'g2');
    g.set(wx + 3, 47, 'g2');
    g.rect(wx + 8, 46, 1, 11, 'w0');
    g.rect(wx + 1, 51, 14, 1, 'w0');
    g.cyl(wx - 4, 45, 4, 13, 'w', [3, 2, 2, 1]);
    g.cyl(wx + 16, 45, 4, 13, 'w', [2, 2, 1, 0]);
    for (let y = 47; y < 57; y += 2) {
      g.rect(wx - 4, y, 4, 1, 'w1');
      g.rect(wx + 16, y, 4, 1, 'w0');
    }
    g.rect(wx - 1, 58, 18, 3, 'w1');
    g.rect(wx - 1, 58, 18, 1, 'w2');
    g.rect(wx - 1, 60, 18, 1, 'w0');
    for (let k = 0; k < 8; k++) {
      const fx = wx + k * 2, fc = flowers[(hash(k, wx, 9) * 4) | 0];
      g.set(fx, 57, 'l2');
      g.set(fx + 1, 57, 'l1');
      g.set(fx, 56, fc);
    }
  }
  g.set(51, 42, 'm0');
  g.rect(50, 43, 3, 1, 'm0');
  g.rect(50, 44, 3, 3, 'y1');
  g.set(51, 45, 'y0');
  g.rect(50, 47, 3, 1, 'm0');
  g.rect(33, 71, 18, 4, 's2');
  g.rect(33, 71, 18, 1, 's3');
  g.rect(33, 74, 18, 1, 's0');
  g.meta = { win: [[15, 46, 14, 11], [55, 46, 14, 11]], chim: [60, -1], lantern: [51, 45], door: [42, 75] };
  return g.outline();
}

export function spLight(): G {
  const g = new G(34, 100), gy = 96, cx = 17;
  g.ell(cx + 1, gy + 0.5, 16, 3, 'z');
  g.ellS(cx, gy - 4, 15, 5.5, 's', { tex: 2.5, amp: 0.7, seed: 3 });
  g.ellS(5, gy - 3, 5, 4, 's', { tex: 2, amp: 0.5, seed: 4 });
  g.ellS(29, gy - 2, 5, 3.5, 's', { tex: 2, amp: 0.5, seed: 5 });
  for (let y = 26; y < gy - 4; y++) {
    const t = (y - 26) / (gy - 30), half = 7 + t * 4.5, x0 = Math.round(cx - half), x1 = Math.round(cx + half), band = Math.floor((y - 26) / 10) % 2;
    for (let x = x0; x < x1; x++) {
      const u = (x - x0 + 0.5) / (x1 - x0), i = u < 0.18 ? 3 : u < 0.55 ? 2 : u < 0.82 ? 1 : 0;
      g.set(x, y, band ? 'x' + [0, 1, 1, 2][i] : 'e' + i);
    }
  }
  for (const wy of [38, 60]) {
    g.rect(cx - 2, wy, 4, 6, 'w0');
    g.rect(cx - 1, wy + 1, 2, 4, 'g1');
    g.set(cx - 1, wy + 1, 'g2');
  }
  g.rect(cx - 4, 78, 8, 14, 'w0');
  for (let y = 79; y < 92; y++) for (let x = cx - 3; x < cx + 3; x++) g.set(x, y, (x - cx + 3) % 3 === 2 ? 'w1' : 'w2');
  g.set(cx + 1, 85, 'y0');
  g.rect(9, 8, 16, 14, 'm0');
  g.rect(10, 9, 14, 12, 'g1');
  for (let k = 0; k < 6; k++) g.set(11 + k, 9 + k, 'g2');
  g.rect(13, 11, 8, 7, 'y0');
  g.rect(15, 12, 4, 4, 'y1');
  g.rect(16, 9, 1, 12, 'm0');
  g.rect(3, 22, 28, 3, 'm0');
  g.rect(3, 22, 28, 1, 'm1');
  for (let x = 3; x < 31; x += 4) g.rect(x, 16, 1, 6, 'm0');
  g.rect(3, 16, 28, 1, 'm0');
  for (let y = 1; y < 9; y++) {
    const half = 2 + (y - 1) * 1.3, x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    for (let x = x0; x < x1; x++) {
      const u = (x - x0 + 0.5) / (x1 - x0);
      g.set(x, y, 'x' + (u < 0.3 ? 2 : u < 0.75 ? 1 : 0));
    }
  }
  g.set(cx, 0, 'm0');
  g.set(cx - 1, 0, 'm0');
  g.meta = { lamp: [17, 14] };
  return g.outline();
}

export function spWreck(): G {
  const g = new G(112, 56), A = -0.2, ca = Math.cos(A), sa = Math.sin(A), CX = 46, CY = 27, RX = 31, RY = 15;
  g.ell(58, 51, 52, 4, 'z');
  for (let x = 84; x <= 101; x++) {
    const t = (x - 84) / 17, top = Math.round(41 - t * 5);
    for (let y = top; y < top + 3; y++) g.set(x, y, 'm' + (y === top ? 3 : y === top + 1 ? 2 : 1));
  }
  for (let y = 25; y < 38; y++) for (let x = 98; x < 106; x++) if (x - 98 < (y - 25) * 0.55 + 1.5) g.set(x, y, 'm' + (x < 101 ? 2 : 1));
  g.line(101, 22, 108, 30, 'm0');
  g.line(108, 22, 101, 30, 'm1');
  g.set(104, 26, 'x1');
  for (let x = 70; x <= 86; x++) {
    const t = (x - 70) / 16, top = Math.round(22 - t * 4), th = Math.round(7 - t * 3);
    for (let y = top; y < top + th; y++) {
      if (x > 82 && hash(x, y, 61) < 0.4) continue;
      g.set(x, y, 'm' + (y === top ? 3 : y - top < th / 2 ? 2 : 1));
    }
  }
  for (let y = 6; y < 50; y++)
    for (let x = 10; x < 82; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, u = (dx * ca + dy * sa) / RX, v = (-dx * sa + dy * ca) / RY;
      if (u * u + v * v > 1 || v > 0.82) continue;
      const glass = u < -0.38 && v > -0.78 && v < 0.22, door = u > -0.02 && u < 0.26 && v > -0.6 && v < 0.55, win = u > 0.36 && u < 0.54 && v > -0.5 && v < -0.12;
      let r: string;
      if (glass) {
        const iu = u + 0.72, iv = v + 0.2, d = Math.hypot(iu * 1.6, iv), ang = Math.atan2(iv, iu), fr = mod((ang / Math.PI) * 3, 1);
        r = mod(u * 6 + v * 2.4, 1) < 0.18 && u > -0.9 ? 'g2' : 'g1';
        if (d < 0.34 && d > 0.04 && (fr < 0.035 || fr > 0.965)) r = 'e3';
        if (u > -0.43 || v > 0.17 || v < -0.73) r = 'm0';
      } else if (door) r = u < 0.02 || u > 0.22 || v < -0.54 || v > 0.5 ? 'm0' : v > 0.15 && u > 0.05 && u < 0.2 ? 'i9' : 'i1';
      else if (win) r = u < 0.39 || u > 0.51 || v < -0.46 || v > -0.16 ? 'm0' : 'g1';
      else if (v > 0.26 && v < 0.42) r = 'x' + (u < -0.1 ? 2 : u < 0.5 ? 1 : 0);
      else {
        r = 'm' + sh4(u * 0.3 + v * 0.95 + (vn(x / 3, y / 3, 64) - 0.5) * 0.5);
        if (vn(x / 2.5, y / 2.5, 65) > 0.74 && hash(x, y, 66) < 0.7) r = v > 0.3 ? 'w1' : 'x0';
      }
      g.set(x, y, r);
    }
  g.ellS(CX + 6, CY - 15, 11, 4.5, 'm', { rot: A });
  g.rect(CX + 3, CY - 22, 4, 4, 'm0');
  g.rect(CX + 2, CY - 23, 6, 2, 'm1');
  const hx = CX + 5, hy = CY - 22;
  for (let s = 0; s <= 1; s += 0.008) {
    const x = (1 - s) * (1 - s) * hx + 2 * (1 - s) * s * (hx + 34) + s * s * (hx + 50), y = (1 - s) * (1 - s) * hy + 2 * (1 - s) * s * (hy + 1) + s * s * (hy + 25);
    g.set(x, y, s > 0.93 ? 'x1' : 'm2');
    g.set(x, y + 1, 'm0');
  }
  g.line(hx, hy, hx - 9, hy + 2, 'm1');
  g.set(hx - 10, hy + 3, 'm0');
  g.line(hx, hy + 1, hx - 3, hy + 5, 'm0');
  g.ellS(42, 50, 36, 6, '~sa', { lo: 1 });
  g.ellS(13, 45, 9, 6, '~sa', { lo: 1 });
  g.ellS(96, 46, 12, 4, '~sa', { lo: 1 });
  g.line(18, 43, 12, 47, 'm0');
  g.rect(22, 47, 10, 1, 'm0');
  g.rect(40, 48, 6, 1, 'm0');
  g.rect(52, 47, 11, 3, 'm2');
  g.rect(52, 49, 11, 1, 'm1');
  g.rect(62, 47, 1, 3, 'm0');
  g.rect(72, 49, 4, 2, 'm1');
  g.set(80, 50, 'm2');
  g.set(30, 50, 'm1');
  for (const x of [26, 34, 47, 66]) {
    g.set(x, 44, 'l1');
    g.set(x, 45, 'l0');
    g.set(x + 1, 46, 'l0');
  }
  return g.outline();
}

export function spRaft(): G {
  const g = new G(40, 34);
  for (let i = 0; i < 7; i++) {
    const x0 = 3 + i * 5;
    for (let y = 18; y < 31; y++) for (let k = 0; k < 5; k++) g.set(x0 + k, y, 'w' + [3, 2, 2, 1, 0][k]);
    g.rect(x0 + 1, 18, 3, 1, 'w3');
    g.set(x0 + 2, 19, 'w1');
  }
  g.rect(3, 21, 35, 1, 'n0');
  g.rect(3, 27, 35, 1, 'n0');
  g.cyl(19, 1, 3, 19, 'w', [2, 1, 0]);
  for (let y = 3; y < 17; y++) {
    const len = Math.round((y - 2) * 1.05);
    for (let x = 22; x < 22 + len; x++) g.set(x, y, x < 24 ? 'n1' : x === 22 + len - 1 ? 'n0' : 'n2');
  }
  g.line(23, 10, 33, 10, 'n1');
  g.rect(20, 0, 5, 2, 'x1');
  g.rect(20, 0, 5, 1, 'x2');
  g.rect(16, 3, 3, 1, 'm0');
  g.rect(15, 5, 3, 4, 'y1');
  g.rect(15, 4, 3, 1, 'm0');
  g.rect(15, 9, 3, 1, 'm0');
  g.meta = { lantern: [16, 7] };
  return g.outline();
}

export function spCrate(): G {
  const g = new G(16, 16);
  g.ell(8, 14.5, 7, 1.4, 'z');
  for (let y = 2; y < 14; y++)
    for (let x = 1; x < 15; x++) {
      let i = (y - 2) % 4 === 3 ? 1 : 2;
      if (x >= 12) i = Math.max(0, i - 1);
      g.set(x, y, 'w' + i);
    }
  g.rect(1, 2, 14, 1, 'w3');
  g.rect(1, 2, 1, 12, 'w1');
  g.rect(14, 2, 1, 12, 'w0');
  g.rect(1, 13, 14, 1, 'w0');
  g.line(2, 3, 13, 12, 'w1');
  return g.outline();
}

export function spBarrel(): G {
  const g = new G(14, 18);
  g.ell(7, 16.3, 6, 1.4, 'z');
  g.ellS(7, 9.5, 5.6, 7, 'w');
  for (const y of [5, 13])
    for (let x = 0; x < 14; x++) {
      const v = g.get(x, y);
      if (v && v[0] === 'w') g.set(x, y, x < 7 ? 'm1' : 'm0');
    }
  g.ell(7, 3.6, 4.6, 1.4, 'w3');
  return g.outline();
}

export function spRock(seed: number, big: boolean): G {
  const rx = big ? 8 : 5, ry = big ? 5 : 3.5, w = rx * 2 + 2, h = ry * 2 + 4, g = new G(w, h);
  g.ell(w / 2, h - 2, rx, 1.3, 'z');
  g.ellS(w / 2, h - 2 - ry, rx, ry, 's', { tex: 2.2, amp: 0.6, seed });
  return g.outline();
}

export function spFire(): G {
  const g = new G(22, 14);
  g.ell(11, 11.5, 9.5, 2.4, 'z');
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    g.ellS(11 + Math.cos(a) * 7.4, 9 + Math.sin(a) * 2.8, 2, 1.6, 's', { lo: 1 });
  }
  g.line(5, 7, 17, 10, 'w2');
  g.line(5, 8, 17, 11, 'w0');
  g.line(5, 10, 17, 7, 'w1');
  g.meta = { flame: [11, 8] };
  return g.outline();
}

export function spWoodpile(): G {
  const g = new G(28, 18);
  g.ell(14, 16.5, 13, 1.6, 'z');
  for (const [cx, cy] of [[5, 13], [12, 13], [19, 13], [8.5, 8], [15.5, 8], [12, 3.5]]) {
    g.rect(Math.round(cx), Math.round(cy - 3), 7, 7, 'w1');
    g.rect(Math.round(cx), Math.round(cy + 2), 7, 2, 'w0');
    g.ellS(cx, cy, 3.6, 3.4, 'w', { lo: 2 });
    g.set(cx, cy, 'w1');
    g.set(cx - 1, cy - 1, 'w3');
  }
  return g.outline();
}

export function spNetRack(): G {
  const g = new G(40, 32);
  g.ell(20, 30, 18, 1.6, 'z');
  g.cyl(3, 4, 3, 27, 'w', [2, 1, 0]);
  g.cyl(34, 4, 3, 27, 'w', [2, 1, 0]);
  g.rect(2, 4, 36, 2, 'w2');
  g.rect(2, 5, 36, 1, 'w1');
  for (let x = 6; x < 34; x++) {
    const yb = Math.round(20 + Math.sin(((x - 6) / 28) * Math.PI) * 5);
    for (let y = 6; y <= yb; y++) if ((x + y) % 4 === 0 || mod(x - y, 4) === 0) g.set(x, y, '~n0');
    if ((x - 6) % 6 === 3) g.set(x, yb + 1, '~x1');
  }
  return g.outline();
}

export function spPost(): G {
  const g = new G(6, 13);
  g.cyl(1, 2, 4, 10, 'w', [3, 2, 1, 0]);
  g.rect(1, 1, 4, 1, 'w3');
  return g.outline();
}

export function spGull(f: boolean): G {
  const g = new G(13, 7);
  const pts: Pt[] = f
    ? [[1, 1], [2, 1], [3, 2], [4, 3], [8, 3], [9, 2], [10, 1], [11, 1]]
    : [[1, 4], [2, 3], [3, 3], [4, 3], [8, 3], [9, 3], [10, 3], [11, 4]];
  for (const [x, y] of pts) g.set(x, y, 'e2');
  g.rect(5, 3, 3, 2, 'e3');
  g.set(7, 4, 'e1');
  g.set(8, 4, 'y0');
  return g.outline();
}

export function spStump(): G {
  const g = new G(16, 11);
  g.ell(8, 9.5, 7, 1.4, 'z');
  g.cyl(2, 4, 12, 5, 'w', [2, 2, 1, 1, 0]);
  g.ell(8, 4, 6, 2.2, 'w3');
  g.ell(8, 4, 3.5, 1.2, 'w2');
  g.set(8, 4, 'w1');
  g.rect(13, 8, 2, 1, 'w1');
  return g.outline();
}

// ---------------------------------------------------------------- 2D 版新增

/** 工作台：厚木台面、两条腿、台上一把锯和一块木板，台下工具箱 */
export function spWorkbench(): G {
  const g = new G(36, 26);
  g.ell(18, 24, 17, 2, 'z');
  // 腿
  g.cyl(4, 12, 3, 12, 'w', [2, 1, 0]);
  g.cyl(29, 12, 3, 12, 'w', [1, 0, 0]);
  g.rect(5, 19, 26, 2, 'w0');
  // 台面
  for (let y = 8; y < 13; y++)
    for (let x = 1; x < 35; x++) {
      let i = y === 8 ? 3 : y === 12 ? 0 : (x + (y % 2) * 3) % 9 === 0 ? 1 : 2;
      if (x > 31 && i > 1) i = 1;
      g.set(x, y, 'w' + i);
    }
  // 台上：木板
  g.rect(6, 5, 12, 3, 'w2');
  g.rect(6, 5, 12, 1, 'w3');
  g.rect(17, 5, 1, 3, 'w1');
  // 锯
  g.rect(21, 4, 9, 2, 'm2');
  g.rect(21, 4, 9, 1, 'm3');
  for (let x = 21; x < 30; x += 2) g.set(x, 6, 'm1');
  g.rect(29, 2, 3, 5, 'w1');
  g.set(30, 3, 'w3');
  // 锤子
  g.line(8, 2, 12, 4, 'w1');
  g.rect(6, 1, 3, 2, 'm1');
  // 台下工具箱
  g.rect(12, 15, 12, 5, 'x1');
  g.rect(12, 15, 12, 1, 'x2');
  g.rect(23, 15, 1, 5, 'x0');
  g.rect(16, 14, 4, 1, 'm0');
  g.set(18, 17, 'y1');
  return g.outline();
}

/** 储物箱：带铁箍和锁扣的大木箱 */
export function spChest(): G {
  const g = new G(28, 22);
  g.ell(14, 20, 13, 1.8, 'z');
  // 箱体
  for (let y = 9; y < 19; y++)
    for (let x = 2; x < 26; x++) {
      let i = (y - 9) % 3 === 2 ? 1 : 2;
      if (x >= 22) i = Math.max(0, i - 1);
      g.set(x, y, 'w' + i);
    }
  // 箱盖（拱起）
  for (let y = 3; y < 9; y++) {
    const inset = y < 5 ? 2 - (y - 3) : 0;
    for (let x = 2 + inset; x < 26 - inset; x++) {
      let i = y === 3 ? 3 : y === 8 ? 0 : 2;
      if (x >= 22 && i > 1) i = 1;
      g.set(x, y, 'w' + i);
    }
  }
  // 铁箍
  for (const x of [5, 21]) {
    g.rect(x, 3, 2, 16, 'm1');
    g.rect(x, 3, 1, 16, 'm2');
  }
  g.rect(2, 8, 24, 1, 'm0');
  // 锁扣
  g.rect(12, 7, 4, 4, 'y0');
  g.rect(12, 7, 4, 1, 'y1');
  g.set(13, 9, 'm0');
  return g.outline();
}

/** 草药丛：一丛宽叶，开浅色小花；采完只剩枝 */
export function spHerbBush(empty: boolean): G {
  const g = new G(22, 18);
  g.ell(11, 16, 9, 1.8, 'z');
  if (empty) {
    for (const [x0, x1] of [[6, 4], [9, 8], [11, 12], [14, 17], [16, 19]]) g.line(x0, 15, x1, 8, 'l0');
    g.set(8, 9, 'l1');
    g.set(13, 10, 'l1');
    return g.outline();
  }
  g.ellS(6, 11, 4.5, 4, 'l', { tex: 1.8, amp: 0.6, seed: 61, lo: 1 });
  g.ellS(16, 11, 4.5, 4, 'l', { tex: 1.8, amp: 0.6, seed: 62, lo: 1 });
  g.ellS(11, 8, 5.5, 5, 'l', { tex: 1.8, amp: 0.6, seed: 63, lo: 1 });
  for (const [x, y] of [[7, 6], [11, 4], [15, 7], [9, 10], [14, 11], [5, 10]]) {
    g.set(x, y, 'fw');
    g.set(x + 1, y, 'n1');
  }
  return g.outline();
}

/** 浅滩钓点：水里几根木桩和一圈浮标 */
export function spShoal(): G {
  const g = new G(26, 16);
  for (const [x, h] of [[4, 9], [11, 12], [19, 8]]) {
    g.cyl(x, 14 - h, 3, h, 'w', [2, 1, 0]);
    g.rect(x, 14 - h, 3, 1, 'w3');
  }
  g.line(6, 7, 11, 4, '~n1');
  g.line(14, 4, 19, 8, '~n1');
  g.rect(8, 9, 3, 2, 'x1');
  g.set(9, 9, 'x2');
  g.rect(16, 11, 3, 2, 'e2');
  g.set(17, 11, 'e3');
  return g.outline();
}

/** 农田空地上的木牌（救出农民之前） */
export function spSign(): G {
  const g = new G(14, 18);
  g.ell(7, 16.5, 5, 1.2, 'z');
  g.cyl(6, 8, 2, 9, 'w', [1, 0]);
  g.rect(1, 2, 12, 7, 'w2');
  g.rect(1, 2, 12, 1, 'w3');
  g.rect(1, 8, 12, 1, 'w0');
  g.rect(12, 2, 1, 7, 'w1');
  g.line(3, 4, 10, 4, 'w0');
  g.line(3, 6, 8, 6, 'w0');
  return g.outline();
}

/** 灯塔地基：一圈石头基座、一摞木板和一块木牌（修好后换成灯塔） */
export function spLighthouseBase(): G {
  const g = new G(30, 22);
  g.ell(15, 20, 14, 2, 'z');
  g.ellS(15, 16, 12, 4.5, 's', { tex: 2.2, amp: 0.6, seed: 41 });
  g.ell(15, 15, 7, 2.2, 's0');
  // 木板
  for (const [x, y] of [[3, 11], [5, 9]]) {
    g.rect(x, y, 9, 2, 'w2');
    g.rect(x, y, 9, 1, 'w3');
    g.rect(x + 8, y, 1, 2, 'w1');
  }
  // 木牌
  g.cyl(23, 6, 2, 10, 'w', [1, 0]);
  g.rect(19, 2, 10, 6, 'w2');
  g.rect(19, 2, 10, 1, 'w3');
  g.rect(19, 7, 10, 1, 'w0');
  g.rect(21, 4, 6, 1, 'x1');
  return g.outline();
}

/** 设施地基：四根木桩围一圈绳子，中间平整的空地，旁边一块小木牌（还没定下做什么工作） */
export function spFacilityBase(): G {
  const g = new G(34, 22);
  g.ell(17, 19, 15, 2.4, 'z');
  g.ellS(17, 15, 14, 4.2, 'sa', { tex: 2.4, amp: 0.5, seed: 17 });
  for (const [x, y] of [[4, 9], [28, 9], [6, 14], [26, 14]]) {
    g.cyl(x, y, 2, 6, 'w', [1, 0]);
    g.set(x, y, 'w3');
  }
  g.line(5, 10, 28, 10, 'q0');
  g.line(5, 10, 7, 15, 'q0');
  g.line(29, 10, 27, 15, 'q0');
  // 木牌
  g.cyl(16, 4, 2, 9, 'w', [1, 0]);
  g.rect(12, 1, 10, 5, 'w2');
  g.rect(12, 1, 10, 1, 'w3');
  g.rect(12, 5, 10, 1, 'w0');
  g.rect(14, 3, 6, 1, 'x1');
  return g.outline();
}

/** 自动入库机：一段木滑槽，上面一个箱子，底下一排滚轮（面板里的图） */
export function spAutoStore(): G {
  const g = new G(34, 26);
  g.ell(17, 23, 15, 2.4, 'z');
  // 滑槽（斜的木板）
  for (let i = 0; i < 22; i++) g.rect(5 + i, 8 + Math.floor(i / 2), 3, 2, i % 2 ? 'w2' : 'w1');
  g.line(5, 7, 27, 18, 'w3');
  // 支架
  g.cyl(7, 10, 2, 12, 'w', [1, 0]);
  g.cyl(25, 19, 2, 4, 'w', [1, 0]);
  // 箱子
  g.rect(8, 2, 9, 7, 'w2');
  g.rect(8, 2, 9, 1, 'w3');
  g.rect(8, 8, 9, 1, 'w0');
  g.rect(12, 4, 2, 2, 'q2');
  // 滚轮
  for (const x of [10, 15, 20]) g.ellS(x, 20, 1.6, 1.6, 'm', { lo: 1, hi: 2 });
  return g.outline();
}

/** 村落的请求板：两根柱子、一块板，钉着几张纸 */
export function spBoard(): G {
  const g = new G(22, 22);
  g.ell(11, 20.5, 9, 1.6, 'z');
  g.cyl(3, 6, 2, 14, 'w', [1, 0]);
  g.cyl(17, 6, 2, 14, 'w', [1, 0]);
  g.rect(1, 3, 20, 11, 'w2');
  g.rect(1, 3, 20, 1, 'w3');
  g.rect(1, 13, 20, 1, 'w0');
  g.rect(20, 3, 1, 11, 'w1');
  for (const [x, y] of [[4, 5], [10, 6], [15, 5]]) {
    g.rect(x, y, 4, 5, 'e3');
    g.rect(x, y + 4, 4, 1, 'e1');
    g.set(x + 1, y, 'x1');
  }
  return g.outline();
}

// ---------------------------------------------------------------- 人物

interface CharDef {
  hat?: string;
  hatC?: number[];
  hair: number;
  shirt: number[];
  pants?: number[];
  skin?: number[];
  boots?: number;
  prop?: string[];
  over?: number[];
  belt?: number;
  plaid?: boolean;
  beard?: number;
  coat?: boolean;
  apron?: number;
  cross?: number;
  goggles?: number[];
  scarf?: number;
}

export type Dir = 'down' | 'side' | 'up';

export const CHARS: Record<string, CharDef> = {
  player: { hat: 'straw', hatC: [11, 10, 9], hair: 8, shirt: [4, 3, 2], pants: [1, 0], prop: ['satchel'] },
  engineer: { hat: 'helmet', hatC: [11, 10, 9], hair: 1, shirt: [6, 5, 4], over: [3, 2], pants: [3, 2], belt: 8, prop: ['wrench'] },
  lumber: { hat: 'beanie', hatC: [9, 8], hair: 8, shirt: [9, 8, 1], plaid: true, beard: 8, pants: [2, 1], prop: ['axe'] },
  fisher: { hat: 'souwester', hatC: [11, 10, 9], hair: 5, beard: 6, shirt: [11, 10, 9], coat: true, pants: [1, 0], boots: 1, prop: ['rod', 'creel'] },
  farmer: { hat: 'scarf', hatC: [5, 4], hair: 1, shirt: [6, 5, 4], apron: 8, pants: [8, 1], prop: ['basket'] },
  doctor: { hat: 'none', hair: 1, shirt: [7, 6, 5], coat: true, cross: 9, pants: [2, 1], prop: ['bag'] },
  pilot: { hat: 'cap', hatC: [8, 1], goggles: [5, 4], hair: 8, shirt: [9, 8, 1], scarf: 7, pants: [2, 1], prop: ['scarftail'] },
  islander: { hat: 'none', hair: 0, shirt: [5, 4, 3], pants: [2, 1] },
  // 村长（村落的请求板旁）、进出口局的办事员
  elder: { hat: 'none', hair: 7, beard: 7, shirt: [10, 9, 8], coat: true, pants: [1, 0], prop: ['bag'] },
  clerk: { hat: 'cap', hatC: [3, 2], hair: 1, shirt: [7, 6, 5], coat: true, pants: [2, 1] },
};

/** 人物：24 × 32，身体 16 × 26 居中；f 为帧 0–3；pose 为伐木动作 up / down */
export function spChar(d: CharDef, dir: Dir, f: number, pose?: 'up' | 'down'): G {
  const g = new G(24, 32), O = 4, I = (n: number) => 'i' + n;
  const S = {
    rect: (x: number, y: number, w: number, h: number, r: string) => g.rect(x + O, y + O, w, h, r),
    set: (x: number, y: number, r: string) => g.set(x + O, y + O, r),
    ell: (cx: number, cy: number, rx: number, ry: number, r: string) => g.ell(cx + O, cy + O, rx, ry, r),
    line: (a: number, b: number, c: number, e: number, r: string) => g.line(a + O, b + O, c + O, e + O, r),
  };
  const sh = d.shirt, pa = d.pants || [2, 1], sk = d.skin || [10, 9], boots = d.boots != null ? d.boots : 0, hair = d.hair;
  const bob = f === 1 || f === 3 ? -1 : 0, side = dir === 'side', props = d.prop || [];
  S.ell(8, 26.4, 5.5, 1.4, 'z');
  if (side) {
    const st = f === 1 || f === 3;
    for (const [lx, k] of st ? [[4, 1], [9, 0]] : [[6, 0]]) {
      S.rect(lx, 20, 3, 4, I(pa[k]));
      S.rect(lx, 24, 4, 2, I(boots));
    }
  } else {
    const lift = f === 1 ? [1, 0] : f === 3 ? [0, 1] : [0, 0];
    for (const [lx, k] of [[5, 0], [8, 1]]) {
      const up = lift[k];
      S.rect(lx, 20, 3, 4 - up, I(pa[k]));
      S.rect(lx, 24 - up, 3, 2, I(boots));
    }
  }
  const by = 12 + bob, bx0 = side ? 5 : 4, bw = side ? 6 : 8, long = d.coat ? 3 : 0;
  for (let y = by; y < by + 8 + long; y++)
    for (let x = bx0; x < bx0 + bw; x++) {
      const u = (x - bx0 + 0.5) / bw;
      let c = u < 0.25 ? sh[0] : u < 0.75 ? sh[1] : sh[2];
      if (d.plaid && ((y - by) % 3 === 0 || (x - bx0) % 3 === 0)) c = sh[2];
      S.set(x, y, I(c));
    }
  if (d.coat && dir !== 'up') S.rect(bx0 + (side ? 3 : 4), by, 1, 8 + long, I(sh[2]));
  if (d.over) {
    const ov = d.over;
    for (let y = by + 3; y < by + 8; y++) for (let x = bx0; x < bx0 + bw; x++) S.set(x, y, I(ov[(x - bx0) / bw < 0.6 ? 0 : 1]));
    if (!side) {
      S.rect(bx0 + 1, by, 1, 3, I(ov[0]));
      S.rect(bx0 + bw - 2, by, 1, 3, I(ov[1]));
    }
  }
  if (d.apron != null && dir !== 'up') S.rect(bx0 + 1, by + 3, bw - 2, 7, I(d.apron));
  if (d.cross != null && dir === 'down') {
    S.rect(bx0 + 2, by + 3, 3, 1, I(d.cross));
    S.rect(bx0 + 3, by + 2, 1, 3, I(d.cross));
  }
  if (d.belt != null) {
    S.rect(bx0, by + 7, bw, 1, I(d.belt));
    if (dir === 'down') S.set(bx0 + bw / 2, by + 7, I(10));
  }
  if (d.scarf != null) {
    S.rect(bx0, by, bw, 1, I(d.scarf));
    if (dir !== 'up') S.set(bx0 + bw - 2, by + 1, I(d.scarf));
  }
  if (side) {
    const sw = pose ? 1 : f === 1 ? 1 : f === 3 ? -1 : 0;
    S.rect(7 + sw, by + 1, 2, 5, I(sh[2]));
    S.rect(7 + sw, by + 6, 2, 1, I(sk[0]));
  } else {
    const s = f === 1 ? [1, -1] : f === 3 ? [-1, 1] : [0, 0];
    S.rect(bx0 - 1, by + 1, 1, 5 + s[0], I(sh[1]));
    S.set(bx0 - 1, by + 6 + s[0], I(sk[0]));
    S.rect(bx0 + bw, by + 1, 1, 5 + s[1], I(sh[2]));
    S.set(bx0 + bw, by + 6 + s[1], I(sk[1]));
  }
  const hy = 4 + bob;
  if (side) {
    S.rect(6, hy + 1, 5, 7, I(sk[0]));
    S.set(11, hy + 4, I(sk[0]));
    S.rect(5, hy, 4, 4, I(hair));
    S.rect(5, hy + 4, 2, 3, I(hair));
    S.set(9, hy + 4, 'o');
  } else if (dir === 'up') {
    S.rect(5, hy + 1, 6, 7, I(sk[1]));
    S.rect(5, hy, 6, 6, I(hair));
  } else {
    S.rect(5, hy + 1, 6, 7, I(sk[0]));
    S.rect(9, hy + 1, 2, 7, I(sk[1]));
    S.rect(5, hy, 6, 2, I(hair));
    S.set(5, hy + 2, I(hair));
    S.set(10, hy + 2, I(hair));
    S.set(6, hy + 4, 'o');
    S.set(9, hy + 4, 'o');
  }
  if (d.beard != null && dir !== 'up') {
    for (let y = hy + 5; y < hy + 9; y++) for (let x = side ? 7 : 5; x < 11; x++) if (!(y === hy + 8 && (x === 5 || x === 10))) S.set(x, y, I(d.beard));
    if (!side) S.set(7, hy + 6, I(sk[1]));
  }
  if (d.goggles) {
    S.rect(5, hy + 1, 6, 1, I(d.goggles[1]));
    if (dir === 'down') {
      S.set(6, hy + 1, I(d.goggles[0]));
      S.set(9, hy + 1, I(d.goggles[0]));
    }
  }
  const hc = d.hatC || [];
  switch (d.hat) {
    case 'straw':
      S.rect(2, hy + 1, 12, 2, I(hc[1]));
      S.rect(2, hy + 2, 12, 1, I(hc[2]));
      S.rect(5, hy - 3, 6, 4, I(hc[0]));
      S.rect(9, hy - 3, 2, 4, I(hc[1]));
      S.rect(5, hy, 6, 1, I(9));
      break;
    case 'helmet':
      S.rect(5, hy - 3, 6, 1, I(hc[0]));
      S.rect(4, hy - 2, 8, 3, I(hc[0]));
      S.rect(9, hy - 2, 3, 3, I(hc[1]));
      S.rect(3, hy + 1, 10, 1, I(hc[2]));
      S.rect(7, hy - 3, 2, 3, I(11));
      break;
    case 'beanie':
      S.rect(5, hy - 2, 6, 3, I(hc[0]));
      S.rect(5, hy + 1, 6, 1, I(hc[1]));
      S.rect(7, hy - 3, 2, 1, I(7));
      break;
    case 'souwester':
      S.rect(5, hy - 3, 6, 4, I(hc[0]));
      S.rect(9, hy - 3, 2, 4, I(hc[1]));
      S.rect(2, hy + 1, 12, 1, I(hc[1]));
      S.rect(1, hy + 2, 14, 1, I(hc[2]));
      S.set(0, hy + 3, I(hc[2]));
      S.set(15, hy + 3, I(hc[2]));
      break;
    case 'scarf':
      S.rect(4, hy - 1, 8, 3, I(hc[0]));
      S.rect(4, hy + 2, 1, 3, I(hc[0]));
      S.rect(11, hy + 2, 1, 3, I(hc[1]));
      if (dir === 'down') S.set(12, hy + 4, I(hc[1]));
      break;
    case 'cap':
      S.rect(4, hy - 1, 8, 3, I(hc[0]));
      S.rect(4, hy + 2, 1, 4, I(hc[1]));
      S.rect(11, hy + 2, 1, 4, I(hc[1]));
      break;
    default:
      S.rect(5, hy - 1, 6, 1, I(hair));
  }
  const hand: Pt = side ? [9, by + 6] : [12, by + 6 + (f === 1 ? -1 : f === 3 ? 1 : 0)];
  for (const pr of props) {
    if (dir === 'up' && pr !== 'rod' && pr !== 'axe') continue;
    const [hx, hyy] = hand;
    if (pr === 'rod') {
      S.line(hx, hyy, hx + 6, -3, 'w1');
      for (let y = -2; y < 8; y += 2) S.set(hx + 7, y, 'i6');
      S.set(hx + 7, 8, 'x1');
      S.set(hx + 7, 9, 'e3');
    }
    if (pr === 'creel') {
      const x0 = side ? 2 : 0;
      S.rect(x0, by + 4, 3, 5, 'w2');
      S.rect(x0, by + 4, 3, 1, 'w3');
      S.set(x0 + 1, by + 6, 'w1');
      S.set(x0 + 1, by + 8, 'w1');
      S.set(x0 + 2, by + 3, 'i8');
    }
    if (pr === 'wrench') {
      S.line(hx, hyy, hx + 2, hyy - 5, 'm2');
      S.rect(hx + 1, hyy - 7, 3, 2, 'm1');
      S.set(hx + 2, hyy - 7, 'm0');
    }
    if (pr === 'axe') {
      if (pose === 'up') {
        S.line(9, by - 3, 12, by - 13, 'w2');
        S.rect(11, by - 16, 4, 3, 'm2');
        S.rect(14, by - 16, 1, 3, 'm3');
      } else if (pose === 'down') {
        S.line(9, by + 5, 16, by + 8, 'w2');
        S.rect(16, by + 7, 3, 4, 'm2');
        S.rect(16, by + 10, 3, 1, 'm3');
      } else {
        S.line(hx, hyy, hx + 3, by - 9, 'w2');
        S.rect(hx + 2, by - 12, 4, 3, 'm2');
        S.rect(hx + 5, by - 12, 1, 3, 'm3');
      }
    }
    if (pr === 'basket') {
      const x0 = side ? 7 : 0;
      S.rect(x0, by + 7, 5, 4, 'w2');
      S.rect(x0, by + 7, 5, 1, 'w3');
      S.set(x0 + 1, by + 6, 'q2');
      S.set(x0 + 2, by + 5, 'q2');
      S.set(x0 + 3, by + 6, 'q1');
      S.set(x0 + 4, by + 5, 'q2');
    }
    if (pr === 'bag') {
      S.rect(hx - 1, hyy + 1, 5, 4, 'w1');
      S.rect(hx - 1, hyy + 1, 5, 1, 'w2');
      S.set(hx + 1, hyy + 3, 'e3');
      S.set(hx + 1, hyy, 'w0');
    }
    if (pr === 'scarftail') {
      S.set(3, by, 'i7');
      S.set(2, by + 1, 'i7');
      S.set(1, by + 1, 'i6');
      S.set(0, by + 2, 'i6');
    }
    if (pr === 'satchel') {
      if (!side) for (let k = 0; k < 6; k++) S.set(5 + k, by + k, 'w1');
      S.rect(side ? 3 : 1, by + 5, 3, 4, 'w2');
      S.rect(side ? 3 : 1, by + 5, 3, 1, 'w3');
    }
  }
  return g.outline();
}

// ---------------------------------------------------------------- 海上用的小号素材（从设计稿 B 移植）

export function spMiniLight(): G {
  const g = new G(11, 22);
  g.ell(5.5, 20, 5, 1.4, 'z');
  g.ellS(5.5, 18.5, 4.5, 2, 's');
  for (let y = 6; y < 18; y++) {
    const band = Math.floor((y - 6) / 3) % 2, half = 2 + (y - 6) * 0.12;
    for (let x = Math.round(5.5 - half); x < Math.round(5.5 + half); x++) g.set(x, y, (band ? 'x' : 'e') + (x > 5 ? 1 : 2));
  }
  g.rect(3, 3, 5, 3, 'y1');
  g.rect(3, 3, 5, 1, 'm0');
  g.rect(2, 6, 7, 1, 'm0');
  g.rect(4, 1, 3, 2, 'x1');
  g.meta = { lamp: [5, 4] };
  return g.outline();
}

export function spMiniHouse(): G {
  const g = new G(15, 13);
  g.ell(7.5, 12, 7, 1.2, 'z');
  g.rect(2, 6, 11, 5, 'c2');
  g.rect(10, 6, 3, 5, 'c1');
  for (let y = 1; y < 7; y++) {
    const h = 1 + y * 1.1;
    g.rect(Math.round(7.5 - h), y, Math.round(h * 2), 1, y % 2 ? 'r2' : 'r1');
  }
  g.rect(6, 8, 2, 3, 'w1');
  g.set(4, 8, 'g1');
  g.set(10, 8, 'g1');
  return g.outline();
}

export function spMiniTree(seed: number): G {
  const g = new G(9, 12);
  g.ell(4.5, 10.8, 3.5, 1, 'z');
  g.rect(4, 7, 2, 4, 'w1');
  g.ellS(4.5, 4.5, 3.6, 4, 'l', { tex: 1.5, amp: 0.5, seed });
  return g.outline();
}

/** 木筏（海上）：带帆，人坐在上面 */
export function spMiniRaft(passengers = 0): G {
  const g = new G(16, 15);
  for (let i = 0; i < 4; i++) {
    g.rect(2 + i * 3, 9, 3, 4, 'w2');
    g.set(4 + i * 3, 9, 'w1');
  }
  g.rect(2, 12, 12, 1, 'w0');
  g.rect(10, 1, 1, 9, 'w1');
  for (let y = 2; y < 8; y++) g.rect(11, y, Math.max(1, Math.round((y - 1) * 0.7)), 1, 'n2');
  g.rect(4, 4, 3, 1, 'i11');
  g.set(5, 3, 'i10');
  g.set(5, 5, 'i10');
  g.rect(4, 6, 3, 3, 'i3');
  g.set(8, 5, 'y1');
  // 随船的同伴：小人站在甲板上（最多 3 个：桅杆前、船头、帆下）
  for (const x of [7, 1, 13].slice(0, passengers)) {
    g.rect(x, 5, 2, 1, 'i10');
    g.rect(x, 6, 2, 3, 'i9');
  }
  g.meta = { lantern: [8, 5] };
  return g.outline();
}

/** 漂流物：一只木箱 */
export function spFloat(): G {
  const g = new G(9, 8);
  g.rect(1, 2, 7, 4, 'w2');
  g.rect(1, 2, 7, 1, 'w3');
  g.rect(6, 2, 1, 4, 'w1');
  g.line(1, 2, 7, 5, 'w1');
  return g.outline();
}

// ---------------------------------------------------------------- 设施建筑

/** 蒸馏棚：罐头盒蒸馏器——火上一口锅、一根铜管、一只接水的桶 */
export function spDistiller(): G {
  const g = new G(34, 30);
  g.ell(17, 28, 16, 2, 'z');
  // 棚顶和柱子
  g.cyl(2, 6, 2, 22, 'w', [1, 0]);
  g.cyl(30, 6, 2, 22, 'w', [1, 0]);
  for (let y = 2; y < 7; y++) g.rect(1 + (6 - y), y, 32 - (6 - y) * 2, 1, y % 2 ? 'r2' : 'r1');
  g.rect(1, 6, 32, 1, 'r0');
  // 锅和火
  g.ellS(11, 19, 6, 4.5, 'm', { lo: 0 });
  g.rect(6, 14, 10, 2, 'm2');
  g.ellS(11, 25, 5, 1.6, 's', { lo: 1 });
  g.set(10, 24, 'y1');
  g.set(12, 24, 'y0');
  // 铜管
  g.line(16, 15, 22, 12, 'x2');
  g.line(22, 12, 24, 18, 'x2');
  g.line(16, 16, 22, 13, 'x1');
  // 桶
  g.ellS(25, 23, 4, 4.5, 'w');
  g.ell(25, 19, 3, 1, 'g1');
  g.rect(21, 22, 8, 1, 'm1');
  g.meta = { flame: [11, 24] };
  return g.outline();
}

/** 烤鱼架（从设计稿 B 移植） */
export function spGrill(): G {
  const g = new G(22, 18);
  g.cyl(2, 2, 2, 15, 'w', [2, 0]);
  g.cyl(18, 2, 2, 15, 'w', [2, 0]);
  g.rect(1, 2, 20, 1, 'm0');
  g.rect(1, 1, 20, 1, 'm1');
  for (const [x, mat] of [[6, 'g'], [10, 'w'], [14, 'w']] as [number, string][]) {
    g.set(x + 1, 3, 'm0');
    g.rect(x, 4, 3, 5, mat + '1');
    g.rect(x + 2, 4, 1, 5, mat + '0');
    g.set(x + 1, 9, mat + '0');
    g.set(x, 5, mat === 'g' ? 'g2' : 'w3');
  }
  return g.outline();
}

/** 麦田：一小块地，几排麦子 */
export function spWheatPatch(): G {
  const g = new G(36, 20);
  g.ell(18, 18, 17, 2, 'z');
  for (let y = 8; y < 18; y++) for (let x = 1; x < 35; x++) g.set(x, y, (y - 8) % 4 < 2 ? 'so1' : 'so0');
  for (let r = 0; r < 3; r++)
    for (let x = 3; x < 34; x += 4) {
      const by = 10 + r * 3;
      g.line(x, by, x, by - 5, 'q0');
      g.set(x, by - 6, 'q2');
      g.set(x - 1, by - 5, 'q1');
      g.set(x + 1, by - 5, 'q1');
    }
  return g.outline();
}

/** 药圃：围起来的一小块，种着几丛草药 */
export function spHerbGarden(): G {
  const g = new G(32, 20);
  g.ell(16, 18, 15, 2, 'z');
  for (let y = 9; y < 18; y++) for (let x = 2; x < 30; x++) g.set(x, y, 'so0');
  for (const [cx, cy] of [[8, 12], [16, 11], [24, 12], [12, 15], [20, 15]]) {
    g.ellS(cx, cy, 3.5, 3, 'l', { tex: 1.6, amp: 0.5, seed: cx + cy, lo: 1 });
    g.set(cx, cy - 2, 'fw');
  }
  g.rect(1, 17, 30, 1, 'w1');
  g.rect(1, 8, 1, 10, 'w1');
  g.rect(30, 8, 1, 10, 'w1');
  return g.outline();
}

/** 烤炉：石头砌的圆顶炉，口里有火 */
export function spOven(): G {
  const g = new G(28, 24);
  g.ell(14, 22, 13, 2, 'z');
  g.ellS(14, 14, 11, 9, 's', { tex: 2, amp: 0.5, seed: 77 });
  g.rect(3, 14, 22, 8, 's1');
  g.ellS(14, 18, 4, 3.5, 'a', { hi: 0 });
  g.set(13, 19, 'y1');
  g.set(15, 19, 'y0');
  g.rect(18, 2, 4, 6, 's2');
  g.meta = { flame: [14, 19] };
  return g.outline();
}

/** 晒盐池：浅浅的方池，边上堆着白色的盐 */
export function spSaltPan(): G {
  const g = new G(32, 16);
  g.ell(16, 14, 15, 1.8, 'z');
  g.rect(1, 5, 30, 9, 'w1');
  g.rect(3, 7, 26, 5, 'g1');
  g.rect(3, 7, 26, 1, 'g2');
  g.ellS(24, 6, 4, 2.5, 'n', { hi: 2 });
  g.ellS(8, 6, 3, 2, 'n', { hi: 2 });
  return g.outline();
}

// ---------------------------------------------------------------- M4 / M5 的建筑

/** 网络岛上建的小屋（床）：木墙、草顶、一扇门、一扇窗 */
export function spHut(): G {
  const g = new G(48, 44);
  g.ell(24, 41, 22, 2.6, 'z');
  // 墙
  for (let y = 20; y < 40; y++)
    for (let x = 5; x < 43; x++) {
      const r = (y - 20) % 4;
      let i = r === 0 ? 3 : r === 3 ? 1 : 2;
      if (x >= 37) i = Math.max(0, i - 1);
      if (y < 23) i = Math.max(0, i - 2);
      g.set(x, y, 'w' + i);
    }
  // 草顶
  for (let y = 2; y < 22; y++) {
    const t = (y - 2) / 20, x0 = Math.round(18 - t * 16), x1 = Math.round(30 + t * 16);
    for (let x = x0; x < x1; x++) g.set(x, y, (y + (x % 3)) % 4 === 0 ? 'q0' : x > x1 - 4 ? 'q0' : 'q' + (y % 3 === 0 ? 2 : 1));
  }
  g.rect(1, 21, 46, 1, 'q0');
  // 门
  g.rect(20, 27, 9, 13, 'w0');
  g.rect(21, 28, 7, 12, 'w1');
  g.set(26, 34, 'y0');
  // 窗
  g.rect(9, 26, 8, 6, 'w0');
  g.rect(10, 27, 6, 4, 'g1');
  g.set(10, 27, 'g2');
  g.meta = { win: [[10, 27, 6, 4]], door: [24, 39] };
  return g.outline();
}

/** 仓库棚：四根柱子撑着斜顶，下面堆着箱子和桶 */
export function spShed(): G {
  const g = new G(38, 30);
  g.ell(19, 27.5, 17, 2.2, 'z');
  g.cyl(3, 8, 2, 19, 'w', [1, 0]);
  g.cyl(33, 8, 2, 19, 'w', [1, 0]);
  for (let y = 2; y < 9; y++) g.rect(1, y, 36, 1, y % 2 ? 'r2' : 'r1');
  g.rect(1, 8, 36, 1, 'r0');
  // 箱子和桶
  g.rect(7, 17, 9, 9, 'w2');
  g.rect(7, 17, 9, 1, 'w3');
  g.line(7, 17, 15, 25, 'w1');
  g.rect(16, 20, 7, 6, 'w2');
  g.rect(16, 20, 7, 1, 'w3');
  g.ellS(28, 22, 4, 4.5, 'w');
  g.rect(24, 21, 8, 1, 'm1');
  return g.outline();
}

/** 停机坪：一块平整的石台，中间一个白色的 H */
export function spPad(): G {
  const g = new G(46, 20);
  g.ellS(23, 10, 21, 8.5, 's', { lo: 1, hi: 2 });
  g.ell(23, 10, 17, 6.5, 's2');
  g.rect(16, 6, 2, 8, 'n2');
  g.rect(28, 6, 2, 8, 'n2');
  g.rect(16, 9, 14, 2, 'n2');
  return g.outline();
}

/** 建设地基的木牌：插在一小块平地上，牌子上画着锤子 */
export function spPlotSign(): G {
  const g = new G(24, 20);
  g.ell(12, 17.5, 10, 2, 'z');
  g.ellS(12, 16, 10, 2.5, 'sa', { lo: 1 });
  for (const x of [2, 21]) g.cyl(x, 12, 1, 5, 'w', [1]);
  g.line(2, 13, 21, 13, 'q0');
  g.cyl(11, 7, 2, 9, 'w', [1, 0]);
  g.rect(5, 1, 14, 7, 'w2');
  g.rect(5, 1, 14, 1, 'w3');
  g.rect(5, 7, 14, 1, 'w0');
  // 锤子
  g.rect(9, 3, 5, 2, 'm1');
  g.rect(11, 5, 1, 2, 'w0');
  return g.outline();
}

/** 学堂：白墙小楼，屋顶上挂着一口铜钟，门边一块黑板 */
export function spSchool(): G {
  const g = new G(64, 58);
  g.ell(32, 55, 30, 3, 'z');
  for (let y = 26; y < 54; y++)
    for (let x = 6; x < 58; x++) {
      let i = (y - 26) % 6 === 5 ? 1 : 2;
      if (x >= 50) i = 1;
      if (y < 29) i = 0;
      g.set(x, y, 'c' + i);
    }
  // 屋顶
  for (let y = 10; y < 28; y++) {
    const t = (y - 10) / 18, x0 = Math.round(22 - t * 19), x1 = Math.round(42 + t * 19);
    for (let x = x0; x < x1; x++) g.set(x, y, (y - 10) % 4 === 3 ? 'r0' : x > x1 - 4 ? 'r1' : 'r2');
  }
  g.rect(2, 27, 60, 1, 'r0');
  // 钟楼
  g.rect(27, 0, 10, 11, 'w1');
  g.rect(28, 2, 8, 7, 'w0');
  g.ellS(32, 6, 3, 3, 'x', { lo: 1, hi: 2 });
  g.set(32, 9, 'x2');
  g.rect(25, 0, 14, 1, 'r1');
  // 门
  g.rect(26, 38, 12, 16, 'w0');
  g.rect(27, 39, 10, 15, 'w2');
  g.rect(31, 39, 1, 15, 'w1');
  g.set(30, 46, 'y0');
  g.set(33, 46, 'y0');
  // 窗
  for (const wx of [10, 44]) {
    g.rect(wx, 34, 10, 9, 'w0');
    g.rect(wx + 1, 35, 8, 7, 'g1');
    g.rect(wx + 5, 35, 1, 7, 'w0');
    g.set(wx + 1, 35, 'g2');
  }
  // 黑板
  g.rect(16, 46, 8, 6, 'w1');
  g.rect(17, 47, 6, 4, 'a0');
  g.line(18, 48, 21, 48, 'n2');
  g.line(18, 50, 20, 50, 'n1');
  g.meta = { win: [[11, 35, 8, 7], [45, 35, 8, 7]], door: [32, 53] };
  return g.outline();
}

/** 船坞：伸进水里的木滑道，上面一副木筏的骨架，旁边一根吊杆 */
export function spShipyard(): G {
  const g = new G(72, 40);
  g.ell(36, 37, 34, 2.6, 'z');
  // 滑道（两条长木）
  for (const y of [22, 32]) {
    g.rect(2, y, 68, 3, 'w2');
    g.rect(2, y, 68, 1, 'w3');
    g.rect(2, y + 2, 68, 1, 'w0');
  }
  for (let x = 4; x < 70; x += 8) g.rect(x, 25, 3, 7, 'w1');
  // 木筏骨架
  for (let x = 18; x < 52; x += 5) {
    g.rect(x, 16, 3, 12, 'w2');
    g.set(x, 16, 'w3');
  }
  g.rect(16, 18, 38, 2, 'w1');
  g.rect(16, 24, 38, 2, 'w1');
  // 吊杆
  g.cyl(60, 2, 3, 22, 'w', [2, 1, 0]);
  g.line(61, 3, 44, 6, 'w1');
  g.line(46, 6, 46, 14, 'q0');
  g.rect(44, 14, 4, 3, 'm1');
  // 绳圈和工具
  g.ellS(8, 18, 4, 2.5, 'q', { lo: 0, hi: 1 });
  g.rect(64, 26, 5, 4, 'w2');
  return g.outline();
}

/** 进出口局：两层石楼，正中大门，屋顶上一面旗 */
export function spOffice(): G {
  const g = new G(92, 76);
  g.ell(46, 73, 44, 3.4, 'z');
  for (let y = 22; y < 72; y++)
    for (let x = 6; x < 86; x++) {
      const row = Math.floor((y - 22) / 4), off = row % 2 ? 5 : 0, mort = (y - 22) % 4 === 3 || (x + off) % 10 === 0;
      let i = mort ? 1 : x > 78 ? 2 : 3;
      if (y < 26) i = Math.max(0, i - 2);
      g.set(x, y, 's' + i);
    }
  // 屋顶
  for (let y = 8; y < 24; y++) {
    const t = (y - 8) / 16, x0 = Math.round(14 - t * 12), x1 = Math.round(78 + t * 12);
    for (let x = x0; x < x1; x++) g.set(x, y, (y - 8) % 4 === 3 ? 'r0' : x > x1 - 4 ? 'r1' : 'r2');
  }
  g.rect(1, 23, 90, 2, 'r0');
  // 旗
  g.cyl(45, 0, 2, 10, 'm', [2, 1]);
  g.rect(47, 1, 10, 6, 'e2');
  g.rect(47, 1, 10, 1, 'e3');
  g.rect(49, 3, 5, 2, 'x1');
  // 两层窗
  for (const wy of [30, 48])
    for (const wx of [12, 26, 58, 72]) {
      g.rect(wx, wy, 9, 10, 's0');
      g.rect(wx + 1, wy + 1, 7, 8, 'g1');
      g.rect(wx + 4, wy + 1, 1, 8, 's0');
      g.set(wx + 1, wy + 1, 'g2');
    }
  // 大门和台阶
  g.rect(38, 46, 16, 26, 's0');
  g.rect(39, 47, 14, 25, 'w1');
  g.rect(45, 47, 1, 25, 'w0');
  g.set(43, 59, 'y0');
  g.set(48, 59, 'y0');
  g.rect(36, 70, 20, 2, 's2');
  g.rect(36, 70, 20, 1, 's3');
  // 门牌
  g.rect(40, 40, 12, 4, 'x1');
  g.rect(40, 40, 12, 1, 'x2');
  g.meta = { win: [[13, 31, 7, 8], [27, 31, 7, 8], [59, 31, 7, 8], [73, 31, 7, 8], [13, 49, 7, 8], [73, 49, 7, 8]], door: [46, 71] };
  return g.outline();
}

/** 修好的直升机：停在主岛残骸的位置 */
export function spPlane(): G {
  const g = new G(112, 56);
  g.ell(54, 51, 46, 3.6, 'z');
  // 起落架
  g.rect(26, 46, 50, 2, 'm1');
  g.rect(26, 46, 50, 1, 'm2');
  for (const x of [34, 64]) g.rect(x, 40, 2, 7, 'm0');
  // 机身
  g.ellS(48, 30, 28, 13, 'm', { lo: 1 });
  g.rect(20, 34, 56, 2, 'x1');
  // 驾驶舱玻璃
  g.ellS(30, 27, 10, 8, 'g', { lo: 1, hi: 2 });
  g.line(26, 22, 34, 32, 'g2');
  // 门
  g.rect(50, 22, 12, 16, 'm0');
  g.rect(51, 23, 10, 14, 'm2');
  g.set(59, 31, 'm0');
  // 尾梁和尾桨
  for (let x = 74; x <= 100; x++) {
    const t = (x - 74) / 26, top = Math.round(26 - t * 4);
    for (let y = top; y < top + 4 - Math.round(t * 2); y++) g.set(x, y, 'm' + (y === top ? 3 : 2));
  }
  g.ellS(102, 20, 5, 5, 'm', { lo: 0, hi: 1 });
  g.line(97, 15, 107, 25, 'm0');
  g.line(107, 15, 97, 25, 'm0');
  // 主旋翼
  g.rect(44, 14, 8, 4, 'm0');
  g.rect(6, 12, 92, 2, 'm1');
  g.rect(6, 12, 92, 1, 'm3');
  return g.outline();
}

/** 农田里的麦子：0 刚种下的苗，1 长成的麦穗 */
export function spCrop(stage: 0 | 1): G {
  const g = new G(20, 14);
  for (let r = 0; r < 2; r++)
    for (let x = 2; x < 19; x += 4) {
      const by = 8 + r * 4;
      if (stage === 0) {
        g.set(x, by, 'l2');
        g.set(x - 1, by - 1, 'l1');
        g.set(x + 1, by - 1, 'l2');
      } else {
        g.line(x, by, x, by - 6, 'q0');
        g.set(x, by - 7, 'q2');
        g.set(x - 1, by - 6, 'q1');
        g.set(x + 1, by - 6, 'q2');
        g.set(x, by - 5, 'q1');
      }
    }
  return g.outline();
}

/** 海上的运输木筏：比自己的木筏宽，甲板上堆着货箱 */
export function spMiniCargoRaft(loaded: boolean): G {
  const g = new G(18, 14);
  for (let i = 0; i < 5; i++) {
    g.rect(1 + i * 3, 8, 3, 4, 'w2');
    g.set(3 + i * 3, 8, 'w1');
  }
  g.rect(1, 11, 15, 1, 'w0');
  g.rect(12, 1, 1, 8, 'w1');
  for (let y = 2; y < 7; y++) g.rect(13, y, Math.max(1, Math.round((y - 1) * 0.6)), 1, 'e2');
  // 船员
  g.rect(9, 4, 2, 1, 'i5');
  g.rect(9, 5, 2, 3, 'i4');
  if (loaded) {
    g.rect(2, 5, 5, 3, 'w3');
    g.rect(2, 5, 5, 1, 'x1');
    g.line(2, 5, 6, 7, 'w1');
  }
  return g.outline();
}
