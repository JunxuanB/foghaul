import { BALANCE } from '../config/balance';
import { ISLANDS } from '../config/world';
import { islandRate } from '../sim/economy';
import { m, type Msg } from '../sim/msg';
import { residentsOf } from '../sim/people';
import type { GameState, Island } from '../sim/types';

export type Status = 'isle' | 'warn' | 'stop' | 'neutral';

/** 地图和总览上的岛屿状态：运转中 / 需要处理 / 停工 */
export function islandStatus(state: GameState, isl: Island): { cls: Status; note: Msg | null } {
  if (!isl.owned || isl.kind === 'home') {
    if (isl.kind === 'home') return { cls: 'isle', note: null };
    if (!isl.owned && (isl.kind === 'passenger' || isl.kind === 'native' || isl.kind === 'islet')) {
      const t = ISLANDS.find((x) => x.id === isl.id);
      const pass = state.people.find((p) => p.loc.kind === 'island' && p.loc.id === isl.id && p.type === 'passenger' && !p.active);
      if (t?.rescueNeed && pass) return { cls: 'warn', note: m('status.rescue') };
      if (t?.recruitNeed) return { cls: 'warn', note: m('status.recruit') };
    }
    return { cls: 'neutral', note: null };
  }
  if (isl.sleepy) return { cls: 'stop', note: m('status.sleepy') };
  const res = residentsOf(state, isl);
  if (!res.length) return { cls: 'stop', note: m('status.empty') };
  if (isl.lastMeal === 'none') return { cls: 'stop', note: m('mealui.' + isl.lastMealNote) };
  if (isl.workNote === 'work.full') return { cls: 'warn', note: m('status.full') };
  if (isl.workNote === 'work.noInput') return { cls: 'warn', note: m('status.noInput') };
  if (isl.lastMeal === 'partial') return { cls: 'warn', note: m('mealui.' + isl.lastMealNote) };
  const r = islandRate(state, isl);
  if (isl.facility && r.rate <= 0) return { cls: 'stop', note: m(r.note) };
  return { cls: 'isle', note: null };
}

export function bar(v: number, max = 100, width = 10): string {
  const n = Math.max(0, Math.min(width, Math.round((v / max) * width)));
  return '█'.repeat(n) + '░'.repeat(width - n);
}

export function ratioBar(r: number): string {
  const n = Math.max(0, Math.min(10, Math.round(r * 10)));
  return '█'.repeat(n) + '░'.repeat(10 - n);
}

export const ZOOMS = BALANCE.map.zooms;
