// 剧情解锁：按 REVEALS 顺序，在条件满足时放置新岛、打开迷雾。
import { BALANCE } from '../config/balance';
import { ISLANDS, REVEALS, type RevealCond } from '../config/world';
import { giveHint } from './hints';
import { say } from './log';
import { findPath, lightCircle, lightCorridor } from './map';
import { roleOf } from './people';
import { rand } from './rng';
import type { GameState, Island } from './types';
import { island } from './util';
import { NATIVE_BIOMES, findSpot } from './worldgen';

const M = BALANCE.map;

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
  if (c.startsWith('lighthouse:')) return island(state, c.slice(11)).buildings.lighthouse;
  if (c.startsWith('learned:')) return learned(state, c.slice(8));
  if (c.startsWith('recruited:')) return island(state, c.slice(10)).owned;
  return false;
}

function resolveBiome(state: GameState, isl: Island, tplBiome: string | undefined): void {
  if (tplBiome === 'native') isl.biome = NATIVE_BIOMES[Math.floor(rand(state) * NATIVE_BIOMES.length)];
  else if (tplBiome === 'forestOrStone') isl.biome = rand(state) < 0.5 ? 'forest' : 'stone';
}

/** 把岛放上地图（还在迷雾里） */
export function placeIsland(state: GameState, id: string, anchorId: string): Island {
  const isl = island(state, id);
  if (isl.revealed) return isl;
  const anchor = island(state, anchorId);
  const spot = findSpot(state, anchor);
  isl.x = spot.x;
  isl.y = spot.y;
  isl.rot = Math.floor(rand(state) * 360);
  isl.revealed = true;
  return isl;
}

/** 为岛打开迷雾：岛周围一小片海域，加上一条连回锚点岛的航道 */
export function openIsland(state: GameState, id: string, anchorId: string): void {
  const isl = island(state, id);
  if (isl.opened) return;
  const anchor = island(state, anchorId);
  const ox = Math.round((rand(state) - 0.5) * 3);
  const oy = Math.round((rand(state) - 0.5) * 3);
  lightCircle(state, isl.x + ox, isl.y + oy, M.pocketRadius);
  lightCircle(state, isl.x, isl.y, 1.5);
  const xFirst = rand(state) < 0.5;
  lightCorridor(state, anchor.x, anchor.y, isl.x, isl.y, xFirst);
  // 航道可能被进出口局的浓雾截断：换一种折法，再不行就绕一个中间点
  if (!findPath(state, anchor.x, anchor.y, isl.x, isl.y)) lightCorridor(state, anchor.x, anchor.y, isl.x, isl.y, !xFirst);
  if (!findPath(state, anchor.x, anchor.y, isl.x, isl.y)) {
    const home = island(state, 'home');
    lightCorridor(state, home.x, home.y, isl.x, isl.y, xFirst);
    lightCorridor(state, home.x, home.y, isl.x, isl.y, !xFirst);
  }
  isl.opened = true;
}

/** 检查所有解锁条件。可以重复调用，已完成的会跳过。 */
export function checkReveals(state: GameState): void {
  for (const r of REVEALS) {
    const isl = island(state, r.island);
    if (!isl.revealed) {
      if (!condMet(state, r.place)) continue;
      placeIsland(state, r.island, r.anchor);
      resolveBiome(state, isl, templateBiome(r.island));
      say(state, giveHint(state, r.island, r.from, r.hint), 'hint');
    }
    if (!isl.opened && condMet(state, r.open ?? r.place)) {
      openIsland(state, r.island, r.anchor);
      if (r.open && r.open !== r.place) say(state, 'log.fogLifts', 'hint');
    }
  }
}

function templateBiome(id: string): string | undefined {
  return ISLANDS.find((t) => t.id === id)?.biome;
}
