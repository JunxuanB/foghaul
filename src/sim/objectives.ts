import { BALANCE } from '../config/balance';
import { PART_IDS } from '../config/items';
import { RECIPES } from '../config/recipes';

const RAFT_WOOD = RECIPES.raft.inputs.wood ?? 0;
import type { Role } from '../config/recipes';
import { ISLANDS, OBJECTIVE_ISLAND, VILLAGES, type VillageId } from '../config/world';
import type { ObjKind } from '../config/buildings';
import { partsCollected } from './endgame';
import { carried, needMsg } from './inventory';
import { needsLighthouse } from './reveal';
import { buildCost } from './actions';
import { islandM, itemM, m, stockP, type Msg } from './msg';
import { roleOf } from './people';
import type { GameState } from './types';
import { findIsland } from './util';

export interface Objective {
  id: string;
  title: Msg;
  detail: Msg;
  done: boolean;
  /** 这一步要去的岛（有救援 / 招募需求时，HUD 画成需求格） */
  isl?: string;
}

function rescued(state: GameState, role: Role): boolean {
  return !!roleOf(state, role)?.active;
}

function knows(state: GameState, role: Role, recipe: string): boolean {
  return !!roleOf(state, role)?.recipes.includes(recipe as never);
}

/** 找到了就显示需求进度，没找到就显示 NPC 给的方向提示 */
function hintOr(state: GameState, id: string, fallback: string): Msg {
  const isl = findIsland(state, id);
  if (isl?.discovered) {
    const t = ISLANDS.find((x) => x.id === id);
    const need = t?.rescueNeed ?? t?.recruitNeed;
    if (need && !isl.owned) {
      return m('obj.foundNeed', {
        isl: islandM(id),
        list: { list: need.map((n, i) => m('progress', { what: needMsg(n), have: isl.needProgress[i] ?? 0, n: n.n })) },
      });
    }
    return m('obj.found', { isl: islandM(id) });
  }
  const lh = needsLighthouse(state, id);
  if (lh) return m('obj.needLighthouse', { isl: islandM(lh), cost: stockP(buildCost(state, 'lighthouse') ?? {}) });
  return state.hints[id] ?? m(fallback);
}

export function objectives(state: GameState): Objective[] {
  const pilot = roleOf(state, 'pilot');
  const home = findIsland(state, 'home')!;
  const parts = partsCollected(state);
  const o = (id: string, detail: Msg, done: boolean, p?: Record<string, never> | Parameters<typeof m>[1]): Objective => ({
    id,
    title: m('obj.' + id, p),
    detail,
    done,
  });
  return [
    o(
      'raft',
      m('obj.raft.d', { have: Math.min(RAFT_WOOD, carried(state, 'wood') + (home.stock.wood ?? 0)), n: RAFT_WOOD }),
      state.player.hasRaft,
    ),
    o('engineer', hintOr(state, 'stoneIsle', 'obj.lookAround'), rescued(state, 'engineer')),
    o('lumberjack', hintOr(state, 'forestIsle', 'obj.askEngineer'), rescued(state, 'lumberjack')),
    o(
      'firstTraining',
      findIsland(state, 'nativeA')?.owned ? m('obj.firstTraining.d') : hintOr(state, 'nativeA', 'obj.askLumberjack'),
      state.flags.firstTraining,
    ),
    o('fisher', hintOr(state, 'fisherIsle', 'obj.fisher.f'), rescued(state, 'fisher')),
    o(
      'grilledFish',
      findIsland(state, 'village1')?.discovered ? m('obj.grilledFish.d') : hintOr(state, 'village1', 'obj.grilledFish.f'),
      knows(state, 'fisher', 'grilledFish'),
    ),
    o('farmer', hintOr(state, 'farmIsle', 'obj.farmer.f'), rescued(state, 'farmer')),
    o(
      'bread',
      findIsland(state, 'village2')?.discovered ? m('obj.bread.d') : hintOr(state, 'village2', 'obj.bread.f'),
      knows(state, 'farmer', 'bread'),
    ),
    o('doctor', hintOr(state, 'herbIsle', 'obj.doctor.f'), rescued(state, 'doctor')),
    o(
      'pilot',
      pilot?.active ? m('obj.pilot.d') : hintOr(state, 'pilotIsle', 'obj.pilot.f'),
      !!pilot?.active && pilot.loc.kind === 'island' && pilot.loc.id === 'home',
    ),
    o('route', routeDetail(state), state.transport.routes.length > 0),
    o(
      'parts',
      m('obj.parts.d', {
        list: { list: PART_IDS.map((p) => (parts.includes(p) ? m('obj.partHave', { part: itemM(p) }) : itemM(p))) },
      }),
      parts.length >= PART_IDS.length,
      { have: parts.length, n: PART_IDS.length },
    ),
    o('repair', m('obj.repair.d', { cost: stockP(BALANCE.endgame.repairCost) }), state.flags.planeRepaired),
    o('report', m('obj.report.d'), state.flags.reported),
    o(
      'endless',
      state.bureau.order
        ? m('progress', { what: itemM(state.bureau.order.item), have: state.bureau.order.progress, n: state.bureau.order.n })
        : m('obj.endless.wait'),
      false,
    ),
  ].map((x) => (OBJECTIVE_ISLAND[x.id] ? { ...x, isl: OBJECTIVE_ISLAND[x.id] } : x));
}

