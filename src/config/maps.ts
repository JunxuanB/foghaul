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
  /** 采集点数量（开局几个、每天新长几个、最多几个）；不写就用 BALANCE.forage 的（主岛的数量） */
  forageCounts?: Partial<Record<'tree' | 'herb', { start: number; perDay: number; max: number }>>;
  /** 外圈的雾：离中心的椭圆距离从 a 到 b 渐浓 */
  fog: [number, number];
  /**
   * 跟着存档变的物体放在哪（底边中点）：岛上的人、灯塔（没修时是地基）、
   * 加入网络后出现的工作台和储物箱、村落的请求板。主岛这些是固定物体，不用槽位。
   */
  slots?: {
    npc?: [number, number][];
    lighthouse?: [number, number];
    workbench?: [number, number];
    chest?: [number, number];
    board?: [number, number];
    /** 这座岛的设施建筑（加入网络、有了工作以后出现） */
    facility?: [number, number];
  };
}

/** 通用模板的岛上长多少树和草药（按群系，最多几个）；开局长满，每天补一半 */
export const BIOME_FORAGE: Record<string, { tree: number; herb: number }> = {
  forest: { tree: 9, herb: 1 },
  herb: { tree: 2, herb: 6 },
  stone: { tree: 1, herb: 1 },
  fishing: { tree: 2, herb: 1 },
  field: { tree: 2, herb: 2 },
  none: { tree: 2, herb: 1 },
};

/** 通用模板里树和草药能长的区域 */
export const GENERIC_FORAGE_ZONES: Record<'small' | 'village' | 'islet', { cx: number; cy: number; r: number }[]> = {
  small: [
    { cx: 200, cy: 130, r: 80 },
    { cx: 360, cy: 112, r: 60 },
    { cx: 420, cy: 220, r: 50 },
  ],
  village: [],
  islet: [],
};

/** 渔场群系的岛有浅滩钓点 */
export const GENERIC_SHOAL: Record<'small' | 'village' | 'islet', MapTemplate['shoal'] | undefined> = {
  small: { x: 120, y: 300, out: 15 },
  village: undefined,
  islet: undefined,
};

