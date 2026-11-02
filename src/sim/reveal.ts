// 剧情解锁：每座岛都要先修灯塔才能探路。
// 剧情条件满足、并且锚点岛的灯塔已经亮了，下一座岛才会在这座灯塔新照亮的海域里生成。
import { ISLANDS, REVEALS, type RevealCond, type RevealDef } from '../config/world';
import { giveHint } from './hints';
import { say } from './log';
import { islandM } from './msg';
import { lightCircle } from './map';
import { roleOf } from './people';
import { rand } from './rng';
import type { GameState, Island } from './types';
import { island } from './util';
import { NATIVE_BIOMES, findSpot, lightRadius } from './worldgen';

function learned(state: GameState, recipe: string): boolean {
  return state.people.some((p) => p.recipes.includes(recipe as never));
}

export function condMet(state: GameState, c: RevealCond): boolean {
  switch (c) {
    case 'start':
      return true;
    case 'engineer':
    case 'lumberjack':
    case 'fisher':
    case 'farmer':
    case 'doctor':
      return !!roleOf(state, c)?.active;
    case 'firstTraining':
      return state.flags.firstTraining;
    case 'pilotHome': {
      const p = roleOf(state, 'pilot');
      return !!p?.active && p.loc.kind === 'island' && p.loc.id === 'home';
    }
    case 'firstRoute':
      return state.transport.routes.length > 0;
  }
  if (c.startsWith('learned:')) return learned(state, c.slice(8));
  if (c.startsWith('recruited:')) return island(state, c.slice(10)).owned;
  return false;
}

/** 修灯塔（或岛升级时灯塔照得更远）：照亮一片圆形海域，记下事件编号 */
export function lightFrom(state: GameState, isl: Island): void {
  const ev = lightCircle(state, isl.x, isl.y, lightRadius(isl));
  isl.lightEvents.push(ev);
}

/** 把岛放上地图 */
export function placeIsland(state: GameState, id: string, anchorId: string): Island {
  const isl = island(state, id);
  if (isl.revealed) return isl;
  const spot = findSpot(state, island(state, anchorId));
  isl.x = spot.x;
  isl.y = spot.y;
  isl.rot = Math.floor(rand(state) * 360);
  isl.revealed = true;
  const tpl = ISLANDS.find((t) => t.id === id)?.biome;
  if (tpl === 'native') isl.biome = NATIVE_BIOMES[Math.floor(rand(state) * NATIVE_BIOMES.length)];
  else if (tpl === 'forestOrStone') isl.biome = rand(state) < 0.5 ? 'forest' : 'stone';
  return isl;
}

/** 某座岛的解锁定义 */
export function revealOf(id: string): RevealDef | undefined {
  return REVEALS.find((r) => r.island === id);
}

/** 剧情已经走到了、但还缺灯塔：返回需要修灯塔的岛 id */
export function needsLighthouse(state: GameState, id: string): string | null {
  const r = revealOf(id);
  if (!r || island(state, id).revealed || !condMet(state, r.when)) return null;
  return island(state, r.anchor).buildings.lighthouse ? null : r.anchor;
}

/** 检查所有解锁条件。可以重复调用，已完成的会跳过。 */
export function checkReveals(state: GameState): void {
  for (const r of REVEALS) {
    const isl = island(state, r.island);
    if (isl.revealed || !condMet(state, r.when)) continue;
    const anchor = island(state, r.anchor);
    if (!anchor.buildings.lighthouse) {
      if (!state.lighthouseAsked.includes(r.anchor)) {
        state.lighthouseAsked.push(r.anchor);
        say(state, 'log.needLighthouse', { isl: islandM(r.anchor) }, 'hint');
      }
      continue;
    }
    placeIsland(state, r.island, r.anchor);
    say(state, giveHint(state, r.island, r.anchor, r.hint), 'hint');
  }
}
