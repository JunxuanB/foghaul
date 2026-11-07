// 2D：岛上的互动对象。规则层用它校验“人物在不在这个东西旁边”，画面层用它决定按键提示。
// 每座岛都有地图（专门模板或通用模板，见 world/templates.ts）。岛上的东西分三类：
// 模板里固定的、今天的采集点（sim/forage.ts）、跟着存档变的（人、灯塔 / 地基、工作台、储物箱、请求板）。
import { BALANCE } from '../config/balance';
import { OBJ_DEFS, type ObjKind, type RelRect } from '../config/buildings';
import type { Role } from '../config/recipes';
import { ISLANDS } from '../config/world';
import { heightAt, layout, rectDist, type WorldObj } from '../world/island';
import { templateFor } from '../world/templates';
import { canSleepNow } from './clock';
import { nodesOn } from './forage';
import { needsDone } from './inventory';
import { m, type Msg } from './msg';
import { roleOf } from './people';
import type { Command, ForageNode, GameState, Person, Walk } from './types';
import { findIsland } from './util';

/** 当前所在岛的地图，并且人物在这张图上 */
export function mapHere(state: GameState): string | null {
  const at = state.player.at;
  if (!at || !templateFor(at) || state.walk.island !== at) return null;
  return at;
}

function rel(x: number, y: number, r: RelRect | undefined) {
  return r ? { x: x + r.x, y: y + r.y, w: r.w, h: r.h } : null;
}

function makeObj(id: string, sprite: string, x: number, y: number, kind?: ObjKind, defName = sprite): WorldObj {
  const def = OBJ_DEFS[defName];
  return { id, kind: kind ?? def?.kind ?? 'decor', sprite, x, y, foot: rel(x, y, def?.foot), hit: rel(x, y, def?.hit ?? def?.foot) };
}

/** 采集点变成地图上的物体：采完的树变成树桩、草药丛变成空丛（都只是装饰） */
export function nodeObject(n: ForageNode): WorldObj {
  const done = n.left <= 0;
  const sprite = done ? (n.kind === 'tree' ? 'stump' : 'herbEmpty') : n.sprite;
  return makeObj(n.id, sprite, n.x, n.y, done ? 'decor' : n.kind);
}

/** 人物用哪套精灵 */
const ROLE_CHAR: Record<Role, string> = { engineer: 'engineer', lumberjack: 'lumber', fisher: 'fisher', farmer: 'farmer', doctor: 'doctor', pilot: 'pilot' };
export function charOf(p: Person): string {
  return p.role ? ROLE_CHAR[p.role] : 'islander';
}

/** 站在某座岛上的人（不在木筏上、不在运输线上） */
export function peopleOn(state: GameState, islandId: string): Person[] {
  return state.people.filter((p) => p.loc.kind === 'island' && p.loc.id === islandId && !state.player.aboard.includes(p.id));
}

/** 跟着存档变的物体 */
function stateObjects(state: GameState, islandId: string): WorldObj[] {
  const t = templateFor(islandId);
  const S = t?.slots;
  const isl = findIsland(state, islandId);
  if (!S || !isl) return [];
  const out: WorldObj[] = [];
  if (S.lighthouse) {
    const [x, y] = S.lighthouse;
    out.push(makeObj('lighthouse@' + islandId, isl.buildings.lighthouse ? 'light' : 'lhBase', x, y, 'lighthouse'));
  }
  if (S.npc) {
    const ppl = peopleOn(state, islandId);
    // 村落和进出口局没有具体的人：放一位村民
    const list = ppl.length ? ppl.map((p) => ({ id: p.id, ch: charOf(p) })) : isl.kind === 'recipeVillage' || isl.kind === 'laborVillage' || isl.kind === 'bureau' ? [{ id: 'villager', ch: 'islander' }] : [];
    list.slice(0, S.npc.length).forEach((p, i) => {
      const [x, y] = S.npc![i];
      out.push(makeObj('npc@' + p.id, `ch_${p.ch}_down_0`, x, y, 'npc', 'npc'));
    });
  }
  if (isl.owned && S.workbench) out.push(makeObj('workbench@' + islandId, 'workbench', ...S.workbench));
  if (isl.owned && S.chest) out.push(makeObj('chest@' + islandId, 'chest', ...S.chest));
  if (S.board) out.push(makeObj('board@' + islandId, 'board', ...S.board));
  return out;
}

