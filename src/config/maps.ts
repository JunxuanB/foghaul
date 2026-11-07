// 岛屿地图模板：地形参数 + 固定的建筑槽位（像素坐标，底边中点）。种子只改细节。
// 2D 版先只有主岛（M1）；其他岛的模板在 M3 加。

export interface MapTemplate {
  id: string;
  /** 地图大小（格，16 像素一格） */
  w: number;
  h: number;
  /** 岛的椭圆：中心、半径（像素）、高度系数 */
  island: { cx: number; cy: number; rx: number; ry: number; k: number; noise: number; noiseScale: number; seed: number };
  /** 小路（折线，像素） */
  paths: [number, number][][];
  /** 小路半宽 */
  pathWidth: number;
  /** 农田空地 */
  field?: { x0: number; y0: number; x1: number; y1: number };
  /** 码头：从岸上 (x, y) 向下伸进海里 */
  dock?: { x: number; y: number; w: number; len: number };
  /** 浅滩钓点：从岛中心朝 (x, y) 方向找岸，放在岸外 out 像素 */
  shoal?: { x: number; y: number; out: number };
  /** 出生点（坠机残骸旁） */
  spawn: [number, number];
  /** 物体：[精灵名, x, y] */
  objects: [string, number, number][];
  /** 外圈的雾：离中心的椭圆距离从 a 到 b 渐浓 */
  fog: [number, number];
}

export const MAPS: Record<string, MapTemplate> = {
  home: {
    id: 'home',
    w: 52,
    h: 32,
    island: { cx: 416, cy: 252, rx: 362, ry: 214, k: 230, noise: 24, noiseScale: 70, seed: 3 },
    paths: [
      [[330, 196], [420, 228], [505, 256], [575, 320], [580, 418]],
      [[420, 228], [560, 206], [700, 206]],
      [[330, 196], [262, 214], [190, 236]],
      [[420, 228], [402, 300], [380, 410]],
    ],
    pathWidth: 5.5,
    field: { x0: 486, y0: 280, x1: 562, y1: 336 },
    dock: { x: 580, y: 412, w: 18, len: 78 },
    shoal: { x: 90, y: 410, out: 7 },
    spawn: [384, 424],
    objects: [
      // 树林（西边）
      ['tree', 112, 196], ['tree2', 156, 150], ['tree', 96, 262], ['stree', 146, 296], ['tree2', 190, 300], ['stree', 172, 228],
      ['tree', 220, 120], ['stree', 120, 136], ['tree2', 150, 352], ['stree', 230, 380], ['tree', 600, 120], ['stree', 650, 300],
      // 小屋、工作台、储物箱
      ['house', 330, 190], ['workbench', 424, 214], ['chest', 262, 204],
      // 灯塔、残骸
      ['light', 702, 200], ['wreck', 300, 444],
      // 草药丛、农田木牌
      ['herb', 520, 112], ['sign', 476, 340],
      // 装饰
      ['fire', 402, 284], ['woodpile', 470, 206], ['barrel', 610, 410], ['crate', 556, 404], ['net', 640, 380],
      ['bush', 250, 300], ['bush', 640, 250], ['bush', 520, 410], ['bush', 90, 330], ['palm', 720, 330], ['palm', 470, 456],
      ['palm', 130, 420], ['rock', 750, 260], ['boulder', 220, 430], ['rock', 680, 130], ['stump', 196, 196], ['rock', 360, 120],
    ],
    fog: [1.12, 1.42],
  },
};
