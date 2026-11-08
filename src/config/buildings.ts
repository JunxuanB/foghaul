// 岛上的物体：精灵、碰撞底座、互动范围。坐标单位是像素，相对精灵底边中点。
// 一个建筑一个功能：kind 决定按 E 做什么（见 sim/interact.ts）。

export type ObjKind =
  | 'tree'
  | 'shoal'
  | 'herb'
  | 'workbench'
  | 'chest'
  | 'bed'
  | 'lighthouse'
  | 'wreck'
  | 'dock'
  | 'farm'
  | 'npc'
  | 'board'
  | 'raft'
  | 'facility'
  | 'plot'
  | 'school'
  | 'shipyard'
  | 'office'
  | 'helipad'
  | 'decor';

/** 相对底边中点的矩形：x、y 是左上角偏移 */
export interface RelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObjDef {
  kind: ObjKind;
  /** 碰撞底座（挡路）；没有就不挡 */
  foot?: RelRect;
  /** 互动范围（人物脚下离它不超过 reach 时可以互动）；默认等于底座 */
  hit?: RelRect;
}

/** 精灵名 → 物体定义 */
export const OBJ_DEFS: Record<string, ObjDef> = {
  tree: { kind: 'tree', foot: { x: -5, y: -6, w: 10, h: 6 }, hit: { x: -8, y: -10, w: 16, h: 10 } },
  tree2: { kind: 'tree', foot: { x: -5, y: -6, w: 10, h: 6 }, hit: { x: -8, y: -10, w: 16, h: 10 } },
  stree: { kind: 'tree', foot: { x: -4, y: -5, w: 8, h: 5 }, hit: { x: -7, y: -9, w: 14, h: 9 } },
  shoal: { kind: 'shoal', hit: { x: -13, y: -14, w: 26, h: 14 } },
  herb: { kind: 'herb', foot: { x: -8, y: -4, w: 16, h: 4 }, hit: { x: -10, y: -10, w: 20, h: 10 } },
  workbench: { kind: 'workbench', foot: { x: -17, y: -7, w: 34, h: 7 } },
  chest: { kind: 'chest', foot: { x: -12, y: -8, w: 24, h: 8 } },
  house: { kind: 'bed', foot: { x: -38, y: -16, w: 76, h: 16 }, hit: { x: -9, y: -6, w: 18, h: 6 } },
  light: { kind: 'lighthouse', foot: { x: -14, y: -10, w: 28, h: 10 }, hit: { x: -6, y: -8, w: 12, h: 8 } },
  wreck: { kind: 'wreck', foot: { x: -46, y: -16, w: 90, h: 14 } },
  sign: { kind: 'farm', foot: { x: -2, y: -3, w: 4, h: 3 }, hit: { x: -8, y: -6, w: 16, h: 6 } },
  fire: { kind: 'decor', foot: { x: -9, y: -6, w: 18, h: 6 } },
  woodpile: { kind: 'decor', foot: { x: -12, y: -7, w: 24, h: 7 } },
  crate: { kind: 'decor', foot: { x: -7, y: -4, w: 14, h: 4 } },
  barrel: { kind: 'decor', foot: { x: -6, y: -4, w: 12, h: 4 } },
  rock: { kind: 'decor', foot: { x: -5, y: -4, w: 10, h: 4 } },
  boulder: { kind: 'decor', foot: { x: -8, y: -6, w: 16, h: 6 } },
  bush: { kind: 'decor', foot: { x: -8, y: -4, w: 16, h: 4 } },
  palm: { kind: 'decor', foot: { x: -3, y: -4, w: 8, h: 4 } },
  net: { kind: 'decor', foot: { x: -18, y: -3, w: 36, h: 3 } },
  stump: { kind: 'decor', foot: { x: -6, y: -5, w: 12, h: 5 } },
  herbEmpty: { kind: 'decor' },
  // 其他岛：灯塔地基、岛上的人（所有人物精灵共用一套范围）、村落的请求板、装饰用的树（不能采）
  lhBase: { kind: 'lighthouse', foot: { x: -12, y: -7, w: 24, h: 7 }, hit: { x: -14, y: -10, w: 28, h: 10 } },
  npc: { kind: 'npc', foot: { x: -4, y: -4, w: 8, h: 4 }, hit: { x: -8, y: -12, w: 16, h: 12 } },
  board: { kind: 'board', foot: { x: -6, y: -4, w: 12, h: 4 }, hit: { x: -9, y: -8, w: 18, h: 8 } },
  // 设施建筑（所有设施共用一套范围，精灵按产物换，见 FACILITY_SPRITE）
  facility: { kind: 'facility', foot: { x: -14, y: -6, w: 28, h: 6 }, hit: { x: -17, y: -12, w: 34, h: 12 } },
  // 设施地基：网络里还没有工作的岛（刚招募的原住民岛），在这里培训第一份工作
  facilityBase: { kind: 'facility', foot: { x: -12, y: -5, w: 24, h: 5 }, hit: { x: -16, y: -12, w: 32, h: 12 } },
  // 停在码头边的木筏：货舱装卸、改造（在水里，不挡路）
  raft: { kind: 'raft', hit: { x: -21, y: -22, w: 42, h: 22 } },
  // M4 / M5：建设地基的木牌、建好的小屋（床）/ 仓库棚 / 停机坪、村落的学堂、主岛的船坞、进出口局、修好的直升机、麦子
  plotSign: { kind: 'plot', foot: { x: -2, y: -4, w: 4, h: 4 }, hit: { x: -10, y: -8, w: 20, h: 8 } },
  hut: { kind: 'bed', foot: { x: -21, y: -10, w: 42, h: 10 }, hit: { x: -6, y: -5, w: 12, h: 5 } },
  house_d: { kind: 'decor', foot: { x: -38, y: -16, w: 76, h: 16 } },
  hut_d: { kind: 'decor', foot: { x: -21, y: -10, w: 42, h: 10 } },
  shed: { kind: 'decor', foot: { x: -17, y: -7, w: 34, h: 7 } },
  pad: { kind: 'helipad', hit: { x: -18, y: -16, w: 36, h: 16 } },
  school: { kind: 'school', foot: { x: -28, y: -12, w: 56, h: 12 }, hit: { x: -8, y: -5, w: 16, h: 5 } },
  shipyard: { kind: 'shipyard', foot: { x: -34, y: -8, w: 68, h: 8 }, hit: { x: -36, y: -14, w: 72, h: 14 } },
  office: { kind: 'office', foot: { x: -42, y: -14, w: 84, h: 14 }, hit: { x: -9, y: -5, w: 18, h: 5 } },
  plane: { kind: 'helipad', foot: { x: -46, y: -16, w: 90, h: 14 }, hit: { x: -48, y: -18, w: 96, h: 18 } },
  crop0: { kind: 'decor' },
  crop1: { kind: 'decor' },
  tree_d: { kind: 'decor', foot: { x: -5, y: -6, w: 10, h: 6 } },
  stree_d: { kind: 'decor', foot: { x: -4, y: -5, w: 8, h: 5 } },
};