/** 没有专门模板的岛按种类用这些通用模板（M3 起再给每座岛做专门的模板）。装饰按群系在 world/templates.ts 里补 */
export const GENERIC_MAPS: Record<'small' | 'village' | 'islet', Omit<MapTemplate, 'id'>> = {
  // 乘客岛、原住民岛
  small: {
    w: 36,
    h: 22,
    island: { cx: 288, cy: 166, rx: 214, ry: 118, k: 170, noise: 18, noiseScale: 50, seed: 11 },
    paths: [
      [[300, 268], [300, 222], [340, 206]],
      [[340, 206], [426, 150]],
      [[300, 222], [226, 196], [176, 200]],
    ],
    pathWidth: 4.5,
    dock: { x: 300, y: 262, w: 16, len: 74 },
    spawn: [300, 270],
    objects: [],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[344, 214], [372, 222], [320, 236]], lighthouse: [430, 140], workbench: [222, 190], chest: [172, 202], facility: [246, 252] },
  },
  // 配方村、人力村、进出口局
  village: {
    w: 42,
    h: 24,
    island: { cx: 336, cy: 180, rx: 250, ry: 128, k: 180, noise: 18, noiseScale: 56, seed: 17 },
    paths: [
      [[340, 296], [340, 236], [300, 200]],
      [[340, 236], [420, 214], [500, 160]],
    ],
    pathWidth: 5,
    dock: { x: 340, y: 290, w: 16, len: 74 },
    spawn: [340, 298],
    objects: [['house', 220, 170], ['house', 440, 150], ['fire', 360, 214]],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[300, 216], [390, 230], [266, 244]], lighthouse: [520, 150], board: [318, 236] },
  },
  // 礁石（信标礁）
  islet: {
    w: 30,
    h: 18,
    island: { cx: 240, cy: 134, rx: 160, ry: 88, k: 150, noise: 14, noiseScale: 40, seed: 23 },
    paths: [[[246, 212], [246, 170], [290, 130]]],
    pathWidth: 4,
    dock: { x: 246, y: 206, w: 14, len: 66 },
    spawn: [246, 214],
    objects: [['boulder', 170, 150], ['rock', 320, 170], ['rock', 200, 104]],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[270, 176]], lighthouse: [300, 120] },
  },
};

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
  // ---------------- M3：A 段的专门地图（其他岛还用通用模板，见 world/templates.ts） ----------------
  // 石头岛：光秃秃的大石头，工程师用罐头盒和木箱搭了个营地；几乎不长树
  stoneIsle: {
    id: 'stoneIsle',
    w: 34,
    h: 22,
    island: { cx: 272, cy: 164, rx: 200, ry: 108, k: 160, noise: 22, noiseScale: 36, seed: 31 },
    paths: [
      [[270, 262], [270, 214], [228, 188]],
      [[270, 214], [336, 186], [396, 146]],
      [[270, 214], [200, 222]],
    ],
    pathWidth: 4.5,
    dock: { x: 270, y: 256, w: 16, len: 74 },
    spawn: [270, 264],
    objects: [
      // 工程师的营地：木箱、桶、一小堆火
      ['crate', 196, 168], ['barrel', 210, 174], ['fire', 250, 160],
      // 满岛的石头
      ['boulder', 120, 150], ['boulder', 150, 210], ['rock', 170, 120], ['rock', 300, 112], ['boulder', 350, 120],
      ['rock', 420, 190], ['boulder', 440, 160], ['rock', 380, 230], ['rock', 110, 190], ['bush', 330, 238],
    ],
    forage: { tree: [{ cx: 330, cy: 140, r: 36 }], herb: [{ cx: 160, cy: 170, r: 36 }] },
    forageCounts: { tree: { start: 2, perDay: 1, max: 2 }, herb: { start: 2, perDay: 1, max: 2 } },
    fog: [1.1, 1.38],
    slots: { npc: [[232, 192], [254, 202], [214, 206]], lighthouse: [400, 134], workbench: [318, 226], chest: [352, 214], facility: [190, 236] },
  },
  // 森林岛：大岛，树很密，伐木工就是在这里爬上树的
  forestIsle: {
    id: 'forestIsle',
    w: 40,
    h: 26,
    island: { cx: 320, cy: 192, rx: 250, ry: 138, k: 180, noise: 18, noiseScale: 60, seed: 41 },
    paths: [
      [[320, 322], [320, 262], [260, 234], [214, 222]],
      [[320, 262], [400, 234], [480, 176]],
      [[320, 262], [282, 290]],
    ],
    pathWidth: 4.5,
    dock: { x: 320, y: 322, w: 16, len: 74 },
    spawn: [320, 330],
    objects: [
      // 不能砍的老树围着岛边（能砍的树每天在 forage 区域里长）
      ['tree_d', 110, 180], ['tree_d', 140, 250], ['tree_d', 170, 120], ['tree_d', 236, 104], ['stree_d', 300, 96],
      ['tree_d', 382, 104], ['tree_d', 446, 118], ['tree_d', 528, 210], ['stree_d', 540, 250], ['tree_d', 470, 284],
      ['tree_d', 150, 296], ['stree_d', 206, 312], ['tree_d', 420, 304], ['bush', 360, 290], ['woodpile', 246, 266],
    ],
    forage: {
      tree: [{ cx: 210, cy: 168, r: 60 }, { cx: 430, cy: 190, r: 50 }, { cx: 320, cy: 160, r: 44 }],
      herb: [{ cx: 190, cy: 270, r: 34 }],
    },
    forageCounts: { tree: { start: 9, perDay: 4, max: 10 }, herb: { start: 1, perDay: 1, max: 1 } },
    fog: [1.1, 1.38],
    slots: { npc: [[222, 228], [250, 242], [196, 246]], lighthouse: [486, 162], workbench: [384, 258], chest: [418, 262], facility: [268, 304] },
  },
  // 原住民岛：原住民的营地，篝火、柴堆、几只桶
  nativeA: {
    id: 'nativeA',
    w: 36,
    h: 24,
    island: { cx: 288, cy: 176, rx: 220, ry: 122, k: 170, noise: 16, noiseScale: 48, seed: 53 },
    paths: [
      [[288, 290], [288, 236], [236, 210]],
      [[288, 236], [362, 216], [432, 164]],
      [[288, 236], [214, 258]],
    ],
    pathWidth: 4.5,
    dock: { x: 288, y: 290, w: 16, len: 74 },
    spawn: [288, 298],
    objects: [
      ['fire', 300, 196], ['woodpile', 336, 186], ['barrel', 252, 184], ['barrel', 264, 188], ['crate', 360, 252],
      ['palm', 130, 170], ['palm', 470, 220], ['palm', 160, 250], ['bush', 410, 260], ['rock', 220, 120], ['bush', 400, 120],
    ],
    forage: { tree: [{ cx: 160, cy: 200, r: 50 }, { cx: 420, cy: 230, r: 40 }], herb: [{ cx: 330, cy: 124, r: 44 }] },
    forageCounts: { tree: { start: 4, perDay: 2, max: 5 }, herb: { start: 2, perDay: 1, max: 3 } },
    fog: [1.1, 1.38],
    slots: { npc: [[244, 214], [272, 222], [226, 232]], lighthouse: [436, 152], workbench: [346, 262], chest: [384, 248], facility: [196, 270] },
  },
  // 渔民岛：长长的沙滩，晾着渔网；西南岸外有浅滩钓点
  fisherIsle: {
    id: 'fisherIsle',
    w: 38,
    h: 22,
    island: { cx: 304, cy: 152, rx: 236, ry: 102, k: 160, noise: 14, noiseScale: 60, seed: 67 },
    paths: [
      [[300, 246], [300, 206], [244, 184]],
      [[300, 206], [380, 190], [456, 128]],
      [[300, 206], [212, 214]],
    ],
    pathWidth: 4.5,
    dock: { x: 300, y: 246, w: 16, len: 72 },
    spawn: [300, 254],
    shoal: { x: 120, y: 240, out: 16 },
    objects: [
      ['net', 196, 168], ['net', 420, 222], ['barrel', 150, 200], ['crate', 164, 206], ['barrel', 470, 190],
      ['palm', 120, 150], ['palm', 500, 160], ['rock', 530, 140], ['rock', 260, 110], ['bush', 360, 110],
    ],
    forage: { tree: [{ cx: 380, cy: 130, r: 40 }], herb: [{ cx: 230, cy: 120, r: 34 }] },
    forageCounts: { tree: { start: 2, perDay: 1, max: 2 }, herb: { start: 1, perDay: 1, max: 1 } },
    fog: [1.1, 1.38],
    slots: { npc: [[250, 194], [276, 214], [230, 206]], lighthouse: [460, 116], workbench: [344, 230], chest: [376, 226], facility: [200, 232] },
  },
};
