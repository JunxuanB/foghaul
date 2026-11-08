import { describe, expect, it } from 'vitest';
import { FEET, canStand, forageSpots, layout, raster, rectDist, T, TILE } from '../src/world/island';
import { OBJ_DEFS } from '../src/config/buildings';
import { ISLANDS } from '../src/config/world';
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

describe('every island has a walkable map', () => {
  for (const def of ISLANDS) {
    if (def.id === 'home') continue;
    it(`${def.id} (${def.kind}): dock, people, lighthouse and buildings are reachable`, () => {
      const seed = 7;
      const { L, R, W, S, seen } = reachable(def.id, seed);
      expect(canStand(R, ...L.spawn)).toBe(true);
      const reach = BALANCE.interact.reach;
      const t = L.template;
      const slotPts: [number, number][] = [...(t.slots?.npc ?? []), ...[t.slots?.lighthouse, t.slots?.workbench, t.slots?.chest, t.slots?.board, t.slots?.facility].filter((x): x is [number, number] => !!x)];
      const targets = [...L.objects.filter((o) => o.kind !== 'decor' && o.hit).map((o) => ({ id: o.id, r: o.hit! })), ...slotPts.map(([x, y], i) => ({ id: 'slot' + i, r: { x: x - 10, y: y - 10, w: 20, h: 10 } }))];
      for (const o of targets) {
        let ok = false;
        for (let i = 0; i < seen.length && !ok; i++) {
          if (!seen[i]) continue;
          if (rectDist((i % W) * S + 1, ((i / W) | 0) * S + 1 + FEET.y / 2, o.r) <= reach) ok = true;
        }
        expect(ok, `${def.id} ${o.id} reachable`).toBe(true);
      }
      // 码头的外端在水里，槽位都在陆地上
      const d = L.dock!;
      expect(R.cls[Math.floor(d.y + d.h - 2) * R.w + Math.floor(d.x + d.w / 2)]).toBeLessThan(T.sand);
      for (const [x, y] of slotPts) expect(R.cls[Math.floor(y - 2) * R.w + Math.floor(x)], `${def.id} slot ${x},${y} on land`).toBeGreaterThanOrEqual(T.sand);
    });
  }
});

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
      // 每个可以长树 / 草药的位置都走得到（采集点的互动范围在可达的格子旁边）
      for (const kind of ['tree', 'herb'] as const) {
        const list = forageSpots('home', seed, kind);
        expect(list.length, kind + ' spots').toBeGreaterThan(kind === 'tree' ? 30 : 15);
        const hit = OBJ_DEFS[kind === 'tree' ? 'tree' : 'herb'].hit!;
        for (const [x, y] of list) {
          const r = { x: x + hit.x, y: y + hit.y, w: hit.w, h: hit.h };
          let ok = false;
          for (let i = 0; i < seen.length && !ok; i++) {
            if (!seen[i]) continue;
            if (rectDist((i % W) * S + 1, ((i / W) | 0) * S + 1 + FEET.y / 2, r) <= reach) ok = true;
          }
          expect(ok, `${kind} spot ${x},${y} reachable`).toBe(true);
        }
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
