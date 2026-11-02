import { BALANCE } from '../config/balance';
import { ITEMS, PART_IDS, type ItemId } from '../config/items';
import { say } from './log';
import { itemM } from './msg';
import { rand } from './rng';
import type { GameState, Order } from './types';
import { stockAdd } from './util';

const G = BALANCE.endgame;

export function partsCollected(state: GameState): ItemId[] {
  return PART_IDS.filter((p) => state.flags.partsInstalled.includes(p) || (state.player.pack[p] ?? 0) > 0);
}

/** 把货物交给进出口局，换成贸易额，并计入当前订单 */
export function exportGoods(state: GameState, item: ItemId, n: number): number {
  if (n <= 0) return 0;
  const b = state.bureau;
  stockAdd(b.exported, item, n);
  let value = ITEMS[item].trade * n;
  const o = b.order;
  if (o && o.item === item && o.progress < o.n && state.time <= o.deadline) {
    o.progress = Math.min(o.n, o.progress + n);
    if (o.progress >= o.n) {
      value += o.reward;
      b.ordersDone++;
      say(state, 'log.orderDone', { item: itemM(o.item), n: o.n, reward: o.reward }, 'got');
      b.order = null;
      b.nextOrderAt = Math.min(b.nextOrderAt, state.time + 6 * 60);
    }
  }
  b.trade += value;
  b.totalTrade += value;
  return value;
}

const ORDER_POOL: { item: ItemId; n: [number, number] }[] = [
  { item: 'wood', n: [40, 80] },
  { item: 'fish', n: [30, 60] },
  { item: 'bottledWater', n: [20, 50] },
  { item: 'cup', n: [30, 60] },
  { item: 'grilledFish', n: [20, 40] },
  { item: 'bread', n: [20, 40] },
  { item: 'salt', n: [15, 30] },
  { item: 'medkit', n: [8, 16] },
  { item: 'sandwich', n: [10, 24] },
  { item: 'feast', n: [3, 8] },
  { item: 'wheat', n: [40, 80] },
  { item: 'herb', n: [20, 40] },
];

export function newOrder(state: GameState): Order {
  const pick = ORDER_POOL[Math.floor(rand(state) * ORDER_POOL.length)];
  const scale = 1 + state.bureau.ordersDone * 0.15;
  const n = Math.round((pick.n[0] + rand(state) * (pick.n[1] - pick.n[0])) * scale);
  return {
    item: pick.item,
    n,
    progress: 0,
    deadline: state.time + G.orderDurationDays * 1440,
    reward: Math.round(ITEMS[pick.item].trade * n * G.orderRewardMultiplier),
  };
}

/** 每小时检查订单 */
export function bureauHourly(state: GameState): void {
  if (!state.flags.reported) return;
  const b = state.bureau;
  if (b.order && state.time > b.order.deadline) {
    say(state, 'log.orderExpired', { item: itemM(b.order.item), progress: b.order.progress, n: b.order.n });
    b.order = null;
  }
  if (!b.order && state.time >= b.nextOrderAt) {
    b.order = newOrder(state);
    b.nextOrderAt = state.time + G.orderEveryDays * 1440;
    say(state, 'log.orderNew', { item: itemM(b.order.item), n: b.order.n, days: G.orderDurationDays }, 'got');
  }
}

export function upgradeCost(state: GameState, kind: 'speed' | 'storage' | 'output'): number | null {
  const lv = state.bureau.upgrades[kind];
  const costs = G.upgrades[kind].costs;
  return lv < costs.length ? costs[lv] : null;
}
