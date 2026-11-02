import type { ItemId } from '../config/items';
import type { Biome, RecipeId, Role } from '../config/recipes';
import type { IslandKind, Stage, VillageId, WeaponId } from '../config/world';
import type { Msg } from './msg';

export type { Msg };

export type Stock = Partial<Record<ItemId, number>>;

export type LogTone = 'got' | 'bad' | 'hint' | 'warn';
export interface LogLine {
  at: number;
  m: Msg;
  c?: LogTone;
}

export type Facility = { kind: 'produce'; item: ItemId } | { kind: 'process'; recipe: RecipeId };
export type Job = Facility | { kind: 'crew' };

export interface Buildings {
  lighthouse: boolean;
  bed: boolean;
  depot: boolean;
  helipad: boolean;
}

export type MealState = 'full' | 'partial' | 'none';

export interface Island {
  id: string;
  kind: IslandKind;
  stage: Stage;
  x: number;
  y: number;
  rot: number;
  biome: Biome | null;
  /** 已被剧情解锁并放上地图（未解锁的岛坐标无意义） */
  revealed: boolean;
  /** 这座岛的灯塔每次照亮新海域时的事件编号（见 state.lit） */
  lightEvents: number[];
  discovered: boolean;
  visited: boolean;
  /** 已纳入网络（主岛、获救乘客岛、已招募原住民岛） */
  owned: boolean;
  /** 救援/招募需求的交付进度（按需求序号） */
  needProgress: number[];
  facility: Facility | null;
  level: number;
  mealStreak: number;
  lastMeal: MealState | null;
  /** 上一顿缺什么，用于界面提示 */
  lastMealNote: string;
  stock: Stock;
  buildings: Buildings;
  sleepy: boolean;
  prodAcc: number;
  /** 生产状态说明：缺原料、爆仓等 */
  workNote: string;
  /** 保留量：低于该值不外运 */
  reserve: Stock;
  /** 目标库存：达到后暂停运入 */
  target: Stock;
}

export type PersonLoc =
  | { kind: 'island'; id: string }
  | { kind: 'raft' }
  | { kind: 'route'; id: string };

export interface Person {
  id: string;
  name: Msg;
  type: 'passenger' | 'native';
  role: Role | null;
  job: Job | null;
  loc: PersonLoc;
  /** 死亡时随船人员回到这里 */
  lastIsland: string;
  /** 乘客学会的配方 */
  recipes: RecipeId[];
  /** 乘客经验（本工种全网产量；飞行员为运输量） */
  xp: number;
  /** 乘客已获救 / 原住民已招募 */
  active: boolean;
  learning: { recipe: RecipeId; until: number; village: VillageId } | null;
}

export interface VillageState {
  favor: number;
  /** 当前请求的交付进度 */
  progress: number[];
  /** 已解锁但还没有乘客来学的配方 */
  pendingRecipes: RecipeId[];
  repeatCount: number;
}

export interface Route {
  id: string;
  no: number;
  a: string;
  b: string;
  cargoAB: ItemId | null;
  cargoBA: ItemId | null;
  crewId: string;
  priority: 'high' | 'mid' | 'low';
  from: string;
  to: string;
  phase: 'sail' | 'dock';
  /** 航行：已走格数；靠岸：已用分钟 */
  progress: number;
  /** 本段长度（格） */
  length: number;
  /** 第一段从船员所在岛出发去 A 的起点坐标 */
  startX: number;
  startY: number;
  load: { item: ItemId; n: number } | null;
  supplies: { water: number; food: number };
  mealTimer: number;
  delivered: number;
  note: Msg;
}

export interface Order {
  item: ItemId;
  n: number;
  progress: number;
  deadline: number;
  reward: number;
}

export interface PlayerState {
  x: number;
  y: number;
  at: string | null;
  hp: number;
  water: number;
  food: number;
  hasRaft: boolean;
  pack: Stock;
  hold: Stock;
  holdCap: number;
  holdUpgrades: number;
  aboard: string[];
  xp: { sail: number; attack: number; manage: number };
  weapons: WeaponId[];
  recipes: RecipeId[];
  target: string | null;
  twoStep: boolean;
}

