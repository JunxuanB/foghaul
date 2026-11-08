// 脚本玩家：只通过正式命令推进主线。用于调试面板的里程碑预设和自动通关测试。
// 为了不依赖数值，它会“作弊”补足交付所需的物资并保命，但所有进度判定都走正式规则。
import type { ItemId } from '../config/items';
import { approach } from './interact';
import { PART_IDS } from '../config/items';
import { VILLAGES, type Need, type VillageId } from '../config/world';
import { dispatch } from './actions';
import { createGame } from './create';
import { canPay, carried, giveToPlayer, missingCost } from './inventory';
import { findPath } from './map';
import { teachableJobs } from './people';
import type { Command, GameState, Stock } from './types';
import { island, stockAdd } from './util';
import { currentRequest, villageIsland } from './villages';
import { revealOf } from './reveal';

export class BotError extends Error {}

function must(s: GameState, cmd: Command): void {
  approach(s, cmd);
  const r = dispatch(s, cmd);
  if (!r.ok) throw new BotError(`${JSON.stringify(cmd)} → ${JSON.stringify(r.msg)}`);
}

function keepAlive(s: GameState): void {
  const p = s.player;
  p.hp = Math.max(p.hp, 90);
  p.water = Math.max(p.water, 70);
  p.food = Math.max(p.food, 70);
}

/** 给玩家补足物资（放货舱，满了放背包） */
function ensure(s: GameState, need: Stock): void {
  for (const [k, v] of Object.entries(need)) {
    const id = k as ItemId;
    const lack = (v ?? 0) - carried(s, id);
    if (lack <= 0) continue;
    // 补给的是要运的货：放货舱
    const left = giveToPlayer(s, id, lack, 'hold');
    // 装不下的直接塞进背包（脚本作弊，不受容量限制）
    if (left > 0) stockAdd(s.player.pack, id, left);
  }
}

function needStock(need: Need[], progress: number[]): Stock {
  const out: Stock = {};
  need.forEach((n, i) => {
    const left = n.n - (progress[i] ?? 0);
    if (left <= 0) return;
    const id: ItemId = n.kind === 'food' ? 'fish' : n.kind === 'drink' ? 'bottledWater' : n.item;
    stockAdd(out, id, left);
  });
  return out;
}

/** 目标岛还没出现：先去锚点岛修灯塔 */
function ensureRevealed(s: GameState, id: string): void {
  if (island(s, id).revealed) return;
  const r = revealOf(id);
  if (!r) throw new BotError('no reveal for ' + id);
  const anchor = island(s, r.anchor);
  if (!anchor.buildings.lighthouse) build(s, r.anchor, 'lighthouse');
  if (!island(s, id).revealed) throw new BotError(`${id} not revealed after lighthouse at ${r.anchor}`);
}

export function sailTo(s: GameState, id: string): void {
  ensureRevealed(s, id);
  const target = island(s, id);
  if (s.player.at === id) return;
  if (s.player.at) must(s, { t: 'leave' });
  if (s.player.twoStep) must(s, { t: 'toggleTwoStep' });
  for (let guard = 0; guard < 600; guard++) {
    if (s.player.x === target.x && s.player.y === target.y) break;
    const path = findPath(s, s.player.x, s.player.y, target.x, target.y);
    if (!path) throw new BotError('no path to ' + id);
    keepAlive(s);
    s.pendingCrate = null;
    must(s, { t: 'move', dx: path[0].dx, dy: path[0].dy });
    if (s.player.at) must(s, { t: 'leave' });
  }
  must(s, { t: 'dock' });
}

function payable(s: GameState, cost: Stock): void {
  const isl = island(s, s.player.at!);
  if (!canPay(s, isl.owned ? isl : undefined, cost)) ensure(s, Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, (v ?? 0) + carried(s, k as ItemId)])) as Stock);
  void missingCost;
}

function deliverHere(s: GameState, need: Need[], progress: number[]): void {
  ensure(s, needStock(need, progress));
  must(s, { t: 'deliver' });
}

