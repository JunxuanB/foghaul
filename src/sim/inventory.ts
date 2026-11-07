import { BALANCE } from '../config/balance';
import { ITEMS, ITEM_ORDER, type ItemId } from '../config/items';
import type { Need } from '../config/world';
import { itemM, m, type Msg } from './msg';
import type { GameState, Island, Stock, Where } from './types';
import { findIsland, stockAdd, stockGet } from './util';

// ---------------- 岛上：储物箱（格子）、水缸（淡水）、设施暂存箱 ----------------
// 储物箱和背包、货舱同一套“格子 + 堆叠”规则，格数随岛等级变多；
// 淡水是散装的，不占格子，放在单独的水缸里（容量随等级变大）；
// 设施的产物先进它旁边的暂存箱（isl.output），满了就停工。

const IS = BALANCE.inventory.island;

/** 散装的东西（淡水）：不占格子，放水缸 */
export function isBulk(item: ItemId): boolean {
  return !ITEMS[item].portable;
}

export function storageMult(state: GameState): number {
  return 1 + state.bureau.upgrades.storage * BALANCE.endgame.upgrades.storage.per;
}

/** 储物箱有几格（村落没有仓库） */
export function stockSlots(state: GameState, isl: Island): number {
  if (isl.kind === 'bureau') return IS.bureauSlots;
  if (isl.kind === 'recipeVillage' || isl.kind === 'laborVillage') return 0;
  const base = isl.kind === 'home' ? IS.homeSlots : IS.slots[isl.level - 1] ?? IS.slots[IS.slots.length - 1];
  return Math.round((base + (isl.buildings.depot ? IS.depotSlots : 0)) * storageMult(state));
}

/** 水缸能装多少淡水 */
export function tankCap(state: GameState, isl: Island): number {
  if (isl.kind === 'bureau') return IS.bureauSlots * BALANCE.inventory.stack.consumable;
  if (isl.kind === 'recipeVillage' || isl.kind === 'laborVillage') return 0;
  const base = isl.kind === 'home' ? IS.homeTank : IS.tank[isl.level - 1] ?? IS.tank[IS.tank.length - 1];
  return Math.round((base + (isl.buildings.depot ? IS.depotTank : 0)) * storageMult(state));
}

/** 储物箱里占格子的那部分（去掉水缸里的淡水） */
export function dryStock(s: Stock): Stock {
  const out: Stock = {};
  for (const [k, v] of Object.entries(s)) if (!isBulk(k as ItemId) && (v ?? 0) > 0) out[k as ItemId] = v;
  return out;
}

/** 岛上还能放多少个 item：淡水看水缸，其他看储物箱的格子 */
export function stockRoom(state: GameState, isl: Island, item: ItemId): number {
  if (isBulk(item)) return Math.max(0, tankCap(state, isl) - stockGet(isl.stock, item));
  return roomIn(dryStock(isl.stock), stockSlots(state, isl), item);
}

/** 往岛上库存加货，返回实际加入的数量 */
export function addToStock(state: GameState, isl: Island, item: ItemId, n: number): number {
  const k = Math.min(n, stockRoom(state, isl, item));
  if (k > 0) stockAdd(isl.stock, item, k);
  return k;
}

/** 设施暂存箱能放几个 item（按等级几格，每格一组） */
export function outputCap(isl: Island, item: ItemId): number {
  const stacks = IS.outputStacks[isl.level - 1] ?? IS.outputStacks[IS.outputStacks.length - 1];
  return stacks * stackOf(item);
}

export function outputRoom(isl: Island, item: ItemId): number {
  return Math.max(0, outputCap(isl, item) - stockGet(isl.output, item));
}

/** 岛上能用的（储物箱 + 设施暂存箱）：岛民吃饭先拿储物箱的，不够再拿暂存箱里刚产出来的 */
export function islandSupply(isl: Island, item: ItemId): number {
  return stockGet(isl.stock, item) + stockGet(isl.output, item);
}

