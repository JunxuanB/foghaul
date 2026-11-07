import { BALANCE } from '../config/balance';
import { ITEMS, ITEM_ORDER, type ItemId } from '../config/items';
import type { Need } from '../config/world';
import { itemM, m, type Msg } from './msg';
import type { GameState, Island, Stock, Where } from './types';
import { findIsland, stockAdd, stockGet } from './util';

/** 岛屿每种物品的仓库上限 */
export function stockCap(state: GameState, isl: Island, item: ItemId): number {
  if (isl.kind === 'bureau') return 9999;
  if (isl.kind === 'home') return Math.round(BALANCE.home.stockCap * storageMult(state));
  if (isl.kind === 'recipeVillage' || isl.kind === 'laborVillage') return 0;
  const lv = BALANCE.economy.levels[isl.level - 1];
  let cap = lv.cap;
  const def = ITEMS[item];
  if (isl.buildings.depot && (def.foodTier !== undefined || def.drink)) cap += BALANCE.buildings.depot.capBonus;
  return Math.round(cap * storageMult(state));
}

export function storageMult(state: GameState): number {
  return 1 + state.bureau.upgrades.storage * BALANCE.endgame.upgrades.storage.per;
}

export function stockRoom(state: GameState, isl: Island, item: ItemId): number {
  return Math.max(0, stockCap(state, isl, item) - stockGet(isl.stock, item));
}

/** 往岛上库存加货，返回实际加入的数量 */
export function addToStock(state: GameState, isl: Island, item: ItemId, n: number): number {
  const k = Math.min(n, stockRoom(state, isl, item));
  if (k > 0) stockAdd(isl.stock, item, k);
  return k;
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

/** 给玩家物品：先放偏好的位置，满了放另一处，再满了放到所在岛上，返回丢失的数量 */
export function giveToPlayer(state: GameState, item: ItemId, n: number, prefer: 'pack' | 'hold' = 'hold'): number {
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
