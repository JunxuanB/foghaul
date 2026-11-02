// 物品定义。数值（恢复量、贸易额）都可在这里直接调整。

export type ItemId =
  | 'wood'
  | 'fish'
  | 'herb'
  | 'water'
  | 'cup'
  | 'bottledWater'
  | 'medkit'
  | 'wheat'
  | 'bread'
  | 'grilledFish'
  | 'salt'
  | 'sandwich'
  | 'feast'
  | 'honeycomb'
  | 'partRotor'
  | 'partTail'
  | 'partPump'
  | 'partPanel'
  | 'partGear';

export interface ItemDef {
  id: ItemId;
  /** 可以装船/放背包。水是散装的，只能留在岛上。 */
  portable: boolean;
  /** 飞机零件：死亡不丢失 */
  key?: boolean;
  /** 吃/喝/用后的恢复量 */
  eat?: { hp?: number; water?: number; food?: number };
  /** 作为岛民食物时的档次（1 鱼 / 2 烤鱼面包 / 3 三明治） */
  foodTier?: number;
  /** 作为岛民饮水 */
  drink?: boolean;
  /** 进出口局单价（贸易额） */
  trade: number;
  verb?: 'eat' | 'drink' | 'use';
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { id: 'wood', portable: true, trade: 1 },
  fish: { id: 'fish', portable: true, eat: { food: 12 }, foodTier: 1, trade: 1, verb: 'eat' },
  herb: { id: 'herb', portable: true, eat: { hp: 15 }, trade: 2, verb: 'eat' },
  water: { id: 'water', portable: false, eat: { water: 25 }, drink: true, trade: 0, verb: 'drink' },
  cup: { id: 'cup', portable: true, trade: 1 },
  bottledWater: { id: 'bottledWater', portable: true, eat: { water: 25 }, drink: true, trade: 2, verb: 'drink' },
  medkit: { id: 'medkit', portable: true, eat: { hp: 60 }, trade: 6, verb: 'use' },
  wheat: { id: 'wheat', portable: true, trade: 1 },
  bread: { id: 'bread', portable: true, eat: { food: 28 }, foodTier: 2, trade: 4, verb: 'eat' },
  grilledFish: { id: 'grilledFish', portable: true, eat: { food: 28 }, foodTier: 2, trade: 3, verb: 'eat' },
  salt: { id: 'salt', portable: true, trade: 3 },
  sandwich: { id: 'sandwich', portable: true, eat: { food: 45, hp: 5 }, foodTier: 3, trade: 9, verb: 'eat' },
  feast: { id: 'feast', portable: true, eat: { food: 100, water: 30, hp: 30 }, trade: 30, verb: 'eat' },
  honeycomb: { id: 'honeycomb', portable: true, eat: { food: 8, hp: 8 }, foodTier: 1, trade: 2, verb: 'eat' },
  partRotor: { id: 'partRotor', portable: true, key: true, trade: 0 },
  partTail: { id: 'partTail', portable: true, key: true, trade: 0 },
  partPump: { id: 'partPump', portable: true, key: true, trade: 0 },
  partPanel: { id: 'partPanel', portable: true, key: true, trade: 0 },
  partGear: { id: 'partGear', portable: true, key: true, trade: 0 },
};

export const ITEM_ORDER: ItemId[] = [
  'water',
  'bottledWater',
  'fish',
  'grilledFish',
  'bread',
  'sandwich',
  'feast',
  'honeycomb',
  'herb',
  'medkit',
  'wood',
  'cup',
  'wheat',
  'salt',
  'partRotor',
  'partTail',
  'partPump',
  'partPanel',
  'partGear',
];

export const PART_IDS: ItemId[] = ['partRotor', 'partTail', 'partPump', 'partPanel', 'partGear'];

export function isFood(id: ItemId): boolean {
  return ITEMS[id].foodTier !== undefined;
}

export function isDrink(id: ItemId): boolean {
  return !!ITEMS[id].drink;
}
