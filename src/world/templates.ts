// 每座岛用哪张地图模板：有专门模板（config/maps.ts 的 MAPS）就用它，否则按岛的种类用通用模板，
// 再按群系补上装饰（石头岛多石头、森林岛多树……）。纯函数，按岛 id 缓存。
import { GENERIC_MAPS, MAPS, type MapTemplate } from '../config/maps';
import { ISLANDS } from '../config/world';
import { hash } from '../art/noise';

/** 各群系的装饰：[精灵名, 权重] */
const DECOR: Record<string, [string, number][]> = {
  stone: [['boulder', 3], ['rock', 4], ['bush', 1]],
  forest: [['tree_d', 4], ['stree_d', 3], ['bush', 2]],
  fishing: [['net', 1], ['barrel', 2], ['crate', 2], ['rock', 2], ['palm', 2]],
  field: [['bush', 2], ['stree_d', 1], ['rock', 1], ['woodpile', 1]],
  herb: [['bush', 4], ['stree_d', 2], ['rock', 1]],
  none: [['bush', 2], ['palm', 2], ['rock', 2]],
};

/** 装饰的候选位置（相对岛中心，按椭圆半径的比例）：避开小路和槽位附近，由 hash 决定用哪几个 */
const SPOTS: [number, number][] = [
  [-0.72, -0.2], [-0.55, 0.25], [-0.35, -0.55], [-0.12, -0.62], [0.08, -0.4], [0.3, -0.62],
  [0.62, -0.05], [0.7, 0.3], [0.45, 0.45], [-0.75, 0.05], [-0.25, 0.48], [0.2, 0.62], [0.55, -0.4], [-0.5, -0.45],
];

const cache = new Map<string, MapTemplate | null>();

export function templateFor(islandId: string): MapTemplate | null {
  if (cache.has(islandId)) return cache.get(islandId)!;
  let t: MapTemplate | null = MAPS[islandId] ?? null;
  if (!t) {
    const def = ISLANDS.find((x) => x.id === islandId);
    if (def) {
      const g = def.kind === 'islet' ? GENERIC_MAPS.islet : def.kind === 'recipeVillage' || def.kind === 'laborVillage' || def.kind === 'bureau' ? GENERIC_MAPS.village : GENERIC_MAPS.small;
      const I = g.island;
      const seed = [...islandId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) & 0xffff;
      const pool = DECOR[def.biome ?? 'none'] ?? DECOR.none;
      const total = pool.reduce((a, [, w]) => a + w, 0);
      const objects: [string, number, number][] = [...g.objects];
      SPOTS.forEach(([fx, fy], i) => {
        if (hash(i, seed, 5) < 0.3) return;
        let r = hash(i, seed, 6) * total;
        const pick = pool.find(([, w]) => (r -= w) < 0)?.[0] ?? pool[0][0];
        objects.push([pick, Math.round(I.cx + fx * I.rx), Math.round(I.cy + fy * I.ry)]);
      });
      t = { ...g, id: islandId, island: { ...I, seed: I.seed + (seed % 97) }, objects };
    }
  }
  cache.set(islandId, t);
  return t;
}
