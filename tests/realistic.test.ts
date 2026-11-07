// 不作弊的开局试玩：不补物资、不保命，按一个普通玩家的思路玩到救出伐木工并修好第二座灯塔。
// 用来检查开局的数值和流程能不能走通。
import { describe, expect, it } from 'vitest';
import { approach } from '../src/sim/interact';
import { dispatch } from '../src/sim/actions';
import { minuteOfDay, dayOf } from '../src/sim/clock';
import { createGame } from '../src/sim/create';
import { findPath } from '../src/sim/map';
import type { Command, GameState } from '../src/sim/types';
import { island } from '../src/sim/util';

function act(s: GameState, c: Command) {
  approach(s, c);
  const r = dispatch(s, c);
  if (!r.ok) throw new Error(JSON.stringify(c) + ' → ' + JSON.stringify(r.msg));
}
const carried = (s: GameState, id: 'wood' | 'fish' | 'bottledWater' | 'herb') => (s.player.pack[id] ?? 0) + (s.player.hold[id] ?? 0);

/** 照顾自己：渴了喝、饿了吃、伤了吃草药 */
function care(s: GameState) {
  const p = s.player;
  const at = p.at ? island(s, p.at) : undefined;
  while (p.water < 40) {
    if (at?.owned && (at.stock.water ?? 0) > 0) act(s, { t: 'consume', from: 'stock', item: 'water' });
    else if ((p.pack.bottledWater ?? 0) > 0) act(s, { t: 'consume', from: 'pack', item: 'bottledWater' });
    else if (p.hp > 60) act(s, { t: 'drinkSea' });
    else break;
  }
  while (p.food < 40 && carried(s, 'fish') > 2) act(s, { t: 'consume', from: (p.pack.fish ?? 0) > 0 ? 'pack' : 'hold', item: 'fish' });
  if (p.hp < 50 && (p.pack.herb ?? 0) > 0) act(s, { t: 'consume', from: 'pack', item: 'herb' });
}

function sail(s: GameState, id: string) {
  const t = island(s, id);
  if (s.player.at === id) return;
  if (s.player.at) act(s, { t: 'leave' });
  if (s.player.twoStep) act(s, { t: 'toggleTwoStep' });
  for (let g = 0; g < 200 && (s.player.x !== t.x || s.player.y !== t.y); g++) {
    const path = findPath(s, s.player.x, s.player.y, t.x, t.y)!;
    act(s, { t: 'move', dx: path[0].dx, dy: path[0].dy });
    if (s.player.at) act(s, { t: 'leave' }); // 死了被送回床上
    care(s);
  }
  act(s, { t: 'dock' });
}

/** 天黑前回家睡觉 */
function nightCheck(s: GameState) {
  const m = minuteOfDay(s.time);
  if (m >= 19 * 60 || m < 5 * 60) {
    sail(s, 'home');
    act(s, { t: 'sleep' });
  }
}

function gatherAtHome(s: GameState, wood: number, fish: number) {
  sail(s, 'home');
  const lumber = s.people.find((p) => p.role === 'lumberjack')?.active;
  for (let g = 0; g < 80 && carried(s, 'wood') < wood; g++) {
    act(s, { t: 'gather', what: lumber ? 'chop' : 'branch' });
    care(s);
  }
  for (let g = 0; g < 80 && carried(s, 'fish') < fish; g++) {
    act(s, { t: 'gather', what: 'shoreFish' });
    care(s);
  }
}

describe('realistic opening (no cheats)', () => {
  for (const seed of [3, 17, 404, 2027]) {
    it(`seed ${seed}: raft → engineer → lighthouse → lumberjack → lighthouse`, () => {
      const s = createGame(seed);
      gatherAtHome(s, 8, 4);
      act(s, { t: 'craft', recipe: 'raft' });
      gatherAtHome(s, 8, 4); // 灯塔要 8 木头
      sail(s, 'stoneIsle');
      act(s, { t: 'deliver' });
      expect(s.people.find((p) => p.role === 'engineer')!.active).toBe(true);
      act(s, { t: 'build', what: 'lighthouse' });
      act(s, { t: 'craft', recipe: 'distill' });
      care(s);
      expect(island(s, 'forestIsle').revealed).toBe(true);
      nightCheck(s);
      gatherAtHome(s, 12, 6); // 下一座灯塔 12 木头，救伐木工 4 份食物
      nightCheck(s);
      sail(s, 'forestIsle');
      act(s, { t: 'deliver' });
      expect(s.people.find((p) => p.role === 'lumberjack')!.active).toBe(true);
      act(s, { t: 'build', what: 'lighthouse' });
      expect(island(s, 'nativeA').revealed).toBe(true);
      console.log(`seed ${seed}: day ${dayOf(s.time)} ${Math.floor(minuteOfDay(s.time) / 60)}h, deaths ${s.stats.deaths}, hp ${Math.round(s.player.hp)}`);
      expect(s.stats.deaths).toBe(0);
      expect(dayOf(s.time)).toBeLessThanOrEqual(4);
    });
  }
});