/** 每种互动对象的“初见介绍”和按键提示文字键：intro.<kind>、act.<kind> */
export const INTERACTIVE: ObjKind[] = ['tree', 'shoal', 'herb', 'workbench', 'chest', 'bed', 'lighthouse', 'wreck', 'dock', 'farm', 'npc', 'board', 'raft', 'facility', 'plot', 'school', 'shipyard', 'office', 'helipad'];

/** 模板槽位 → 放在这里的精灵（槽位上的东西跟着存档出现，见 sim/interact.ts 的 stateObjects） */
export const SLOT_SPRITE: Record<string, string> = {
  npc: 'npc',
  lighthouse: 'light',
  workbench: 'workbench',
  chest: 'chest',
  board: 'board',
  facility: 'facility',
  plot: 'plotSign',
  hut: 'hut',
  shed: 'shed',
  pad: 'pad',
  school: 'school',
  shipyard: 'shipyard',
  office: 'office',
};

/** 设施建筑的样子：产物或配方 id → 精灵名（docs/2d-design.md 第 6 节“设施建筑的样子”） */
export const FACILITY_SPRITE: Record<string, string> = {
  water: 'distiller',
  bottledWater: 'distiller',
  distill: 'distiller',
  wood: 'woodpile',
  cup: 'workbench',
  fish: 'net',
  grilledFish: 'grill',
  wheat: 'wheatPatch',
  bread: 'oven',
  sandwich: 'oven',
  feast: 'oven',
  herb: 'herbGarden',
  medkit: 'herbGarden',
  salt: 'saltPan',
  default: 'woodpile',
};
