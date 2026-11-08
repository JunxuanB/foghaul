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
    /** 建设地基的木牌（网络里的岛）：按 E 选建床、仓库、停机坪 */
    plot?: [number, number];
    /** 建好以后出现的小屋（床）、仓库棚、停机坪 */
    hut?: [number, number];
    shed?: [number, number];
    pad?: [number, number];
    /** 村落的学堂（同伴在这里学配方） */
    school?: [number, number];
    /** 主岛的船坞（造运输木筏、设运输线） */
    shipyard?: [number, number];
    /** 进出口局的办公楼（报到、出口、订单、升级） */
    office?: [number, number];
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
    slots: { npc: [[344, 214], [372, 222], [320, 236]], lighthouse: [430, 140], workbench: [222, 190], chest: [172, 202], facility: [246, 252], plot: [400, 236], hut: [150, 150], shed: [230, 120], pad: [300, 110] },
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
    objects: [['house_d', 200, 160], ['house_d', 470, 150], ['fire', 380, 250]],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[300, 216], [390, 230], [266, 244]], lighthouse: [520, 150], board: [318, 236], school: [250, 266] },
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
    slots: { npc: [[270, 176]], lighthouse: [300, 120], workbench: [190, 186], chest: [160, 176], facility: [212, 212], plot: [320, 186], hut: [150, 126], pad: [360, 150] },
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
    // 主岛的床、工作台、储物箱、灯塔、残骸是固定物体；跟着存档出现的：建设地基、仓库棚、船坞
    slots: { plot: [560, 182], shed: [612, 168], shipyard: [500, 452] },
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
    slots: { npc: [[232, 192], [254, 202], [214, 206]], lighthouse: [400, 134], workbench: [318, 226], chest: [352, 214], facility: [190, 236], plot: [146, 182], hut: [260, 120], shed: [330, 172], pad: [200, 120] },
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
    slots: { npc: [[222, 228], [250, 242], [196, 246]], lighthouse: [486, 162], workbench: [384, 258], chest: [418, 262], facility: [268, 304], plot: [450, 230], hut: [160, 200], shed: [340, 214], pad: [380, 138] },
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
    slots: { npc: [[244, 214], [272, 222], [226, 232]], lighthouse: [436, 152], workbench: [346, 262], chest: [384, 248], facility: [196, 270], plot: [150, 210], hut: [180, 150], shed: [300, 128], pad: [440, 236] },
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
    slots: { npc: [[250, 194], [276, 214], [230, 206]], lighthouse: [460, 116], workbench: [344, 230], chest: [376, 226], facility: [200, 232], plot: [420, 190], hut: [330, 130], shed: [180, 140], pad: [480, 160] },
  },

  // ---------------- M4 / M5：B、C、D 段和村落、进出口局 ----------------
  // 农民岛：一大片麦田，晒着草垛
  farmIsle: {
    id: 'farmIsle',
    w: 40,
    h: 24,
    island: { cx: 320, cy: 180, rx: 250, ry: 130, k: 180, noise: 16, noiseScale: 60, seed: 71 },
    paths: [
      [[320, 296], [320, 250], [262, 226]],
      [[320, 250], [404, 232], [470, 180]],
      [[262, 226], [190, 214]],
      [[320, 250], [372, 278]],
    ],
    pathWidth: 4.5,
    dock: { x: 320, y: 296, w: 16, len: 74 },
    spawn: [320, 304],
    objects: [
      ['wheatPatch', 392, 132], ['wheatPatch', 436, 144], ['wheatPatch', 392, 160], ['wheatPatch', 348, 146], ['wheatPatch', 436, 172],
      ['woodpile', 246, 176], ['barrel', 170, 250], ['crate', 184, 256], ['post', 372, 168], ['bush', 520, 200], ['bush', 110, 190], ['stree_d', 140, 140], ['palm', 520, 250], ['rock', 450, 270],
    ],
    forage: { tree: [{ cx: 150, cy: 170, r: 40 }, { cx: 500, cy: 220, r: 30 }], herb: [{ cx: 230, cy: 120, r: 40 }] },
    forageCounts: { tree: { start: 3, perDay: 1, max: 3 }, herb: { start: 2, perDay: 1, max: 2 } },
    fog: [1.1, 1.38],
    slots: { npc: [[270, 232], [296, 242], [248, 248]], lighthouse: [478, 166], workbench: [404, 262], chest: [440, 256], facility: [212, 274], plot: [150, 214], hut: [190, 148], shed: [290, 130], pad: [330, 104] },
  },
  // 医生岛：草药长满山坡，医生搭了一个药圃
  herbIsle: {
    id: 'herbIsle',
    w: 36,
    h: 24,
    island: { cx: 288, cy: 184, rx: 218, ry: 124, k: 170, noise: 18, noiseScale: 44, seed: 83 },
    paths: [
      [[288, 298], [288, 244], [232, 218]],
      [[288, 244], [360, 226], [426, 170]],
      [[232, 218], [170, 228]],
    ],
    pathWidth: 4.5,
    dock: { x: 288, y: 298, w: 16, len: 74 },
    spawn: [288, 306],
    objects: [
      ['herbGarden', 330, 196], ['crate', 206, 196], ['barrel', 194, 202],
      ['bush', 120, 180], ['bush', 150, 250], ['bush', 420, 250], ['bush', 460, 210], ['stree_d', 110, 220], ['stree_d', 470, 150], ['rock', 360, 110], ['bush', 230, 110],
    ],
    forage: { tree: [{ cx: 440, cy: 230, r: 30 }], herb: [{ cx: 170, cy: 160, r: 50 }, { cx: 390, cy: 150, r: 46 }, { cx: 330, cy: 270, r: 30 }] },
    forageCounts: { tree: { start: 2, perDay: 1, max: 2 }, herb: { start: 6, perDay: 3, max: 7 } },
    fog: [1.1, 1.38],
    slots: { npc: [[238, 222], [262, 234], [220, 240]], lighthouse: [430, 156], workbench: [352, 262], chest: [386, 256], facility: [196, 276], plot: [140, 206], hut: [190, 146], shed: [300, 136], pad: [250, 128] },
  },
  // 第二座原住民岛：海边的高脚营地
  nativeB: {
    id: 'nativeB',
    w: 36,
    h: 24,
    island: { cx: 288, cy: 176, rx: 220, ry: 122, k: 170, noise: 18, noiseScale: 52, seed: 97 },
    paths: [
      [[288, 290], [288, 236], [236, 210]],
      [[288, 236], [362, 216], [432, 164]],
      [[288, 236], [214, 258]],
    ],
    pathWidth: 4.5,
    dock: { x: 288, y: 290, w: 16, len: 74 },
    spawn: [288, 298],
    objects: [
      ['fire', 304, 194], ['woodpile', 340, 184], ['net', 250, 178], ['barrel', 380, 200],
      ['palm', 120, 180], ['palm', 470, 200], ['palm', 150, 250], ['palm', 400, 270], ['rock', 230, 110], ['boulder', 390, 110], ['bush', 480, 250],
    ],
    forage: { tree: [{ cx: 160, cy: 200, r: 44 }], herb: [{ cx: 340, cy: 124, r: 40 }, { cx: 420, cy: 240, r: 30 }] },
    forageCounts: { tree: { start: 3, perDay: 1, max: 4 }, herb: { start: 2, perDay: 1, max: 3 } },
    fog: [1.1, 1.38],
    slots: { npc: [[244, 214], [272, 222], [226, 232]], lighthouse: [436, 152], workbench: [346, 262], chest: [384, 248], facility: [196, 270], plot: [150, 214], hut: [180, 150], shed: [300, 128], pad: [440, 236] },
  },
  // 第三座原住民岛：石头和棕榈，营地在岛中间
  nativeC: {
    id: 'nativeC',
    w: 38,
    h: 24,
    island: { cx: 304, cy: 180, rx: 230, ry: 124, k: 170, noise: 20, noiseScale: 40, seed: 109 },
    paths: [
      [[304, 294], [304, 240], [252, 214]],
      [[304, 240], [378, 220], [448, 168]],
      [[304, 240], [230, 262]],
    ],
    pathWidth: 4.5,
    dock: { x: 304, y: 294, w: 16, len: 74 },
    spawn: [304, 302],
    objects: [
      ['fire', 320, 198], ['woodpile', 356, 188], ['barrel', 268, 186], ['crate', 282, 190],
      ['boulder', 130, 170], ['rock', 160, 250], ['palm', 490, 220], ['palm', 140, 210], ['boulder', 420, 120], ['rock', 240, 120], ['bush', 430, 270],
    ],
    forage: { tree: [{ cx: 180, cy: 200, r: 40 }, { cx: 430, cy: 230, r: 30 }], herb: [{ cx: 340, cy: 128, r: 40 }] },
    forageCounts: { tree: { start: 3, perDay: 1, max: 4 }, herb: { start: 2, perDay: 1, max: 2 } },
    fog: [1.1, 1.38],
    slots: { npc: [[260, 218], [288, 226], [242, 236]], lighthouse: [452, 156], workbench: [362, 266], chest: [400, 252], facility: [212, 274], plot: [166, 218], hut: [196, 152], shed: [316, 132], pad: [456, 240] },
  },
  // 信标礁：飞行员抱着降落伞坐在礁石上
  pilotIsle: {
    id: 'pilotIsle',
    w: 32,
    h: 20,
    island: { cx: 256, cy: 150, rx: 180, ry: 100, k: 150, noise: 16, noiseScale: 36, seed: 113 },
    paths: [
      [[256, 230], [256, 190], [304, 160]],
      [[256, 190], [200, 178]],
    ],
    pathWidth: 4,
    dock: { x: 256, y: 226, w: 14, len: 66 },
    spawn: [256, 234],
    objects: [['boulder', 130, 150], ['boulder', 380, 140], ['rock', 170, 112], ['rock', 330, 200], ['crate', 316, 170], ['rock', 360, 104]],
    forage: { tree: [], herb: [{ cx: 300, cy: 110, r: 30 }] },
    forageCounts: { tree: { start: 0, perDay: 0, max: 0 }, herb: { start: 1, perDay: 1, max: 1 } },
    fog: [1.1, 1.38],
    slots: { npc: [[290, 178], [312, 188], [270, 196]], lighthouse: [330, 112], workbench: [196, 172], chest: [166, 184], facility: [214, 212], plot: [372, 178], hut: [176, 134], shed: [250, 112], pad: [300, 216] },
  },
  // 潮汐村：渔村，木屋沿着海滩，请求板在广场上，学堂在西边
  village1: {
    id: 'village1',
    w: 42,
    h: 24,
    island: { cx: 336, cy: 180, rx: 250, ry: 128, k: 180, noise: 16, noiseScale: 56, seed: 127 },
    paths: [
      [[340, 290], [340, 236], [300, 206]],
      [[340, 236], [420, 214], [500, 160]],
      [[300, 206], [220, 196]],
      [[340, 236], [212, 266]],
    ],
    pathWidth: 5,
    dock: { x: 340, y: 290, w: 16, len: 74 },
    spawn: [340, 298],
    objects: [
      ['house_d', 200, 160], ['house_d', 470, 150], ['fire', 400, 252], ['net', 140, 232], ['net', 530, 220], ['barrel', 450, 270], ['crate', 464, 274], ['palm', 110, 200], ['palm', 570, 200], ['rock', 300, 112],
    ],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[302, 226], [392, 232], [270, 246]], lighthouse: [530, 140], board: [320, 232], school: [206, 254] },
  },
  // 麦香村：麦田围着村子，风车一样的草垛
  village2: {
    id: 'village2',
    w: 42,
    h: 24,
    island: { cx: 336, cy: 180, rx: 250, ry: 128, k: 180, noise: 14, noiseScale: 64, seed: 131 },
    paths: [
      [[340, 290], [340, 236], [300, 206]],
      [[340, 236], [420, 214], [500, 160]],
      [[300, 206], [220, 196]],
      [[340, 236], [212, 266]],
    ],
    pathWidth: 5,
    dock: { x: 340, y: 290, w: 16, len: 74 },
    spawn: [340, 298],
    objects: [
      ['house_d', 200, 160], ['house_d', 470, 150], ['wheatPatch', 330, 120], ['wheatPatch', 372, 132], ['wheatPatch', 120, 220], ['wheatPatch', 560, 210], ['wheatPatch', 500, 250],
      ['woodpile', 410, 250], ['post', 360, 160], ['barrel', 280, 160],
    ],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[302, 226], [392, 232], [270, 246]], lighthouse: [530, 140], board: [320, 232], school: [206, 254] },
  },
  // 船坞村：船坞和木料堆，村民都会造船
  village3: {
    id: 'village3',
    w: 42,
    h: 24,
    island: { cx: 336, cy: 180, rx: 250, ry: 128, k: 180, noise: 18, noiseScale: 50, seed: 139 },
    paths: [
      [[340, 290], [340, 236], [300, 206]],
      [[340, 236], [420, 214], [500, 160]],
      [[300, 206], [220, 196]],
      [[340, 236], [212, 266]],
    ],
    pathWidth: 5,
    dock: { x: 340, y: 290, w: 16, len: 74 },
    spawn: [340, 298],
    objects: [
      ['house_d', 200, 160], ['house_d', 470, 150], ['woodpile', 420, 256], ['woodpile', 140, 236], ['crate', 520, 230], ['crate', 534, 236], ['barrel', 548, 228], ['net', 300, 120], ['fire', 400, 200], ['palm', 580, 190],
    ],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[302, 226], [392, 232], [270, 246]], lighthouse: [530, 140], board: [320, 232], school: [206, 254] },
  },
  // 人力村：一排小屋，想找活干的原住民在广场上等
  laborVillage: {
    id: 'laborVillage',
    w: 40,
    h: 24,
    island: { cx: 320, cy: 180, rx: 240, ry: 126, k: 180, noise: 16, noiseScale: 50, seed: 151 },
    paths: [
      [[320, 290], [320, 236], [270, 210]],
      [[320, 236], [400, 216], [470, 164]],
      [[270, 210], [200, 200]],
    ],
    pathWidth: 5,
    dock: { x: 320, y: 290, w: 16, len: 74 },
    spawn: [320, 298],
    objects: [
      ['hut_d', 180, 156], ['hut_d', 260, 136], ['hut_d', 420, 140], ['fire', 340, 196], ['woodpile', 380, 250], ['barrel', 230, 250], ['palm', 110, 210], ['palm', 520, 220], ['rock', 470, 260],
    ],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[290, 224], [362, 232], [262, 240], [380, 210], [240, 222]], lighthouse: [490, 150], board: [304, 236] },
  },
  // 进出口局：石楼、停机坪、货栈
  bureau: {
    id: 'bureau',
    w: 44,
    h: 26,
    island: { cx: 352, cy: 196, rx: 262, ry: 136, k: 190, noise: 12, noiseScale: 70, seed: 137 },
    paths: [
      [[352, 312], [352, 206]],
      [[352, 260], [480, 238]],
      [[352, 260], [230, 250]],
    ],
    pathWidth: 6,
    dock: { x: 352, y: 312, w: 18, len: 76 },
    spawn: [352, 320],
    objects: [['crate', 200, 240], ['crate', 214, 246], ['barrel', 190, 252], ['barrel', 560, 270], ['palm', 140, 200], ['palm', 580, 180], ['bush', 260, 150], ['bush', 450, 150], ['net', 600, 230]],
    forage: { tree: [], herb: [] },
    fog: [1.1, 1.38],
    slots: { npc: [[326, 232], [392, 236]], office: [352, 204], pad: [500, 236] },
  },
};
