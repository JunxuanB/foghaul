// 2D：岛上的互动对象。规则层用它校验“人物在不在这个东西旁边”，画面层用它决定按键提示。
// 只有有地图模板的岛（M1：主岛）才校验位置；其他岛在它们的模板做好之前沿用文字版规则。
import { BALANCE } from '../config/balance';
import type { ObjKind } from '../config/buildings';
import { MAPS } from '../config/maps';
import { layout, rectDist, type WorldObj } from '../world/island';
import { canSleepNow } from './clock';
import { m, type Msg } from './msg';
import { roleOf } from './people';
import type { Command, GameState, Walk } from './types';

/** 当前所在岛有 2D 地图，并且人物在这张图上 */
export function mapHere(state: GameState): string | null {
  const at = state.player.at;
  if (!at || !MAPS[at] || state.walk.island !== at) return null;
  return at;
}

export function objectsOn(state: GameState, islandId: string): WorldObj[] {
  if (!MAPS[islandId]) return [];
  return layout(islandId, state.seed).objects;
}

export function objectById(state: GameState, islandId: string, id: string): WorldObj | undefined {
  return objectsOn(state, islandId).find((o) => o.id === id);
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
    default:
      return null;
  }
}

/** dispatch 内的位置校验：不在旁边时返回错误消息 */
export function positionError(state: GameState, cmd: Command): Msg | null {
  const kind = objectFor(cmd);
  if (!kind) return null;
  // 制作只能在工作台：海上不能做
  if (kind === 'workbench' && !state.player.at) return m('err.needWorkbench');
  if (!mapHere(state)) return null;
  if (nearKind(state, kind)) return null;
  return m('err.notNear', { what: m('thing.' + kind) });
}

/** 测试和脚本玩家用：直接站到命令需要的物体旁边（“瞬移到对象旁边再互动”） */
export function approach(state: GameState, cmd: Command): void {
  const kind = objectFor(cmd);
  const id = mapHere(state);
  if (!kind || !id) return;
  const o = objectsOn(state, id).find((x) => x.kind === kind && x.hit);
  if (!o || !o.hit) return;
  state.walk.x = o.hit.x + o.hit.w / 2;
  state.walk.y = o.hit.y + o.hit.h / 2 + 1;
}

/** 人物站到某座岛的码头上（靠岸、复活时用） */
export function placeAtDock(state: GameState, islandId: string): void {
  const L = MAPS[islandId] ? layout(islandId, state.seed) : null;
  const d = L?.dock;
  state.walk = { ...state.walk, island: islandId, x: d ? d.x + d.w / 2 : 0, y: d ? d.y + 8 : 0, facing: 'down' };
}

/** 人物站到某座岛的床（小屋门口）前 */
export function placeAtBed(state: GameState, islandId: string): void {
  const bed = objectsOn(state, islandId).find((o) => o.kind === 'bed');
  if (!bed || !bed.hit) return placeAtDock(state, islandId);
  state.walk = { ...state.walk, island: islandId, x: bed.hit.x + bed.hit.w / 2, y: bed.hit.y + bed.hit.h + 6, facing: 'down' };
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
      return { label: m(lumber ? 'act.chop' : 'act.branch'), ok: true };
    case 'shoal':
      return { label: m('act.shoreFish'), ok: true };
    case 'herb':
      return state.flags.herbsLeft > 0
        ? { label: m('act.herb', { n: state.flags.herbsLeft }), ok: true }
        : { label: m('act.herbDone'), ok: false, reason: m('reason.herbsGone') };
    case 'workbench':
      return { label: m('act.workbench'), ok: true };
    case 'chest':
      return { label: m('act.chest'), ok: true };
    case 'bed':
      return canSleepNow(state.time)
        ? { label: m('act.sleep'), ok: true }
        : { label: m('act.sleep'), ok: false, reason: m('reason.sleepAfter') };
    case 'lighthouse':
      return { label: m('act.lighthouse'), ok: true };
    case 'wreck':
      return { label: m('act.wreck'), ok: true };
    case 'dock':
      return state.player.hasRaft
        ? { label: m('act.sail'), ok: false, reason: m('reason.seaSoon') }
        : { label: m('act.sail'), ok: false, reason: m('reason.needRaft') };
    case 'farm':
      return farmer ? { label: m('act.farm'), ok: true } : { label: m('act.farm'), ok: false, reason: m('reason.needFarmer') };
    default:
      return null;
  }
}
