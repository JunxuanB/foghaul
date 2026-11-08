import { BALANCE } from '../config/balance';
import { ITEMS, type ItemId } from '../config/items';
import { spareStock } from './economy';
import { exportGoods } from './endgame';
import { addToStock, stockRoom } from './inventory';
import { gainPersonXp, pilotLevel } from './progression';
import { roleOf } from './people';
import type { GameState, Island, Route } from './types';
import { islandM, itemM, m, type Msg } from './msg';
import { island, manhattan, stockAdd, stockGet } from './util';

const T = BALANCE.transport;
const P = BALANCE.progression;

export function reserveUnlocked(state: GameState): boolean {
  return pilotLevel(state) >= P.unlockReserveLevel;
}
export function targetUnlocked(state: GameState): boolean {
  return pilotLevel(state) >= P.unlockTargetLevel;
}
export function priorityUnlocked(state: GameState): boolean {
  return pilotLevel(state) >= P.unlockPriorityLevel;
}

export function routeSpeed(state: GameState, r: Route): number {
  const lv = Math.max(1, pilotLevel(state));
  let tilesPerMin = 1 / T.minutesPerTile;
  tilesPerMin *= 1 + (lv - 1) * P.pilotSpeedPerLevel;
  tilesPerMin *= 1 + state.bureau.upgrades.speed * BALANCE.endgame.upgrades.speed.per;
  if (r.supplies.water <= 0 || r.supplies.food <= 0) tilesPerMin *= T.noSupplySpeed;
  return tilesPerMin;
}

export function freeRafts(state: GameState): number {
  return state.transport.rafts - state.transport.routes.length;
}

export function idleCrew(state: GameState) {
  return state.people.filter((p) => p.active && p.job?.kind === 'crew' && p.loc.kind === 'island');
}

/** 可以作为路线端点的岛：网络内的岛和进出口局 */
export function routeEndpoints(state: GameState): Island[] {
  return state.islands.filter(
    (i) => i.discovered && (i.owned || (i.kind === 'bureau' && state.flags.flightDone)),
  );
}

export function portableCargo(): ItemId[] {
  return (Object.keys(ITEMS) as ItemId[]).filter((k) => ITEMS[k].portable && !ITEMS[k].key);
}

const PRIORITY_RANK: Record<Route['priority'], number> = { high: 0, mid: 1, low: 2 };

function pickupItem(r: Route, at: string): ItemId | null {
  if (at === r.a) return r.cargoAB;
  if (at === r.b) return r.cargoBA;
  return null;
}

/** 更高优先级、正驶向这座岛且要取同一种货的路线所预留的量 */
function claims(state: GameState, r: Route, at: string, item: ItemId): number {
  if (!priorityUnlocked(state)) return 0;
  let n = 0;
  for (const o of state.transport.routes) {
    if (o === r) continue;
    if (PRIORITY_RANK[o.priority] >= PRIORITY_RANK[r.priority]) continue;
    if (o.to !== at || o.phase !== 'sail') continue;
    if (pickupItem(o, at) !== item) continue;
    n += T.capacity - (o.load?.n ?? 0);
  }
  return n;
}

function unload(state: GameState, r: Route, at: Island): void {
  if (!r.load) return;
  const { item } = r.load;
  let n = r.load.n;
  let k = 0;
  if (at.kind === 'bureau') {
    exportGoods(state, item, n);
    k = n;
  } else {
    let room = stockRoom(state, at, item);
    const tgt = at.target[item];
    if (targetUnlocked(state) && tgt !== undefined) room = Math.min(room, Math.max(0, tgt - stockGet(at.stock, item)));
    k = addToStock(state, at, item, Math.min(n, room));
  }
  n -= k;
  r.load = n > 0 ? { item, n } : null;
  if (k > 0) {
    r.delivered += k;
    state.stats.transported += k;
    const pilot = roleOf(state, 'pilot');
    if (pilot && pilot.active) gainPersonXp(state, pilot, k);
  }
}

function resupply(state: GameState, r: Route, at: Island): void {
  if (at.kind === 'bureau') {
    r.supplies.water = T.crewSupplyMax;
    r.supplies.food = T.crewSupplyMax;
    return;
  }
  while (r.supplies.water < T.crewSupplyMax) {
    const w = spareStock(state, at, 'water') > 0 ? 'water' : spareStock(state, at, 'bottledWater') > 0 ? 'bottledWater' : null;
    if (!w) break;
    stockAdd(at.stock, w, -1);
    r.supplies.water++;
  }
  const foods: ItemId[] = ['fish', 'honeycomb', 'grilledFish', 'bread', 'sandwich'];
  while (r.supplies.food < T.crewSupplyMax) {
    const f = foods.find((x) => spareStock(state, at, x) > 0);
    if (!f) break;
    stockAdd(at.stock, f, -1);
    r.supplies.food++;
  }
}