/** 从岛上取走一个（先储物箱，后暂存箱），没有返回 false */
export function takeFromIsland(isl: Island, item: ItemId): boolean {
  if (stockGet(isl.stock, item) > 0) stockAdd(isl.stock, item, -1);
  else if (stockGet(isl.output, item) > 0) stockAdd(isl.output, item, -1);
  else return false;
  return true;
}

// ---------------- 背包、货舱：格子 + 堆叠 ----------------

/** 一格最多放多少个 */
export function stackOf(item: ItemId): number {
  const def = ITEMS[item];
  if (def.key) return Infinity;
  return def.eat ? BALANCE.inventory.stack.consumable : BALANCE.inventory.stack.material;
}

/** 占用的格数（零件不占格） */
export function slotsUsed(s: Stock): number {
  let n = 0;
  for (const [k, v] of Object.entries(s)) {
    const id = k as ItemId;
    if (!ITEMS[id].key && (v ?? 0) > 0) n += Math.ceil((v ?? 0) / stackOf(id));
  }
  return n;
}

/** slots 格的容器里还能放多少个 item */
export function roomIn(s: Stock, slots: number, item: ItemId): number {
  if (ITEMS[item].key) return Infinity;
  const st = stackOf(item);
  const have = stockGet(s, item);
  const partial = have > 0 ? Math.ceil(have / st) * st - have : 0;
  return partial + Math.max(0, slots - slotsUsed(s)) * st;
}

/** 背包里还能放多少个 item */
export function packRoom(state: GameState, item: ItemId): number {
  return roomIn(state.player.pack, BALANCE.inventory.packCap, item);
}

/** 货舱里还能放多少个 item（没有木筏为 0） */
export function holdRoom(state: GameState, item: ItemId): number {
  if (!state.player.hasRaft) return 0;
  return roomIn(state.player.hold, state.player.holdCap, item);
}

export interface SlotView {
  id: ItemId;
  n: number;
}

/** 把一个容器排成格子（按物品顺序，超过堆叠上限的拆成几格）。零件另列 */
export function slotView(s: Stock): { slots: SlotView[]; keys: SlotView[] } {
  const slots: SlotView[] = [];
  const keys: SlotView[] = [];
  for (const id of ITEM_ORDER) {
    let n = stockGet(s, id);
    if (n <= 0) continue;
    if (ITEMS[id].key) {
      keys.push({ id, n });
      continue;
    }
    const st = stackOf(id);
    while (n > 0) {
      slots.push({ id, n: Math.min(st, n) });
      n -= st;
    }
  }
  return { slots, keys };
}

export function carried(state: GameState, item: ItemId): number {
  return stockGet(state.player.pack, item) + stockGet(state.player.hold, item);
}

/** 从玩家身上取走（先货舱，后背包），返回实际取走数量 */
export function takeCarried(state: GameState, item: ItemId, n: number): number {
  let left = n;
  for (const s of [state.player.hold, state.player.pack]) {
    const k = Math.min(left, stockGet(s, item));
    if (k > 0) {
      stockAdd(s, item, -k);
      left -= k;
    }
  }
  return n - left;
}

/**
 * 给玩家物品：先放偏好的位置（默认随身背包，玩家马上看得到），满了放另一处，再满了放到所在岛上，返回丢失的数量。
 * 2D 版里自己捞到、捕到、捡到的东西都先进背包；只有运货（交付奖励之类）才会直接点名放货舱。
 */
