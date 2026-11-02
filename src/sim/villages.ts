import { RECIPES } from '../config/recipes';
import { VILLAGES, WATER_DISPUTE, WEAPONS, type Reward, type VillageId, type VillageRequest } from '../config/world';
import { spawnNative } from './create';
import { deliverNeeds, giveToPlayer, needsDone } from './inventory';
import { fail, say } from './log';
import { islandM, itemM, m, recipeM, roleM, stockP, type Msg } from './msg';
import { rolePresent } from './people';
import type { GameState, Island, Result } from './types';
import { findIsland, island } from './util';

const ISLAND_OF: Record<VillageId, string> = { tide: 'village1', wheat: 'village2', dock: 'village3', labor: 'laborVillage' };

export function villageOf(isl: Island): VillageId | null {
  for (const [v, id] of Object.entries(ISLAND_OF)) if (id === isl.id) return v as VillageId;
  return null;
}

export function villageIsland(state: GameState, vid: VillageId): Island {
  return island(state, ISLAND_OF[vid]);
}

export function currentRequest(state: GameState, vid: VillageId): VillageRequest | null {
  const def = VILLAGES[vid];
  const v = state.villages[vid];
  if (v.favor < def.requests.length) return def.requests[v.favor];
  return def.repeat ?? null;
}

/** 当前请求完成时的文字键 */
export function requestTextKey(state: GameState, vid: VillageId): string {
  const def = VILLAGES[vid];
  const v = state.villages[vid];
  return v.favor < def.requests.length ? `village.${vid}.req${v.favor}` : `village.${vid}.repeat`;
}

export function rewardMsgs(r: Reward): Msg[] {
  const out: Msg[] = [];
  if (r.recipe) {
    const role = RECIPES[r.recipe].role;
    out.push(m('reward.recipe', { recipe: recipeM(r.recipe), role: roleM(role ?? 'pilot') }));
  }
  if (r.weapon) out.push(m('reward.weapon', { weapon: m('weapon.' + r.weapon) }));
  if (r.part) out.push(m('reward.part', { part: itemM(r.part) }));
  if (r.natives) out.push(m('reward.natives', { n: r.natives }));
  return out;
}

function applyReward(state: GameState, vid: VillageId, r: Reward): void {
  const v = state.villages[vid];
  const isl = villageIsland(state, vid);
  if (r.recipe && !v.pendingRecipes.includes(r.recipe)) {
    v.pendingRecipes.push(r.recipe);
    const role = RECIPES[r.recipe].role ?? 'pilot';
    say(state, 'log.comeLearn', { role: roleM(role), isl: islandM(isl.id), recipe: recipeM(r.recipe) }, 'hint');
  }
  if (r.weapon && !state.player.weapons.includes(r.weapon)) {
    state.player.weapons.push(r.weapon);
    say(state, 'log.gotWeapon', { weapon: m('weapon.' + r.weapon), force: WEAPONS[r.weapon].force });
  }
  if (r.part) {
    giveToPlayer(state, r.part, 1, 'pack');
    say(state, 'log.gotPart', { part: itemM(r.part) });
  }
  for (let i = 0; i < (r.natives ?? 0); i++) {
    const n = spawnNative(state, isl.id);
    say(state, 'log.nativeWaits', { name: n.name, isl: islandM(isl.id) }, 'got');
  }
}

export function deliverVillage(state: GameState, vid: VillageId): Result {
  const def = VILLAGES[vid];
  const v = state.villages[vid];
  if (def.trustRole && !rolePresent(state, def.trustRole)) {
    return fail('err.trustRole', { village: m('village.' + vid), role: roleM(def.trustRole) });
  }
  const req = currentRequest(state, vid);
  if (!req) return fail('err.villageDone', { village: m('village.' + vid) });
  const textKey = requestTextKey(state, vid);
  const given = deliverNeeds(state, req.need, v.progress);
  if (!Object.keys(given).length) return fail('err.nothingToGive');
  say(state, 'log.delivered', { to: m('village.' + vid), given: stockP(given) });
  if (needsDone(req.need, v.progress)) {
    if (v.favor < def.requests.length) v.favor++;
    else v.repeatCount++;
    say(state, 'log.favorUp', { village: m('village.' + vid) }, 'got');
    say(state, textKey);
    applyReward(state, vid, req.reward);
    const next = currentRequest(state, vid);
    v.progress = next ? next.need.map(() => 0) : [];
  }
  checkWaterDispute(state);
  return { ok: true };
}

export function checkWaterDispute(state: GameState): void {
  if (state.flags.waterDispute) return;
  const labor = findIsland(state, 'laborVillage');
  if (!labor?.discovered) return;
  if (state.villages.wheat.favor < WATER_DISPUTE.minWheatFavor) return;
  state.flags.waterDispute = 'pending';
  say(state, 'log.disputeStart', 'hint');
}

export function resolveWaterDispute(state: GameState, option: 'wheat' | 'labor'): Result {
  if (state.flags.waterDispute !== 'pending') return fail('err.noDispute');
  const at = state.player.at;
  if (at !== 'village2' && at !== 'laborVillage') return fail('err.disputeWhere');
  const opt = WATER_DISPUTE.options.find((o) => o.id === option)!;
  state.flags.waterDispute = 'done';
  say(state, 'dispute.' + option + '.text');
  applyReward(state, option, opt.reward);
  return { ok: true };
}
