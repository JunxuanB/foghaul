import { describe, expect, it } from 'vitest';
import { FEET, canStand, layout, raster, rectDist, T, TILE } from '../src/world/island';
import { BALANCE } from '../src/config/balance';

/** 从出生点按 2 像素一步做洪水填充，返回能站到的点 */
function reachable(id: string, seed: number) {
  const L = layout(id, seed);
  const R = raster(id, seed);
  const S = 2;
  const W = Math.ceil(R.w / S);
  const H = Math.ceil(R.h / S);
  const seen = new Uint8Array(W * H);
  const q: number[] = [];
  const [sx, sy] = L.spawn;
  const start = Math.floor(sy / S) * W + Math.floor(sx / S);
  seen[start] = 1;
  q.push(start);
  while (q.length) {
    const i = q.pop()!;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (seen[j]) continue;
      if (!canStand(R, nx * S + 1, ny * S + 1)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return { L, R, W, S, seen };
}

describe('home island map', () => {
  for (const seed of [1, 42, 2026, 99991]) {
    it(`is consistent and every interactive object is reachable (seed ${seed})`, () => {
      const { L, R, W, S, seen } = reachable('home', seed);
      expect(canStand(R, ...L.spawn)).toBe(true);
      // 同一种子结果一致
      expect(layout('home', seed)).toBe(L);
      const reach = BALANCE.interact.reach;
      for (const o of L.objects) {
        if (o.kind === 'decor' || !o.hit) continue;
        let ok = false;
        for (let i = 0; i < seen.length && !ok; i++) {
          if (!seen[i]) continue;
          const x = (i % W) * S + 1;
          const y = ((i / W) | 0) * S + 1;
          if (rectDist(x, y + FEET.y / 2, o.hit) <= reach) ok = true;
        }
        expect(ok, `${o.id} reachable`).toBe(true);
      }
      // 码头的外端在水里
      const d = L.dock!;
      const ei = Math.floor(d.y + d.h - 2) * R.w + Math.floor(d.x + d.w / 2);
      expect(R.cls[ei]).toBeLessThan(T.sand);
      // 有整格可走的格子
      expect(R.tiles.reduce((a, b) => a + b, 0)).toBeGreaterThan(200);
      expect(R.w).toBe(L.template.w * TILE);
    });
  }
});
