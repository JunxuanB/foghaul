// 岛屿、乘客、村落的内容配置。发现顺序按 ISLANDS 数组从上到下。
import type { ItemId } from './items';
import type { Biome, RecipeId, Role } from './recipes';

export type Need =
  | { kind: 'item'; item: ItemId; n: number }
  /** 任意食物（鱼、蜂巢、烤鱼、面包、三明治……） */
  | { kind: 'food'; n: number }
  /** 可运输的水 */
  | { kind: 'drink'; n: number };

export type IslandKind = 'home' | 'passenger' | 'native' | 'recipeVillage' | 'laborVillage' | 'bureau' | 'islet';
export type Stage = 'home' | 'A' | 'B' | 'C' | 'D' | 'bureau';

export interface IslandTemplate {
  id: string;
  kind: IslandKind;
  stage: Stage;
  /** 固定群系；'native' 表示随机；'forestOrStone' 表示二选一 */
  biome?: Biome | 'native' | 'forestOrStone';
  passenger?: Role;
  rescueNeed?: Need[];
  recruitNeed?: Need[];
  villageId?: VillageId;
}

/**
 * 剧情解锁顺序：一次只开放一座岛。
 * 条件 when 满足、并且锚点岛（anchor）修好了灯塔时，下一座岛才会在
 * 锚点岛灯塔新照亮、玩家还没去过的海域里生成，同时给出方向提示（hint，模板里用 {where}）。
 * 主岛开局自带一座小灯塔。条件的含义见 sim/reveal.ts 的 condMet。
 */
export type RevealCond =
  | 'start'
  | 'engineer'
  | 'lumberjack'
  | 'firstTraining'
  | 'fisher'
  | 'learned:grilledFish'
  | 'farmer'
  | 'learned:bread'
  | 'doctor'
  | 'pilotHome'
  | 'learned:transportRaft'
  | 'firstRoute'
  | 'recruited:nativeB';

export interface RevealDef {
  island: string;
  anchor: string;
  hint: string;
  when: RevealCond;
}

export const REVEALS: RevealDef[] = [
  { island: 'stoneIsle', anchor: 'home', hint: 'hint.start', when: 'start' },
  { island: 'forestIsle', anchor: 'stoneIsle', hint: 'rescue.engineer.hint', when: 'engineer' },
  { island: 'nativeA', anchor: 'forestIsle', hint: 'rescue.lumberjack.hint', when: 'lumberjack' },
  { island: 'fisherIsle', anchor: 'nativeA', hint: 'reveal.fisherIsle', when: 'firstTraining' },
  { island: 'village1', anchor: 'fisherIsle', hint: 'rescue.fisher.hint', when: 'fisher' },
  { island: 'farmIsle', anchor: 'village1', hint: 'reveal.farmIsle', when: 'learned:grilledFish' },
  { island: 'village2', anchor: 'farmIsle', hint: 'rescue.farmer.hint', when: 'farmer' },
  { island: 'herbIsle', anchor: 'village2', hint: 'reveal.herbIsle', when: 'learned:bread' },
  { island: 'pilotIsle', anchor: 'herbIsle', hint: 'rescue.doctor.hint', when: 'doctor' },
  { island: 'village3', anchor: 'pilotIsle', hint: 'reveal.village3', when: 'pilotHome' },
  { island: 'laborVillage', anchor: 'village3', hint: 'reveal.laborVillage', when: 'learned:transportRaft' },
  { island: 'nativeB', anchor: 'laborVillage', hint: 'reveal.nativeB', when: 'firstRoute' },
  { island: 'nativeC', anchor: 'nativeB', hint: 'reveal.nativeC', when: 'recruited:nativeB' },
];

export const ISLANDS: IslandTemplate[] = [
  {
    id: 'home',
    kind: 'home',
    stage: 'home',
  },
  {
    id: 'stoneIsle',
    kind: 'passenger',
    stage: 'A',
    biome: 'stone',
    passenger: 'engineer',
    rescueNeed: [{ kind: 'item', item: 'fish', n: 3 }],
  },
  {
    id: 'forestIsle',
    kind: 'passenger',
    stage: 'A',
    biome: 'forest',
    passenger: 'lumberjack',
    rescueNeed: [{ kind: 'food', n: 4 }],
  },
  {
    id: 'nativeA',
    kind: 'native',
    stage: 'A',
    biome: 'forestOrStone',
    recruitNeed: [
      { kind: 'drink', n: 3 },
      { kind: 'food', n: 3 },
    ],
  },
  {
    id: 'fisherIsle',
    kind: 'passenger',
    stage: 'A',
    biome: 'fishing',
    passenger: 'fisher',
    rescueNeed: [
      { kind: 'food', n: 3 },
      { kind: 'drink', n: 3 },
    ],
  },
  {
    id: 'village1',
    kind: 'recipeVillage',
    stage: 'B',
    villageId: 'tide',
  },
  {
    id: 'farmIsle',
    kind: 'passenger',
    stage: 'B',
    biome: 'field',
    passenger: 'farmer',
    rescueNeed: [
      { kind: 'item', item: 'fish', n: 4 },
      { kind: 'item', item: 'grilledFish', n: 2 },
    ],
  },
  {
    id: 'village2',
    kind: 'recipeVillage',
    stage: 'C',
    villageId: 'wheat',
  },
  {
    id: 'herbIsle',
    kind: 'passenger',
    stage: 'C',
    biome: 'herb',
    passenger: 'doctor',
    rescueNeed: [
      { kind: 'food', n: 3 },
      { kind: 'drink', n: 3 },
    ],
  },
  {
    id: 'nativeB',
    kind: 'native',
    stage: 'C',
    biome: 'native',
    recruitNeed: [
      { kind: 'drink', n: 4 },
      { kind: 'item', item: 'grilledFish', n: 3 },
    ],
  },
  {
    id: 'pilotIsle',
    kind: 'islet',
    stage: 'D',
    biome: 'stone',
    passenger: 'pilot',
    rescueNeed: [{ kind: 'item', item: 'medkit', n: 1 }],
  },
  {
    id: 'village3',
    kind: 'recipeVillage',
    stage: 'D',
    villageId: 'dock',
  },
  {
    id: 'laborVillage',
    kind: 'laborVillage',
    stage: 'D',
    villageId: 'labor',
  },
  {
    id: 'nativeC',
    kind: 'native',
    stage: 'D',
    biome: 'native',
    recruitNeed: [
      { kind: 'drink', n: 4 },
      { kind: 'item', item: 'bread', n: 3 },
    ],
  },
  {
    id: 'bureau',
    kind: 'bureau',
    stage: 'bureau',
  },
];

