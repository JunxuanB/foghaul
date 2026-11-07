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

// ---------------------------------------------------------------- 界面图标（ui_ 前缀，不是物品）
// 面板里用图画代替句子：吃饱的碗、空碗、等级星、时间、箭头、警告、对勾、背包、货舱、仓库、人。

/** 一个碗：lit 为吃饱（暖色、冒热气），否则是空碗（冷色） */
const bowl = (lit: boolean) => (g: G) => {
  const c = lit ? ['w1', 'w2', 'w3'] : ['s0', 's1', 's2'];
  g.ellS(8, 10, 6.5, 3.6, lit ? 'w' : 's', { lo: lit ? 1 : 0 });
  for (let y = 7; y < 10; y++) g.rect(2, y, 13, 1, 'o');
  g.rect(2, 9, 13, 1, c[1]);
  g.rect(3, 8, 11, 1, lit ? 'q1' : 's0');
  if (lit) {
    g.rect(4, 7, 9, 1, 'q2');
    g.set(6, 4, 'i6'); g.set(7, 3, 'i6'); g.set(10, 4, 'i6'); g.set(9, 2, 'i6');
  }
  g.rect(6, 14, 5, 1, c[0]);
};
ic('ui_bowl', bowl(true));
ic('ui_bowlEmpty', bowl(false));
ic('ui_star', (g) => {
  const pts = [[8, 2], [8, 3], [7, 4], [8, 4], [9, 4], [7, 5], [8, 5], [9, 5]];
  for (const [x, y] of pts) g.set(x, y, 'i11');
  g.rect(3, 6, 11, 2, 'i11'); g.rect(5, 8, 7, 2, 'i11'); g.rect(5, 10, 3, 2, 'i10'); g.rect(9, 10, 3, 2, 'i10'); g.rect(4, 12, 2, 1, 'i10'); g.rect(11, 12, 2, 1, 'i10');
  g.rect(7, 6, 3, 3, 'i10');
});
ic('ui_starEmpty', (g) => {
  g.rect(3, 6, 11, 2, 'i3'); g.rect(5, 8, 7, 2, 'i3'); g.rect(5, 10, 3, 2, 'i3'); g.rect(9, 10, 3, 2, 'i3');
  for (const [x, y] of [[8, 2], [8, 3], [7, 4], [8, 4], [9, 4], [7, 5], [8, 5], [9, 5], [4, 12], [5, 12], [11, 12], [12, 12]]) g.set(x, y, 'i3');
});
ic('ui_clock', (g) => {
  g.ellS(8, 8, 6, 6, 'e', { hi: 3 });
  g.ell(8, 8, 4.5, 4.5, 'e3');
  g.line(8, 8, 8, 4, 'o'); g.line(8, 8, 11, 8, 'o'); g.set(8, 8, 'x1');
});
ic('ui_arrow', (g) => {
  g.rect(2, 7, 9, 3, 'i10');
  for (let i = 0; i < 5; i++) g.rect(10 + i, 3 + i, 1, 11 - i * 2, 'i10');
});
ic('ui_warn', (g) => {
  for (let y = 2; y < 14; y++) { const w = Math.round((y - 2) * 0.55); g.rect(8 - w, y, 1 + w * 2, 1, 'i10'); }
  g.rect(7, 5, 2, 5, 'i0'); g.rect(7, 11, 2, 2, 'i0');
});
ic('ui_check', (g) => {
  g.line(3, 8, 6, 11, 'i11'); g.line(3, 9, 6, 12, 'i11'); g.line(6, 11, 13, 4, 'i11'); g.line(6, 12, 13, 5, 'i11');
});
ic('ui_pack', (g) => {
  g.rect(3, 4, 10, 10, 'w1'); g.rect(3, 4, 10, 1, 'w2'); g.rect(4, 2, 8, 2, 'w0');
  g.rect(5, 7, 6, 3, 'w2'); g.rect(7, 8, 2, 1, 'q2'); g.rect(3, 13, 10, 1, 'w0'); g.rect(12, 5, 1, 8, 'w0');
});
ic('ui_hold', (g) => {
  g.rect(1, 9, 14, 4, 'w1'); g.rect(1, 9, 14, 1, 'w2'); g.rect(1, 12, 14, 1, 'w0');
  for (const x of [4, 8, 12]) g.rect(x, 9, 1, 4, 'w0');
  g.rect(5, 4, 6, 5, 'w2'); g.rect(5, 4, 6, 1, 'w3'); g.rect(7, 6, 2, 1, 'w0'); g.rect(10, 5, 1, 4, 'w0');
});
ic('ui_stock', (g) => {
  g.rect(2, 5, 12, 9, 'w1'); g.rect(2, 5, 12, 2, 'w2'); g.rect(2, 7, 12, 1, 'w0'); g.rect(7, 7, 2, 2, 'q2'); g.rect(2, 13, 12, 1, 'w0'); g.rect(13, 5, 1, 9, 'w0');
});
ic('ui_person', (g) => {
  g.ellS(8, 5, 3, 3, 'k', { hi: 1 }); g.rect(4, 9, 8, 5, 'i4'); g.rect(4, 9, 8, 1, 'i5'); g.rect(11, 9, 1, 5, 'i3');
});
ic('ui_personEmpty', (g) => {
  for (const [x, y] of [[7, 2], [9, 2], [5, 4], [11, 4], [5, 6], [11, 6], [7, 8], [9, 8], [4, 10], [6, 10], [10, 10], [12, 10], [4, 12], [12, 12]]) g.set(x, y, 'i3');
});
ic('ui_eye', (g) => {
  g.ellS(8, 8, 6.5, 3.5, 'e', { hi: 3 }); g.ell(8, 8, 2.4, 2.4, 'i1'); g.set(7, 7, 'e3');
});