export interface PendingCrate {
  loot: Stock;
  text: Msg | null;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  time: number;
  width: number;
  height: number;
  islands: Island[];
  people: Person[];
  seen: number[];
  /** 可探索海域：每格记录“第一次照亮它的事件编号”，0 表示迷雾。由灯塔和试飞逐步打开 */
  lit: number[];
  /** 下一个照明事件编号 */
  lightSeq: number;
  /** 已经提示过“要修灯塔才能找到下一座岛”的岛 */
  lighthouseAsked: string[];
  /** 已经出现过的界面功能（新手引导逐步展示） */
  unlocks: string[];
  /** 已关闭的提示 */
  tips: string[];
  /** 刚学会、还没在制作页看过的配方 */
  newRecipes: RecipeId[];
  player: PlayerState;
  villages: Record<VillageId, VillageState>;
  flags: {
    herbsLeft: number;
    farm: (number | null)[];
    firstTraining: boolean;
    waterDispute: 'pending' | 'done' | null;
    partsInstalled: ItemId[];
    planeRepaired: boolean;
    flightDone: boolean;
    reported: boolean;
    whisperIndex: number;
  };
  hints: Record<string, Msg>;
  pendingCrate: PendingCrate | null;
  clueIndex: number;
  log: LogLine[];
  transport: { rafts: number; routes: Route[]; nextNo: number };
  bureau: {
    trade: number;
    totalTrade: number;
    exported: Stock;
    order: Order | null;
    nextOrderAt: number;
    ordersDone: number;
    upgrades: { speed: number; storage: number; output: number };
  };
  stats: { produced: Stock; transported: number; deaths: number; moves: number; fights: number; wins: number };
  /** 正在播放的过场文字 */
  cutscene: { kind: 'flight' | 'ending'; lines: string[] } | null;
  nextPersonNo: number;
}

export type Where = 'pack' | 'hold' | 'stock';

export type Command =
  | { t: 'move'; dx: number; dy: number }
  | { t: 'dock' }
  | { t: 'leave' }
  | { t: 'drinkSea' }
  | { t: 'fishSea' }
  | { t: 'takeCrate' }
  | { t: 'gather'; what: 'branch' | 'chop' | 'shoreFish' | 'herb' }
  | { t: 'craft'; recipe: RecipeId; times?: number }
  | { t: 'consume'; from: Where; item: ItemId }
  | { t: 'transfer'; item: ItemId; from: Where; to: Where; n: number }
  | { t: 'deliver' }
  | { t: 'build'; what: keyof Buildings | 'holdUpgrade' }
  | { t: 'sleep' }
  | { t: 'wake' }
  | { t: 'pickUp'; personId: string }
  | { t: 'dropOff'; personId: string }
  | { t: 'train'; personId: string; trainerId: string; job: Job }
  | { t: 'learn'; personId: string; recipe: RecipeId }
  | { t: 'plant'; plot: number }
  | { t: 'harvest'; plot: number }
  | { t: 'setTarget'; islandId: string | null }
  | { t: 'choose'; option: 'wheat' | 'labor' }
  | { t: 'buildTransportRaft' }
  | { t: 'createRoute'; a: string; b: string; cargoAB: ItemId | null; cargoBA: ItemId | null; crewId: string }
  | { t: 'updateRoute'; id: string; cargoAB?: ItemId | null; cargoBA?: ItemId | null; priority?: Route['priority'] }
  | { t: 'deleteRoute'; id: string }
  | { t: 'setReserve'; island: string; item: ItemId; n: number }
  | { t: 'setTargetStock'; island: string; item: ItemId; n: number | null }
  | { t: 'installPart'; item: ItemId }
  | { t: 'repairPlane' }
  | { t: 'endCutscene' }
  | { t: 'report' }
  | { t: 'wait'; minutes: number }
  | { t: 'export'; item: ItemId; from: Where; n: number }
  | { t: 'buyUpgrade'; kind: 'speed' | 'storage' | 'output' }
  | { t: 'fly'; to: string }
  | { t: 'toggleTwoStep' }
  | { t: 'dismissTip'; id: string }
  | { t: 'seenRecipes' };

export interface Result {
  ok: boolean;
  msg?: Msg;
}
