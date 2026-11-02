import { dispatch } from '../src/sim/actions';
import { findPath } from '../src/sim/map';
import type { Command, GameState } from '../src/sim/types';
import { island } from '../src/sim/util';
import { BALANCE } from '../src/config/balance';

export function act(state: GameState, cmd: Command) {
  const r = dispatch(state, cmd);
  return r;
}

export function must(state: GameState, cmd: Command) {
  const r = dispatch(state, cmd);
  if (!r.ok) throw new Error(`command ${JSON.stringify(cmd)} failed: ${JSON.stringify(r.msg)}`);
  return r;
}

/** 保命：在任何地方吃喝回血（测试用，避免随机死亡打断脚本） */
export function keepAlive(state: GameState) {
  const p = state.player;
  p.hp = Math.max(p.hp, 80);
  p.water = Math.max(p.water, 60);
  p.food = Math.max(p.food, 60);
}

export function sailTo(state: GameState, id: string, opts: { safe?: boolean } = { safe: true }) {
  const target = island(state, id);
  if (state.player.at === id) return;
  if (state.player.at) must(state, { t: 'leave' });
  for (let guard = 0; guard < 400; guard++) {
    if (state.player.x === target.x && state.player.y === target.y) break;
    const path = findPath(state, state.player.x, state.player.y, target.x, target.y);
    if (!path) throw new Error('no path to ' + id);
    const step = path[0];
    if (opts.safe) keepAlive(state);
    const r = dispatch(state, { t: 'move', dx: step.dx, dy: step.dy });
    if (!r.ok) throw new Error('move failed ' + JSON.stringify(r.msg));
    if (state.player.at) {
      // 死后重生在床上
      must(state, { t: 'leave' });
    }
  }
  must(state, { t: 'dock' });
  if (state.player.at !== id) throw new Error('did not reach ' + id);
}

export function homeGather(state: GameState, wood: number, fish: number) {
  const home = island(state, 'home');
  let guard = 0;
  while ((home.stock.wood ?? 0) < wood && guard++ < 500) {
    keepAlive(state);
    const lumber = state.people.find((p) => p.role === 'lumberjack')?.active;
    must(state, { t: 'gather', what: lumber ? 'chop' : 'branch' });
  }
  guard = 0;
  while ((home.stock.fish ?? 0) < fish && guard++ < 500) {
    keepAlive(state);
    must(state, { t: 'gather', what: 'shoreFish' });
  }
}

export const B = BALANCE;
