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
  /** 农田空地（四周有围栏，围栏挡路） */
  field?: { x0: number; y0: number; x1: number; y1: number };
  /** 码头：从岸上 (x, y) 向下伸进海里 */
  dock?: { x: number; y: number; w: number; len: number };
  /** 浅滩钓点：从岛中心朝 (x, y) 方向找岸，放在岸外 out 像素 */
  shoal?: { x: number; y: number; out: number };
  /** 出生点（坠机残骸旁） */
  spawn: [number, number];
  /** 固定的物体：[精灵名, x, y]。树和草药不在这里，它们每天随机刷新（见 forage） */
  objects: [string, number, number][];
  /**
   * 可刷新的采集点：在这些圆形区域里的草地上随机长出来（具体位置用存档的随机数挑）。
   * 数量、每天长几棵、每棵能采几次在 BALANCE.forage。
   */
  forage: Record<'tree' | 'herb', { cx: number; cy: number; r: number }[]>;
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
    // 浅滩钓点放在出生点东南的南岸：开局就在画面里，周围没有树挡着
    shoal: { x: 470, y: 520, out: 15 },
    spawn: [384, 424],
    objects: [
      // 小屋、工作台、储物箱
      ['house', 330, 190], ['workbench', 424, 214], ['chest', 262, 204],
      // 灯塔、残骸
      ['light', 702, 200], ['wreck', 300, 444],
      // 农田木牌
      ['sign', 476, 340],
      // 装饰
      ['fire', 402, 284], ['woodpile', 470, 206], ['barrel', 610, 410], ['crate', 556, 404], ['net', 640, 380],
      ['bush', 250, 300], ['bush', 640, 250], ['bush', 520, 410], ['bush', 90, 330], ['palm', 720, 330], ['palm', 130, 420], ['rock', 750, 260], ['boulder', 220, 430], ['rock', 680, 130], ['stump', 196, 196], ['rock', 360, 120],
    ],
    forage: {
      // 树：西边的树林为主，北边和东边各一小片
      tree: [
        { cx: 160, cy: 250, r: 130 },
        { cx: 590, cy: 120, r: 80 },
        { cx: 660, cy: 300, r: 50 },
      ],
      // 草药：散在岛上各处
      herb: [
        { cx: 520, cy: 120, r: 60 },
        { cx: 250, cy: 330, r: 70 },
        { cx: 690, cy: 260, r: 50 },
        { cx: 130, cy: 160, r: 60 },
        { cx: 420, cy: 360, r: 50 },
      ],
    },
    fog: [1.12, 1.42],
  },
};