/** 一座岛上的全部物体：模板里固定的 + 今天的采集点 + 跟着存档变的 */
export function objectsOn(state: GameState, islandId: string): WorldObj[] {
  if (!templateFor(islandId)) return [];
  return [...layout(islandId, state.seed).objects, ...nodesOn(state, islandId).map(nodeObject), ...stateObjects(state, islandId)];
}

export function objectById(state: GameState, islandId: string, id: string): WorldObj | undefined {
  return objectsOn(state, islandId).find((o) => o.id === id);
}

/** 物体 id 里的人（`npc@<人的 id>`） */
export function personOfObj(state: GameState, objId: string): Person | undefined {
  if (!objId.startsWith('npc@')) return undefined;
  return state.people.find((p) => p.id === objId.slice(4));
}

/** 人物脚下到物体互动范围的距离 */
export function distTo(w: Walk, o: WorldObj): number {
  return o.hit ? rectDist(w.x, w.y - 1, o.hit) : Infinity;
}

/** 规则层：离某种物体足够近（多给一点余量，画面层更严格） */
export function nearKind(state: GameState, kind: ObjKind): WorldObj | null {
  const id = mapHere(state);
  if (!id) return null;
  const lim = BALANCE.interact.reach + BALANCE.interact.slack;
  let best: WorldObj | null = null;
  let bd = Infinity;
  for (const o of objectsOn(state, id)) {
    if (o.kind !== kind) continue;
    const d = distTo(state.walk, o);
    if (d <= lim && d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** 一条命令需要站在哪种物体旁边（没有要求时为 null） */
export function objectFor(cmd: Command): ObjKind | null {
  switch (cmd.t) {
    case 'gather':
      return cmd.what === 'shoreFish' ? 'shoal' : cmd.what === 'herb' ? 'herb' : 'tree';
    case 'craft':
      return 'workbench';
    case 'transfer':
      return cmd.from === 'stock' || cmd.to === 'stock' ? 'chest' : null;
    case 'consume':
      return cmd.from === 'stock' ? 'chest' : null;
    case 'sleep':
      return 'bed';
    case 'plant':
    case 'harvest':
      return 'farm';
    case 'installPart':
    case 'repairPlane':
      return 'wreck';
    case 'deliver':
      return 'npc';
    case 'build':
      return cmd.what === 'lighthouse' ? 'lighthouse' : cmd.what === 'holdUpgrade' ? 'workbench' : null;
    default:
      return null;
  }
}

/**
 * dispatch 内的位置校验：不在旁边时返回错误消息。
 * 岛上没有这种物体时（比如还没做“建设地基”的床），沿用文字版规则不校验；制作例外：没有工作台就不能做。
 */
export function positionError(state: GameState, cmd: Command): Msg | null {
  const kind = objectFor(cmd);
  if (!kind) return null;
  if (kind === 'workbench' && !state.player.at) return m('err.needWorkbench');
  const id = mapHere(state);
  if (!id) return null;
  const has = objectsOn(state, id).some((o) => o.kind === kind);
  if (!has) return kind === 'workbench' ? m('err.needWorkbench') : null;
  if (nearKind(state, kind)) return null;
  return m('err.notNear', { what: m('thing.' + kind) });
}

/** 测试和脚本玩家用：直接站到命令需要的物体旁边（“瞬移到对象旁边再互动”） */
export function approach(state: GameState, cmd: Command): void {
  const id = mapHere(state);
  // 岛上喝海水：走到码头上（脚下就是海）
  if (cmd.t === 'drinkSea' && id) {
    const d = layout(id, state.seed).dock;
    if (d) {
      state.walk.x = d.x + d.w / 2;
      state.walk.y = d.y + d.h - 4;
    }
    return;
  }
  const kind = objectFor(cmd);
  if (!kind || !id) return;
  const o = objectsOn(state, id).find((x) => x.kind === kind && x.hit);
  if (!o || !o.hit) return;
  state.walk.x = o.hit.x + o.hit.w / 2;
  state.walk.y = o.hit.y + o.hit.h / 2 + 1;
}

/** 人物站到某座岛的码头上（靠岸、复活时用） */
export function placeAtDock(state: GameState, islandId: string): void {
  const L = templateFor(islandId) ? layout(islandId, state.seed) : null;
  const d = L?.dock;
  state.walk = { ...state.walk, island: islandId, x: d ? d.x + d.w / 2 : 0, y: d ? d.y + 8 : 0, facing: 'up' };
}

/** 人物站到某座岛的床（小屋门口）前 */
export function placeAtBed(state: GameState, islandId: string): void {
  const bed = objectsOn(state, islandId).find((o) => o.kind === 'bed');
  if (!bed || !bed.hit) return placeAtDock(state, islandId);
  state.walk = { ...state.walk, island: islandId, x: bed.hit.x + bed.hit.w / 2, y: bed.hit.y + bed.hit.h + 6, facing: 'down' };
}

/** 人物站在水边（岛上按 Z 喝海水）：脚下附近有一处是海 */
export function nearWater(state: GameState): boolean {
  const id = mapHere(state);
  const t = id ? templateFor(id) : null;
  if (!t) return false;
  const r = BALANCE.interact.waterReach;
  const { x, y } = state.walk;
  for (let a = 0; a < 8; a++) if (heightAt(t, state.seed, x + Math.cos((a * Math.PI) / 4) * r, y + Math.sin((a * Math.PI) / 4) * r) < 0) return true;
  return false;
}

function nodeLeft(state: GameState, id: string): number {
  for (const list of Object.values(state.forage)) for (const n of list) if (n.id === id) return n.left;
  return 0;
}

/** 人物身边、可以采的那个采集点（规则层用来决定采哪一个） */
export function nearNode(state: GameState, kind: ForageNode['kind']): ForageNode | null {
  const o = nearKind(state, kind);
  if (!o) return null;
  return nodesOn(state, mapHere(state)!).find((n) => n.id === o.id && n.left > 0) ?? null;
}

/** 这座岛还在等人交东西（救援 / 招募） */
export function wantsDelivery(state: GameState, islandId: string): boolean {
  const isl = findIsland(state, islandId);
  const t = ISLANDS.find((x) => x.id === islandId);
  const need = t?.rescueNeed ?? t?.recruitNeed;
  return !!isl && !!need && !needsDone(need, isl.needProgress);
}

// ---------------------------------------------------------------- 按键提示

export interface InteractInfo {
  /** “E 掰树枝”里的动作名 */
  label: Msg;
  ok: boolean;
  /** 做不了的原因（灰显时显示） */
  reason?: Msg;
}

export function interactInfo(state: GameState, o: WorldObj): InteractInfo | null {
  const lumber = !!roleOf(state, 'lumberjack')?.active;
  const farmer = !!roleOf(state, 'farmer')?.active;
  switch (o.kind) {
    case 'tree':
      return { label: m(lumber ? 'act.chop' : 'act.branch', { n: nodeLeft(state, o.id) }), ok: true };
    case 'shoal':
      return { label: m('act.shoreFish'), ok: true };
    case 'herb':
      return { label: m('act.herb', { n: nodeLeft(state, o.id) }), ok: true };
    case 'workbench':
      return { label: m('act.workbench'), ok: true };
    case 'chest':
      return { label: m('act.chest'), ok: true };
    case 'bed':
      return canSleepNow(state.time)
        ? { label: m('act.sleep'), ok: true }
        : { label: m('act.sleep'), ok: false, reason: m('reason.sleepAfter') };
    case 'lighthouse': {
      const isl = findIsland(state, state.player.at);
      return { label: m(isl?.buildings.lighthouse ? 'act.lighthouse' : 'act.buildLighthouse'), ok: true };
    }
    case 'wreck':
      return { label: m('act.wreck'), ok: true };
    case 'dock':
      return state.player.hasRaft ? { label: m('act.sail'), ok: true } : { label: m('act.sail'), ok: false, reason: m('reason.needRaft') };
    case 'farm':
      return farmer ? { label: m('act.farm'), ok: true } : { label: m('act.farm'), ok: false, reason: m('reason.needFarmer') };
    case 'npc': {
      const p = personOfObj(state, o.id);
      return { label: p ? m('act.talkTo', { who: p.name }) : m('act.talk'), ok: true };
    }
    case 'board':
      return { label: m('act.board'), ok: false, reason: m('reason.nextStage') };
    default:
      return null;
  }
}
