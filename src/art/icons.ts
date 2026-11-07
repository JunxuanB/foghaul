// 物品图标 16 × 16（从设计稿 B 移植）。放在夜海色格子里，不画影子。
import { G } from './grid';

/** 物品 id（以及武器 spear）→ 图标 */
export const ICONS: Record<string, G> = {};

const ic = (name: string, fn: (g: G) => void) => {
  const g = new G(16, 16);
  fn(g);
  ICONS[name] = g.outline();
};

ic('wood', (g) => { g.rect(2, 5, 10, 7, 'w1'); g.rect(2, 5, 10, 1, 'w2'); g.rect(2, 11, 10, 1, 'w0'); g.ellS(12, 8.5, 2.6, 3.6, 'w', { lo: 2 }); g.set(12, 8, 'w1'); g.set(5, 8, 'w0'); g.set(8, 7, 'w0'); });
ic('fish', (g) => { g.ellS(7, 8, 5.5, 3.2, 'g', { hi: 2 }); g.rect(12, 6, 1, 5, 'g0'); g.rect(13, 5, 1, 7, 'g0'); g.rect(14, 4, 1, 9, 'g1'); g.set(4, 7, 'o'); g.set(7, 4, 'g0'); g.set(6, 6, 'e3'); });
ic('herb', (g) => { g.line(8, 9, 8, 14, 'l0'); g.ellS(5.5, 8, 2.6, 4, 'l'); g.ellS(10.5, 7, 2.6, 4, 'l'); g.ellS(8, 4, 1.8, 2.6, 'l'); });
ic('water', (g) => { g.ellS(8, 10, 4.5, 4.5, 'g', { bias: -.15, hi: 2 }); for (let y = 2; y < 7; y++) { const w = Math.round((y - 2) * .8); g.rect(8 - w, y, 1 + w * 2, 1, 'g1'); } g.set(6, 9, 'e3'); g.set(6, 10, 'g2'); });
ic('cup', (g) => { g.rect(4, 4, 8, 10, 'e1'); g.rect(5, 4, 6, 9, 'e3'); g.rect(5, 5, 6, 1, 'e1'); g.rect(10, 5, 1, 8, 'e1'); g.rect(12, 6, 2, 1, 'e1'); g.rect(13, 6, 1, 4, 'e1'); g.rect(12, 9, 2, 1, 'e1'); });
ic('bottledWater', (g) => { g.rect(4, 4, 8, 10, 'e1'); g.rect(5, 4, 6, 9, 'e3'); g.rect(5, 7, 6, 6, 'g1'); g.rect(5, 7, 6, 1, 'g2'); g.rect(10, 7, 1, 6, 'g0'); });
ic('medkit', (g) => { g.rect(2, 5, 12, 9, 'e2'); g.rect(2, 5, 12, 1, 'e3'); g.rect(13, 5, 1, 9, 'e0'); g.rect(2, 13, 12, 1, 'e0'); g.rect(6, 3, 4, 2, 'e0'); g.rect(7, 7, 2, 5, 'x1'); g.rect(5, 8, 6, 2, 'x1'); g.set(7, 7, 'x2'); });
ic('wheat', (g) => { for (const [x0, x1] of [[5, 7], [8, 8], [11, 9]]) g.line(x0, 4, x1, 14, 'q0'); for (const [x, y] of [[5, 2], [5, 3], [4, 4], [6, 4], [8, 1], [8, 2], [7, 3], [9, 3], [11, 2], [11, 3], [10, 4], [12, 4]]) g.set(x, y, y < 3 ? 'q2' : 'q1'); g.rect(6, 10, 5, 1, 'w1'); });
ic('bread', (g) => { g.ellS(8, 9, 6.5, 4, 'w', { lo: 1 }); g.line(5, 7, 6, 9, 'q2'); g.line(8, 6, 9, 9, 'q2'); g.line(11, 7, 12, 9, 'q2'); });
ic('grilledFish', (g) => { g.line(1, 13, 14, 4, 'w1'); g.ellS(8, 8, 5.5, 3.2, 'w', { lo: 1 }); g.rect(13, 6, 1, 5, 'w0'); g.rect(14, 5, 1, 7, 'w1'); g.set(5, 7, 'o'); for (const x of [6, 8, 10]) g.line(x, 6, x + 1, 10, 'w0'); });
ic('salt', (g) => { g.ellS(8, 10.5, 5.5, 3.8, 'n', { hi: 2 }); g.rect(5, 5, 6, 2, 'n1'); g.rect(6, 4, 4, 1, 'n0'); for (const [x, y] of [[7, 2], [8, 2], [6, 3], [9, 3], [8, 3]]) g.set(x, y, 'e3'); });
ic('sandwich', (g) => { g.rect(2, 4, 12, 3, 'w2'); g.rect(2, 4, 12, 1, 'w3'); g.rect(2, 7, 12, 1, 'l3'); g.rect(2, 8, 12, 1, 'x1'); g.rect(2, 9, 12, 1, 'q2'); g.rect(2, 10, 12, 3, 'w2'); g.rect(2, 12, 12, 1, 'w0'); g.rect(13, 4, 1, 9, 'w1'); for (const x of [3, 6, 9, 12]) g.set(x, 7, 'l2'); });
ic('feast', (g) => { g.ellS(8, 10, 7, 4, 'e', { lo: 1 }); g.ell(8, 9.5, 5, 2.6, 'e3'); g.ellS(6, 8, 3, 1.8, 'w', { lo: 1 }); g.ellS(10.5, 8, 2.4, 2, 'x', { hi: 2 }); g.ellS(8, 6.5, 2, 1.6, 'q', { hi: 2 }); g.set(11, 6, 'l2'); g.set(12, 7, 'l3'); });
ic('honeycomb', (g) => { g.ellS(8, 8, 6, 6, 'q', { hi: 2 }); for (let y = 2; y < 15; y++) for (let x = 2; x < 15; x++) { if (!g.get(x, y)) continue; const row = Math.floor(y / 3), xo = (x + (row % 2) * 2) % 4; if (y % 3 === 0 || xo === 0) g.set(x, y, 'q0'); } });
ic('partRotor', (g) => { g.line(2, 13, 13, 2, 'm1'); g.line(3, 13, 14, 2, 'm2'); g.line(3, 14, 14, 3, 'm0'); g.rect(12, 2, 2, 2, 'x1'); g.ellS(3, 13, 1.6, 1.6, 'm', { lo: 0, hi: 1 }); });
ic('partTail', (g) => { g.line(8, 8, 8, 2, 'm2'); g.line(8, 8, 2, 12, 'm2'); g.line(8, 8, 14, 12, 'm2'); g.line(9, 8, 9, 2, 'm1'); g.ellS(8, 8, 1.8, 1.8, 'm', { lo: 0, hi: 1 }); g.set(8, 2, 'x1'); g.set(2, 12, 'x1'); g.set(14, 12, 'x1'); });
ic('partPump', (g) => { g.cyl(4, 4, 8, 9, 'm', [3, 2, 2, 1, 1, 0]); g.rect(4, 4, 8, 1, 'm3'); g.rect(4, 12, 8, 1, 'm0'); g.rect(6, 2, 4, 2, 'x1'); g.rect(12, 7, 3, 2, 'm1'); g.rect(1, 9, 3, 2, 'm1'); g.rect(6, 7, 4, 2, 'm0'); });
ic('partPanel', (g) => { g.rect(1, 4, 14, 9, 'm0'); g.rect(2, 5, 12, 7, 'm1'); g.ell(5, 8.5, 2.4, 2.4, 'e3'); g.ell(11, 8.5, 2.4, 2.4, 'e3'); g.line(5, 9, 6, 7, 'x1'); g.line(11, 9, 10, 7, 'x1'); g.set(8, 6, 'y1'); g.set(8, 10, 'g2'); });
ic('spear', (g) => { g.line(2, 14, 12, 4, 'w1'); g.line(3, 14, 13, 4, 'w2'); g.rect(12, 2, 2, 2, 'm2'); g.set(14, 1, 'm3'); g.set(11, 3, 'm1'); g.set(13, 4, 'm1'); });
ic('partGear', (g) => { g.rect(2, 12, 12, 2, 'm1'); g.rect(2, 13, 12, 1, 'm0'); g.set(1, 11, 'm1'); g.line(4, 4, 5, 12, 'm2'); g.line(11, 4, 10, 12, 'm2'); g.rect(3, 3, 10, 2, 'm1'); g.rect(3, 3, 10, 1, 'm2'); });