function load(state: GameState, r: Route, at: Island, dest: Island): void {
  const item = pickupItem(r, at.id);
  if (!item || at.kind === 'bureau') return;
  if (r.load && r.load.item !== item) return;
  const have = r.load?.n ?? 0;
  const reserve = reserveUnlocked(state) ? at.reserve[item] ?? 0 : 0;
  // 运输队哪里有从哪拿：先拿设施暂存箱里的，再拿储物箱里的（储物箱要给岛民留口粮）
  const fromBox = stockGet(at.output, item);
  let n = Math.min(T.capacity - have, fromBox + spareStock(state, at, item, reserve + claims(state, r, at.id, item)));
  const tgt = dest.target[item];
  if (targetUnlocked(state) && tgt !== undefined && dest.kind !== 'bureau') {
    n = Math.min(n, Math.max(0, tgt - stockGet(dest.stock, item) - have));
  }
  if (n <= 0) return;
  const a = Math.min(n, fromBox);
  stockAdd(at.output, item, -a);
  stockAdd(at.stock, item, -(n - a));
  r.load = { item, n: have + n };
}

function depart(state: GameState, r: Route): void {
  const at = island(state, r.to);
  const nextId = r.to === r.a ? r.b : r.a;
  const dest = island(state, nextId);
  load(state, r, at, dest);
  r.from = at.id;
  r.to = nextId;
  r.startX = at.x;
  r.startY = at.y;
  r.phase = 'sail';
  r.progress = 0;
  r.length = manhattan(at.x, at.y, dest.x, dest.y);
}

function arrive(state: GameState, r: Route): void {
  const at = island(state, r.to);
  unload(state, r, at);
  resupply(state, r, at);
  r.phase = 'dock';
  r.progress = 0;
}

export function tickTransport(state: GameState, minutes: number): void {
  for (const r of state.transport.routes) {
    let dt = minutes;
    let guard = 0;
    while (dt > 1e-9 && guard++ < 20) {
      if (r.phase === 'sail') {
        const spd = routeSpeed(state, r);
        const need = (r.length - r.progress) / spd;
        const used = Math.min(dt, need);
        r.progress += used * spd;
        r.mealTimer += used;
        while (r.mealTimer >= T.crewMealEveryMinutes) {
          r.mealTimer -= T.crewMealEveryMinutes;
          r.supplies.water = Math.max(0, r.supplies.water - 1);
          r.supplies.food = Math.max(0, r.supplies.food - 1);
        }
        dt -= used;
        if (r.progress >= r.length - 1e-9) arrive(state, r);
      } else {
        const need = T.dockMinutes - r.progress;
        const used = Math.min(dt, need);
        r.progress += used;
        dt -= used;
        if (r.progress >= T.dockMinutes - 1e-9) depart(state, r);
      }
    }
    r.note = routeNote(r);
  }
}

function routeNote(r: Route): Msg {
  if (r.supplies.water <= 0 || r.supplies.food <= 0) return m('route.noSupply');
  if (r.phase === 'dock') return m('route.docking', { isl: islandM(r.to) });
  return m('route.sailing', { isl: islandM(r.to), cargo: r.load ? m('qty', { item: itemM(r.load.item), n: r.load.n }) : m('cargo.empty') });
}

/** 船在地图上的位置（浮点格坐标） */
export function boatPos(state: GameState, r: Route): { x: number; y: number } {
  const to = island(state, r.to);
  if (r.phase === 'dock' || r.length <= 0) return { x: to.x, y: to.y };
  const f = Math.min(1, r.progress / r.length);
  // 先走横向再走纵向（曼哈顿路线）
  const dx = to.x - r.startX;
  const dy = to.y - r.startY;
  const total = Math.abs(dx) + Math.abs(dy);
  const d = f * total;
  if (d <= Math.abs(dx)) return { x: r.startX + Math.sign(dx) * d, y: r.startY };
  return { x: to.x, y: r.startY + Math.sign(dy) * (d - Math.abs(dx)) };
}

export function createRoute(
  state: GameState,
  a: string,
  b: string,
  cargoAB: ItemId | null,
  cargoBA: ItemId | null,
  crewId: string,
): Route {
  const crew = state.people.find((p) => p.id === crewId)!;
  const start = crew.loc.kind === 'island' ? island(state, crew.loc.id) : island(state, a);
  const A = island(state, a);
  const no = state.transport.nextNo++;
  const r: Route = {
    id: 'r' + no,
    no,
    a,
    b,
    cargoAB,
    cargoBA,
    crewId,
    priority: 'mid',
    from: start.id,
    to: a,
    phase: 'sail',
    progress: 0,
    length: manhattan(start.x, start.y, A.x, A.y),
    startX: start.x,
    startY: start.y,
    load: null,
    supplies: { water: T.crewSupplyMax, food: T.crewSupplyMax },
    mealTimer: 0,
    delivered: 0,
    note: m(''),
  };
  crew.loc = { kind: 'route', id: r.id };
  state.transport.routes.push(r);
  r.note = routeNote(r);
  return r;
}

export function deleteRoute(state: GameState, id: string): void {
  const idx = state.transport.routes.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const r = state.transport.routes[idx];
  const at = island(state, r.to);
  if (r.load && at.kind !== 'bureau') addToStock(state, at, r.load.item, r.load.n);
  const crew = state.people.find((p) => p.id === r.crewId);
  if (crew) {
    crew.loc = { kind: 'island', id: at.kind === 'bureau' ? 'home' : at.id };
    crew.lastIsland = crew.loc.id;
  }
  state.transport.routes.splice(idx, 1);
}