// ---------------- 武器 ----------------
export type WeaponId = 'harpoon' | 'flareGun';
export const WEAPONS: Record<WeaponId, { force: number }> = {
  harpoon: { force: 6 },
  flareGun: { force: 12 },
};

// ---------------- 村落 ----------------
export type VillageId = 'tide' | 'wheat' | 'dock' | 'labor';

export interface Reward {
  recipe?: RecipeId;
  weapon?: WeaponId;
  part?: ItemId;
  natives?: number;
}

export interface VillageRequest {
  need: Need[];
  reward: Reward;
}

export interface VillageDef {
  id: VillageId;
  kind: 'recipe' | 'labor';
  /** 只有该乘客在场（岛上或船上）时才肯交易 */
  trustRole?: Role;
  requests: VillageRequest[];
  /** 全部完成后可重复的请求（人力村） */
  repeat?: VillageRequest;
}

export const VILLAGES: Record<VillageId, VillageDef> = {
  tide: {
    id: 'tide',
    kind: 'recipe',
    requests: [
      {
        need: [
          { kind: 'item', item: 'fish', n: 6 },
          { kind: 'drink', n: 4 },
        ],
        reward: { recipe: 'grilledFish' },
      },
      {
        need: [
          { kind: 'item', item: 'wood', n: 15 },
          { kind: 'item', item: 'cup', n: 6 },
        ],
        reward: { weapon: 'harpoon' },
      },
      {
        need: [
          { kind: 'item', item: 'grilledFish', n: 8 },
          { kind: 'item', item: 'wood', n: 10 },
        ],
        reward: { recipe: 'salt' },
      },
      {
        need: [
          { kind: 'item', item: 'salt', n: 6 },
          { kind: 'drink', n: 10 },
        ],
        reward: { part: 'partRotor' },
      },
    ],
  },
  wheat: {
    id: 'wheat',
    kind: 'recipe',
    trustRole: 'farmer',
    requests: [
      {
        need: [{ kind: 'item', item: 'wheat', n: 10 }],
        reward: { recipe: 'bread' },
      },
      {
        need: [
          { kind: 'item', item: 'bread', n: 6 },
          { kind: 'item', item: 'grilledFish', n: 6 },
        ],
        reward: { recipe: 'sandwich' },
      },
      {
        need: [
          { kind: 'item', item: 'sandwich', n: 5 },
          { kind: 'item', item: 'salt', n: 5 },
        ],
        reward: { part: 'partTail' },
      },
    ],
  },
  dock: {
    id: 'dock',
    kind: 'recipe',
    requests: [
      {
        need: [
          { kind: 'item', item: 'wood', n: 30 },
          { kind: 'item', item: 'medkit', n: 3 },
        ],
        reward: { recipe: 'transportRaft' },
      },
      {
        need: [
          { kind: 'item', item: 'sandwich', n: 6 },
          { kind: 'item', item: 'cup', n: 10 },
        ],
        reward: { weapon: 'flareGun' },
      },
      {
        need: [
          { kind: 'item', item: 'bread', n: 8 },
          { kind: 'item', item: 'grilledFish', n: 8 },
          { kind: 'item', item: 'salt', n: 6 },
        ],
        reward: { recipe: 'feast' },
      },
      {
        need: [{ kind: 'item', item: 'feast', n: 2 }],
        reward: { part: 'partPump' },
      },
    ],
  },
  labor: {
    id: 'labor',
    kind: 'labor',
    requests: [
      {
        need: [
          { kind: 'item', item: 'fish', n: 8 },
          { kind: 'drink', n: 8 },
        ],
        reward: { natives: 1 },
      },
      {
        need: [
          { kind: 'item', item: 'bread', n: 6 },
          { kind: 'drink', n: 8 },
        ],
        reward: { natives: 1 },
      },
      {
        need: [
          { kind: 'item', item: 'grilledFish', n: 8 },
          { kind: 'item', item: 'medkit', n: 2 },
        ],
        reward: { natives: 1, part: 'partPanel' },
      },
    ],
    repeat: {
      need: [
        { kind: 'item', item: 'sandwich', n: 4 },
        { kind: 'drink', n: 6 },
      ],
      reward: { natives: 1 },
    },
  },
};

/** 两村争水源事件：在麦香村好感 ≥ 2 且已发现人力村后触发 */
export const WATER_DISPUTE = {
  minWheatFavor: 2,
  options: [
    {
      id: 'wheat' as const,
      reward: { part: 'partGear' as ItemId },
    },
    {
      id: 'labor' as const,
      reward: { part: 'partGear' as ItemId, natives: 1 },
    },
  ],
};