function rescueAt(s: GameState, id: string, need: Need[]): void {
  sailTo(s, id);
  deliverHere(s, need, island(s, id).needProgress);
}

function personOf(s: GameState, role: string) {
  return s.people.find((p) => p.role === role)!;
}

function fetch(s: GameState, role: string): void {
  const p = personOf(s, role);
  if (p.loc.kind === 'raft') return;
  if (p.loc.kind !== 'island') throw new BotError('cannot fetch ' + role);
  sailTo(s, p.loc.id);
  must(s, { t: 'pickUp', personId: p.id });
}

function dropAt(s: GameState, role: string, id: string): void {
  const p = personOf(s, role);
  sailTo(s, id);
  if (p.loc.kind === 'raft') must(s, { t: 'dropOff', personId: p.id });
}

function build(s: GameState, id: string, what: 'lighthouse' | 'bed' | 'depot' | 'helipad'): void {
  sailTo(s, id);
  if (island(s, id).buildings[what]) return;
  payable(s, { wood: 30, fish: 6, cup: 4, salt: 4 });
  keepAlive(s);
  must(s, { t: 'build', what });
}

function learnAt(s: GameState, vid: VillageId, role: string, recipe: string): void {
  const p = personOf(s, role);
  if (p.recipes.includes(recipe as never)) return;
  fetch(s, role);
  sailTo(s, villageIsland(s, vid).id);
  must(s, { t: 'learn', personId: p.id, recipe: recipe as never });
  for (let i = 0; i < 4 && p.learning; i++) {
    keepAlive(s);
    must(s, { t: 'wait', minutes: 60 });
  }
  if (p.learning) throw new BotError('learning did not finish');
  must(s, { t: 'pickUp', personId: p.id });
}

function villageRequest(s: GameState, vid: VillageId, trustRole?: string): void {
  const isl = villageIsland(s, vid);
  if (trustRole) fetch(s, trustRole);
  sailTo(s, isl.id);
  const req = currentRequest(s, vid);
  if (!req) return;
  deliverHere(s, req.need, s.villages[vid].progress);
}

export interface BotStep {
  id: string;
  run: (s: GameState) => void;
}

