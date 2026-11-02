import type { ItemId } from './items';

export type Role = 'engineer' | 'lumberjack' | 'fisher' | 'farmer' | 'doctor' | 'pilot';
export type Biome = 'field' | 'forest' | 'fishing' | 'stone' | 'herb';

/** 每个群系能生产的基础原料 */
export const BIOME_ITEM: Record<Biome, ItemId> = {
  field: 'wheat',
  forest: 'wood',
  fishing: 'fish',
  stone: 'water',
  herb: 'herb',
};

/** 乘客对应的群系（飞行员没有） */
export const ROLE_BIOME: Record<Role, Biome | null> = {
  engineer: 'stone',
  lumberjack: 'forest',
  fisher: 'fishing',
  farmer: 'field',
  doctor: 'herb',
  pilot: null,
};

export type RecipeId =
  | 'raft'
  | 'distill'
  | 'cup'
  | 'bottledWater'
  | 'medkit'
  | 'grilledFish'
  | 'salt'
  | 'bread'
  | 'sandwich'
  | 'feast'
  | 'transportRaft';

export interface RecipeDef {
  id: RecipeId;
  inputs: Partial<Record<ItemId, number>>;
  outputs: Partial<Record<ItemId, number>>;
  /** 绑定的乘客；加成群系即该乘客的群系 */
  role: Role | null;
  /** 玩家手动制作耗时（游戏分钟） */
  manualMinutes: number;
  /** 作为岛上加工设施时，每名工人每小时完成的批次 */
  batchesPerHour: number;
  /** 不能作为岛上设施（例如运输木筏只能由工程师手动建造） */
  noFacility?: boolean;
  /** 只能玩家手动（海水提炼、木筏） */
  manualOnly?: boolean;
  /** 特殊产物：做出来的不是物品（木筏） */
  special?: 'raft';
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  raft: {
    id: 'raft',
    inputs: { wood: 8 },
    outputs: {},
    role: null,
    manualMinutes: 60,
    batchesPerHour: 0,
    manualOnly: true,
    special: 'raft',
  },
  distill: {
    id: 'distill',
    inputs: {},
    outputs: { water: 3 },
    role: 'engineer',
    manualMinutes: 40,
    batchesPerHour: 0,
    manualOnly: true,
  },
  cup: {
    id: 'cup',
    inputs: { wood: 1 },
    outputs: { cup: 2 },
    role: 'lumberjack',
    manualMinutes: 20,
    batchesPerHour: 1,
  },
  bottledWater: {
    id: 'bottledWater',
    inputs: { water: 1, cup: 1 },
    outputs: { bottledWater: 1 },
    role: 'engineer',
    manualMinutes: 5,
    batchesPerHour: 2,
  },
  medkit: {
    id: 'medkit',
    inputs: { herb: 2 },
    outputs: { medkit: 1 },
    role: 'doctor',
    manualMinutes: 30,
    batchesPerHour: 0.5,
  },
  grilledFish: {
    id: 'grilledFish',
    inputs: { fish: 1 },
    outputs: { grilledFish: 1 },
    role: 'fisher',
    manualMinutes: 15,
    batchesPerHour: 1.5,
  },
  salt: {
    id: 'salt',
    inputs: { water: 2 },
    outputs: { salt: 1 },
    role: 'fisher',
    manualMinutes: 30,
    batchesPerHour: 0.5,
  },
  bread: {
    id: 'bread',
    inputs: { wheat: 2 },
    outputs: { bread: 1 },
    role: 'farmer',
    manualMinutes: 30,
    batchesPerHour: 0.75,
  },
  sandwich: {
    id: 'sandwich',
    inputs: { bread: 1, grilledFish: 1 },
    outputs: { sandwich: 2 },
    role: 'farmer',
    manualMinutes: 15,
    batchesPerHour: 0.5,
  },
  feast: {
    id: 'feast',
    inputs: { grilledFish: 2, bread: 2, salt: 1 },
    outputs: { feast: 1 },
    role: 'fisher',
    manualMinutes: 60,
    batchesPerHour: 0.2,
  },
  transportRaft: {
    id: 'transportRaft',
    inputs: { wood: 20 },
    outputs: {},
    role: 'engineer',
    manualMinutes: 120,
    batchesPerHour: 0,
    noFacility: true,
  },
};

export const RECIPE_ORDER: RecipeId[] = [
  'raft',
  'distill',
  'cup',
  'bottledWater',
  'medkit',
  'grilledFish',
  'salt',
  'bread',
  'sandwich',
  'feast',
  'transportRaft',
];