function routeDetail(state: GameState): Msg {
  const eng = roleOf(state, 'engineer');
  if (!eng?.recipes.includes('transportRaft')) {
    return findIsland(state, 'village3')?.discovered ? m('obj.route.learn') : hintOr(state, 'village3', 'obj.route.find');
  }
  if (state.transport.rafts < 1) return m('obj.route.build');
  if (!state.people.some((p) => p.active && p.job?.kind === 'crew')) return m('obj.route.crew');
  return m('obj.route.open');
}

export function currentObjective(state: GameState): Objective {
  const l = objectives(state);
  return l.find((x) => !x.done) ?? l[l.length - 1];
}

/** 当前目标要去哪：哪座岛、岛上的哪种东西（HUD 和场景里的引导箭头用；第一天脚本结束以后才用它） */
export interface ObjectiveTarget {
  at: string;
  obj: ObjKind;
}

const PART_VILLAGES: { vid: VillageId; isl: string }[] = [
  { vid: 'tide', isl: 'village1' },
  { vid: 'dock', isl: 'village3' },
  { vid: 'labor', isl: 'laborVillage' },
  { vid: 'wheat', isl: 'village2' },
];

/** 目标岛还没出现：先去修锚点岛的灯塔 */
function reach(state: GameState, id: string, obj: ObjKind): ObjectiveTarget | null {
  const isl = findIsland(state, id);
  if (isl?.revealed) return { at: id, obj };
  const lh = needsLighthouse(state, id);
  return lh ? { at: lh, obj: 'lighthouse' } : null;
}

function learnAt(state: GameState, id: string, recipe: string): ObjectiveTarget | null {
  const v = findIsland(state, id);
  if (!v?.revealed) return reach(state, id, 'board');
  const vid = PART_VILLAGES.find((x) => x.isl === id)?.vid;
  const pending = vid ? state.villages[vid].pendingRecipes.includes(recipe as never) : false;
  return { at: id, obj: pending ? 'school' : 'board' };
}

export function objectiveTarget(state: GameState): ObjectiveTarget | null {
  const o = currentObjective(state);
  const npcAt = (id: string) => reach(state, id, 'npc');
  switch (o.id) {
    case 'engineer':
    case 'lumberjack':
    case 'fisher':
    case 'farmer':
    case 'doctor':
      return npcAt(OBJECTIVE_ISLAND[o.id]);
    case 'firstTraining':
      return findIsland(state, 'nativeA')?.owned ? { at: 'nativeA', obj: 'facility' } : npcAt('nativeA');
    case 'pilot': {
      const p = roleOf(state, 'pilot');
      if (!p?.active) return npcAt('pilotIsle');
      if (p.loc.kind === 'raft') return { at: 'home', obj: 'raft' };
      return p.loc.kind === 'island' ? { at: p.loc.id, obj: 'npc' } : null;
    }
    case 'grilledFish':
      return learnAt(state, 'village1', 'grilledFish');
    case 'bread':
      return learnAt(state, 'village2', 'bread');
    case 'route': {
      const eng = roleOf(state, 'engineer');
      if (!eng?.recipes.includes('transportRaft')) return learnAt(state, 'village3', 'transportRaft');
      if (state.transport.rafts < 1) return { at: 'home', obj: 'shipyard' };
      if (!state.people.some((p) => p.active && p.job?.kind === 'crew')) {
        const recruit = state.people.find((p) => p.type === 'native' && p.active && !p.job && p.loc.kind === 'island' && !findIsland(state, p.loc.id)?.owned);
        if (recruit && recruit.loc.kind === 'island') return { at: recruit.loc.id, obj: 'npc' };
        const aboard = state.people.some((p) => p.type === 'native' && p.loc.kind === 'raft');
        return aboard ? { at: 'home', obj: 'shipyard' } : reach(state, 'laborVillage', 'board');
      }
      return { at: 'home', obj: 'shipyard' };
    }
    case 'parts': {
      if (state.flags.waterDispute === 'pending') return { at: 'village2', obj: 'board' };
      for (const { vid, isl } of PART_VILLAGES) {
        const def = VILLAGES[vid];
        const left = def.requests.slice(state.villages[vid].favor).some((r) => r.reward.part);
        if (left) return reach(state, isl, 'board');
      }
      return { at: 'home', obj: 'wreck' };
    }
    case 'repair':
      return { at: 'home', obj: 'wreck' };
    case 'report':
    case 'endless':
      return { at: 'bureau', obj: 'office' };
    default:
      return null;
  }
}