export const STEPS: BotStep[] = [
  {
    id: 'raft',
    run: (s) => {
      const home = island(s, 'home');
      for (let i = 0; i < 4; i++) must(s, { t: 'gather', what: 'branch' });
      stockAdd(home.stock, 'wood', 8);
      must(s, { t: 'craft', recipe: 'raft' });
    },
  },
  { id: 'engineer', run: (s) => rescueAt(s, 'stoneIsle', [{ kind: 'item', item: 'fish', n: 3 }]) },
  { id: 'lumberjack', run: (s) => rescueAt(s, 'forestIsle', [{ kind: 'food', n: 4 }]) },
  {
    id: 'firstTraining',
    run: (s) => {
      rescueAt(s, 'nativeA', [
        { kind: 'drink', n: 3 },
        { kind: 'food', n: 3 },
      ]);
      fetch(s, 'lumberjack');
      sailTo(s, 'nativeA');
      const native = s.people.find((p) => p.type === 'native' && p.loc.kind === 'island' && p.loc.id === 'nativeA')!;
      const lj = personOf(s, 'lumberjack');
      const job = teachableJobs(lj, island(s, 'nativeA'))[0];
      payable(s, { wood: 10, fish: 4, bottledWater: 4 });
      must(s, { t: 'train', personId: native.id, trainerId: lj.id, job });
      dropAt(s, 'lumberjack', 'forestIsle');
    },
  },
  {
    id: 'fisher',
    run: (s) =>
      rescueAt(s, 'fisherIsle', [
        { kind: 'food', n: 3 },
        { kind: 'drink', n: 3 },
      ]),
  },
  {
    id: 'grilledFish',
    run: (s) => {
      villageRequest(s, 'tide');
      learnAt(s, 'tide', 'fisher', 'grilledFish');
      dropAt(s, 'fisher', 'fisherIsle');
    },
  },
  {
    id: 'farmer',
    run: (s) =>
      rescueAt(s, 'farmIsle', [
        { kind: 'item', item: 'fish', n: 4 },
        { kind: 'item', item: 'grilledFish', n: 2 },
      ]),
  },
  {
    id: 'bread',
    run: (s) => {
      villageRequest(s, 'wheat', 'farmer');
      learnAt(s, 'wheat', 'farmer', 'bread');
      dropAt(s, 'farmer', 'farmIsle');
    },
  },
  {
    id: 'doctor',
    run: (s) =>
      rescueAt(s, 'herbIsle', [
        { kind: 'food', n: 3 },
        { kind: 'drink', n: 3 },
      ]),
  },
  {
    id: 'pilot',
    run: (s) => {
      rescueAt(s, 'pilotIsle', [{ kind: 'item', item: 'medkit', n: 1 }]);
      must(s, { t: 'pickUp', personId: personOf(s, 'pilot').id });
      dropAt(s, 'pilot', 'home');
    },
  },
  {
    id: 'route',
    run: (s) => {
      villageRequest(s, 'dock');
      learnAt(s, 'dock', 'engineer', 'transportRaft');
      // 运输木筏在主岛的船坞造（工程师要在场）
      sailTo(s, 'home');
      payable(s, { wood: 20 });
      must(s, { t: 'buildTransportRaft' });
      dropAt(s, 'engineer', 'stoneIsle');
      villageRequest(s, 'labor');
      const recruit = s.people.find((p) => p.type === 'native' && p.active && p.loc.kind === 'island' && p.loc.id === 'laborVillage')!;
      must(s, { t: 'pickUp', personId: recruit.id });
      sailTo(s, 'home');
      must(s, { t: 'dropOff', personId: recruit.id });
      payable(s, { wood: 6, fish: 4, bottledWater: 4 });
      // 主岛也要给飞行员和船员备好口粮
      ensure(s, { fish: 10, bottledWater: 10 });
      must(s, { t: 'transfer', item: 'fish', from: 'hold', to: 'stock', n: 6 });
      must(s, { t: 'transfer', item: 'bottledWater', from: 'hold', to: 'stock', n: 6 });
      must(s, { t: 'train', personId: recruit.id, trainerId: personOf(s, 'pilot').id, job: { kind: 'crew' } });
      must(s, { t: 'createRoute', a: 'home', b: 'fisherIsle', cargoAB: null, cargoBA: 'fish', crewId: recruit.id });
    },
  },
  {
    id: 'parts',
    run: (s) => {
      const order: [VillageId, string | undefined][] = [
        ['tide', undefined],
        ['dock', undefined],
        ['labor', undefined],
        ['wheat', 'farmer'],
      ];
      for (const [vid, trust] of order) {
        for (let i = 0; i < VILLAGES[vid].requests.length && s.villages[vid].favor < VILLAGES[vid].requests.length; i++) {
          villageRequest(s, vid, trust);
        }
      }
      if (s.flags.waterDispute === 'pending') {
        sailTo(s, 'village2');
        must(s, { t: 'choose', option: 'wheat' });
      }
      const farmer = personOf(s, 'farmer');
      if (farmer.loc.kind === 'raft') dropAt(s, 'farmer', 'farmIsle');
    },
  },
  {
    id: 'repair',
    run: (s) => {
      sailTo(s, 'home');
      for (const p of PART_IDS) if ((s.player.pack[p] ?? 0) > 0) must(s, { t: 'installPart', item: p });
      payable(s, { wood: 30, medkit: 2 });
      must(s, { t: 'repairPlane' });
      must(s, { t: 'endCutscene' });
    },
  },
  {
    id: 'report',
    run: (s) => {
      must(s, { t: 'report' });
      must(s, { t: 'endCutscene' });
    },
  },
];

/** 从新游戏跑到某一步（包含该步） */
export function runUntil(seed: number, stepId: string | null): GameState {
  const s = createGame(seed);
  if (!stepId) return s;
  for (const step of STEPS) {
    step.run(s);
    keepAlive(s);
    if (step.id === stepId) break;
  }
  return s;
}
