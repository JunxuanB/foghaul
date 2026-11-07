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
};

/** 每种互动对象的“初见介绍”和按键提示文字键：intro.<kind>、act.<kind> */
export const INTERACTIVE: ObjKind[] = ['tree', 'shoal', 'herb', 'workbench', 'chest', 'bed', 'lighthouse', 'wreck', 'dock', 'farm'];
