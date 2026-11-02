import { BIOME_ITEM, RECIPES, ROLE_BIOME, type Role } from '../config/recipes';
import { m, itemM, recipeM, type Msg } from './msg';
import type { Facility, GameState, Island, Job, Person } from './types';
import { findIsland } from './util';

export function residentsOf(state: GameState, isl: Island): Person[] {
  return state.people.filter((p) => p.active && p.loc.kind === 'island' && p.loc.id === isl.id);
}

/** 岛上的全部人（包括还没获救或招募的） */
export function everyoneOn(state: GameState, isl: Island): Person[] {
  return state.people.filter((p) => p.loc.kind === 'island' && p.loc.id === isl.id);
}

export function personIsland(state: GameState, p: Person): Island | undefined {
  return p.loc.kind === 'island' ? findIsland(state, p.loc.id) : undefined;
}

/** 断供：所在岛上一顿完全没吃上 */
export function isHungry(state: GameState, p: Person): boolean {
  const isl = personIsland(state, p);
  return !!isl && isl.lastMeal === 'none';
}

export function roleOf(state: GameState, role: Role): Person | undefined {
  return state.people.find((p) => p.role === role);
}

export function sameJob(a: Job | null, b: Job | null): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'produce' && b.kind === 'produce') return a.item === b.item;
  if (a.kind === 'process' && b.kind === 'process') return a.recipe === b.recipe;
  return a.kind === 'crew';
}

export function canDo(p: Person, fac: Facility): boolean {
  if (p.type === 'native') return sameJob(p.job, fac);
  if (!p.role) return false;
  if (fac.kind === 'produce') {
    const b = ROLE_BIOME[p.role];
    return !!b && BIOME_ITEM[b] === fac.item;
  }
  return p.recipes.includes(fac.recipe);
}

/** 该设施对应的乘客工种（决定经验加成） */
export function facilityRole(fac: Facility): Role | null {
  if (fac.kind === 'process') return RECIPES[fac.recipe].role;
  for (const [role, b] of Object.entries(ROLE_BIOME)) if (b && BIOME_ITEM[b] === fac.item) return role as Role;
  return null;
}

export function jobMsg(job: Job | null): Msg {
  if (!job) return m('job.none');
  if (job.kind === 'crew') return m('job.crew');
  if (job.kind === 'produce') return m('job.produce', { item: itemM(job.item) });
  return m('job.process', { recipe: recipeM(job.recipe) });
}

export function facilityMsg(fac: Facility | null): Msg {
  if (!fac) return m('facility.none');
  if (fac.kind === 'produce') return m('facility.' + fac.item);
  return m('facility.process', { recipe: recipeM(fac.recipe) });
}

export function workersAt(state: GameState, isl: Island): Person[] {
  if (!isl.facility) return [];
  const fac = isl.facility;
  return residentsOf(state, isl).filter((p) => !p.learning && canDo(p, fac));
}

/** 玩家靠岸时，在场的人：岛上的 + 船上的 */
export function presentPeople(state: GameState): Person[] {
  const at = state.player.at;
  if (!at) return [];
  return state.people.filter(
    (p) => p.active && ((p.loc.kind === 'island' && p.loc.id === at) || p.loc.kind === 'raft'),
  );
}

export function rolePresent(state: GameState, role: Role): Person | undefined {
  return presentPeople(state).find((p) => p.role === role);
}

/** 乘客能教的工作 */
export function teachableJobs(trainer: Person, isl: Island): Job[] {
  const jobs: Job[] = [];
  if (!trainer.role) return jobs;
  if (trainer.role === 'pilot') return [{ kind: 'crew' }];
  const b = ROLE_BIOME[trainer.role];
  if (b && isl.biome === b) jobs.push({ kind: 'produce', item: BIOME_ITEM[b] });
  for (const r of trainer.recipes) {
    const def = RECIPES[r];
    if (def.noFacility || def.manualOnly) continue;
    jobs.push({ kind: 'process', recipe: r });
  }
  return jobs;
}

export function headcountOf(state: GameState, isl: Island): number {
  return everyoneOn(state, isl).filter((p) => p.active).length;
}

export function personLabel(p: Person): Msg {
  return p.type === 'passenger' ? p.name : m('native.label', { name: p.name });
}