export function giveToPlayer(state: GameState, item: ItemId, n: number, prefer: 'pack' | 'hold' = 'pack'): number {
  const def = ITEMS[item];
  let left = n;
  const order: ('pack' | 'hold')[] = prefer === 'hold' ? ['hold', 'pack'] : ['pack', 'hold'];
  if (def.key) {
    stockAdd(state.player.pack, item, n);
    return 0;
  }
  // 装不下的只会放进你网络里的岛的仓库，绝不会塞进别人的岛
  const own = findIsland(state, state.player.at);
  const overflowTo = own && own.owned ? own : undefined;
  if (!def.portable) {
    if (overflowTo) return n - addToStock(state, overflowTo, item, n);
    return n;
  }
  for (const w of order) {
    const free = w === 'pack' ? packRoom(state, item) : holdRoom(state, item);
    const k = Math.min(left, free);
    if (k > 0) {
      stockAdd(w === 'pack' ? state.player.pack : state.player.hold, item, k);
      left -= k;
    }
  }
  if (left > 0 && overflowTo) left -= addToStock(state, overflowTo, item, left);
  return left;
}

export function whereStock(state: GameState, w: Where): Stock | null {
  if (w === 'pack') return state.player.pack;
  if (w === 'hold') return state.player.hasRaft ? state.player.hold : null;
  const isl = findIsland(state, state.player.at);
  return isl ? isl.stock : null;
}

// ---------------- 需求（救援、招募、村落请求） ----------------

/** 任意食物：从最便宜的开始用 */
export const FOOD_SPEND_ORDER: ItemId[] = ['fish', 'honeycomb', 'grilledFish', 'bread', 'sandwich', 'feast'];

export function needMsg(n: Need): Msg {
  if (n.kind === 'food') return m('need.food');
  if (n.kind === 'drink') return itemM('bottledWater');
  return itemM(n.item);
}

export function needItems(n: Need): ItemId[] {
  if (n.kind === 'food') return FOOD_SPEND_ORDER;
  if (n.kind === 'drink') return ['bottledWater'];
  return [n.item];
}

/** 玩家身上能交付给这项需求的数量 */
export function carriedForNeed(state: GameState, n: Need): number {
  return needItems(n).reduce((s, it) => s + carried(state, it), 0);
}

/** 交付需求，progress 为各项已交数量（原地修改），返回本次交付的物品 */
export function deliverNeeds(state: GameState, needs: Need[], progress: number[]): Stock {
  const given: Stock = {};
  needs.forEach((n, idx) => {
    let left = n.n - (progress[idx] ?? 0);
    for (const it of needItems(n)) {
      if (left <= 0) break;
      const k = takeCarried(state, it, left);
      if (k > 0) {
        stockAdd(given, it, k);
        left -= k;
        progress[idx] = (progress[idx] ?? 0) + k;
      }
    }
  });
  return given;
}

export function needsDone(needs: Need[], progress: number[]): boolean {
  return needs.every((n, i) => (progress[i] ?? 0) >= n.n);
}

// ---------------- 成本（建设、培训）：岛上库存 + 货舱 + 背包 ----------------

export function costAvailable(state: GameState, isl: Island | undefined, item: ItemId): number {
  return (isl ? stockGet(isl.stock, item) : 0) + carried(state, item);
}

export function canPay(state: GameState, isl: Island | undefined, cost: Stock): boolean {
  return Object.entries(cost).every(([k, v]) => costAvailable(state, isl, k as ItemId) >= (v ?? 0));
}

export function missingCost(state: GameState, isl: Island | undefined, cost: Stock): Stock {
  const m: Stock = {};
  for (const [k, v] of Object.entries(cost)) {
    const have = costAvailable(state, isl, k as ItemId);
    if (have < (v ?? 0)) m[k as ItemId] = (v ?? 0) - have;
  }
  return m;
}

export function pay(state: GameState, isl: Island | undefined, cost: Stock): void {
  for (const [k, v] of Object.entries(cost)) {
    const item = k as ItemId;
    let left = v ?? 0;
    if (isl) {
      const s = Math.min(left, stockGet(isl.stock, item));
      stockAdd(isl.stock, item, -s);
      left -= s;
    }
    takeCarried(state, item, left);
  }
}
