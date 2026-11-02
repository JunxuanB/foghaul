import { BALANCE } from '../config/balance';
import { PART_IDS } from '../config/items';
import type { Role } from '../config/recipes';
import { ISLANDS } from '../config/world';
import { partsCollected } from './endgame';
import { needMsg } from './inventory';
import { islandM, itemM, m, stockP, type Msg } from './msg';
import { roleOf } from './people';
import type { GameState } from './types';
import { findIsland } from './util';

export interface Objective {
  id: string;
  title: Msg;
  detail: Msg;
  done: boolean;
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
  return state.hints[id] ?? m(fallback);
}

export function objectives(state: GameState): Objective[] {
  const pilot = roleOf(state, 'pilot');
  const parts = partsCollected(state);
  const o = (id: string, detail: Msg, done: boolean, p?: Record<string, never> | Parameters<typeof m>[1]): Objective => ({
    id,
    title: m('obj.' + id, p),
    detail,
    done,
  });
  return [
    o('raft', m('obj.raft.d', { n: BALANCE.home.raft.wood }), state.player.hasRaft),
    o('engineer', hintOr(state, 'stoneIsle', 'obj.lookAround'), rescued(state, 'engineer')),
    o('lumberjack', hintOr(state, 'forestIsle', 'obj.askEngineer'), rescued(state, 'lumberjack')),
    o(
      'firstTraining',
      findIsland(state, 'nativeA')?.owned ? m('obj.firstTraining.d') : hintOr(state, 'nativeA', 'obj.askLumberjack'),
      state.flags.firstTraining,
    ),
    o('fisher', hintOr(state, 'fisherIsle', 'obj.fisher.f'), rescued(state, 'fisher')),
    o(
      'lighthouse1',
      m('obj.lighthouse1.d', { cost: stockP(BALANCE.buildings.lighthouse.cost) }),
      !!findIsland(state, 'fisherIsle')?.buildings.lighthouse,
    ),
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
  ];
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
