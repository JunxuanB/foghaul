import { BALANCE } from '../config/balance';
import type { ItemId } from '../config/items';
import { CLUE_COUNT, LATE_CRATE_COUNT, WHISPER_COUNT } from '../config/text';
import { giveToPlayer } from './inventory';
import { bureauIsland } from './map';
import { say } from './log';
import { m, stockP } from './msg';
import { force, gainPlayerXp, playerLevel } from './progression';
import { chance, pickWeighted, rand, randInt } from './rng';
import type { GameState, Stock } from './types';
import { euclid, island, manhattan } from './util';

const SEA = BALANCE.sea;

/** 在海上给玩家物品，装不下的掉回海里，返回掉落的部分 */
function giveAtSea(state: GameState, items: Stock): Stock {
  const before = state.player.at;
  state.player.at = null;
  const lost: Stock = {};
  for (const [k, v] of Object.entries(items)) {
    const left = giveToPlayer(state, k as ItemId, v ?? 0);
    if (left) lost[k as ItemId] = left;
  }
  state.player.at = before;
  return lost;
}

export function combat(state: GameState, foe: 'bees' | 'shark', strength: number, drop: Stock): void {
  const c = SEA.combat;
  state.stats.fights++;
  const f = force(state);
  const lv = playerLevel(state, 'attack');
  const crit = lv >= c.critFromLevel && chance(state, c.critBase + c.critPerLevel * (lv - c.critFromLevel));
  const mine = f * (1 - c.roll + rand(state) * 2 * c.roll);
  const theirs = strength * (1 - c.roll + rand(state) * 2 * c.roll);
  const foeM = m('foe.' + foe);
  state.lastFight = { foe, mine: Math.round(mine * 10) / 10, theirs: Math.round(theirs * 10) / 10, win: crit || mine >= theirs, at: state.time };
  if (crit || mine >= theirs) {
    state.stats.wins++;
    const lost = giveAtSea(state, drop);
    say(state, crit ? 'log.combatCrit' : 'log.combatWin', { foe: foeM, loot: stockP(drop) });
    if (Object.keys(lost).length) say(state, 'log.lostAtSea', { lost: stockP(lost) });
    gainPlayerXp(state, 'attack', Math.round(strength));
  } else {
    const dmg = Math.round(c.lossBaseHp + Math.max(0, theirs - mine));
    state.player.hp = Math.max(0, state.player.hp - dmg);
    say(state, 'log.combatLose', { foe: foeM, dmg });
    gainPlayerXp(state, 'attack', Math.ceil(strength / 2));
  }
}

function crateLoot(state: GameState): Stock {
  const doctor = state.people.find((p) => p.role === 'doctor');
  const lumber = state.people.find((p) => p.role === 'lumberjack');
  const pool: [ItemId, number, number][] = [
    ['wood', 2, 4],
    ['herb', 1, 2],
    ['fish', 1, 3],
  ];
  // 前期会漂来玩家还没解锁的实用物资
  if (!doctor?.active) pool.push(['medkit', 1, 1], ['medkit', 1, 1]);
  if (!lumber?.active) pool.push(['bottledWater', 1, 2], ['bottledWater', 1, 2]);
  else pool.push(['cup', 2, 4], ['bottledWater', 1, 2]);
  const [item, a, b] = pool[randInt(state, 0, pool.length - 1)];
  return { [item]: randInt(state, a, b) };
}

/** 每走一格调用。返回是否触发了事件。 */
export function onMove(state: GameState): boolean {
  const p = state.player;
  const b = bureauIsland(state);
  if (b && !state.flags.flightDone && euclid(p.x, p.y, b.x, b.y) <= BALANCE.map.fogBankRadius + 1.5 && chance(state, 0.3)) {
    say(state, 'whisper.' + (state.flags.whisperIndex % WHISPER_COUNT), 'hint');
    state.flags.whisperIndex++;
    return true;
  }
  if (!chance(state, SEA.eventChancePerMove)) return false;
  const home = island(state, 'home');
  const dist = manhattan(p.x, p.y, home.x, home.y);
  const w = { ...SEA.weights };
  if (dist < SEA.sharkMinDistance) w.shark = 0;
  if (state.clueIndex >= CLUE_COUNT) w.clue = 0;
  const kind = pickWeighted(state, w);
  if (kind === 'bees') {
    say(state, 'log.bees');
    const d = SEA.bees.drop.honeycomb;
    combat(state, 'bees', SEA.bees.strength, { honeycomb: randInt(state, d[0], d[1]) });
  } else if (kind === 'shark') {
    const s = Math.round(SEA.shark.baseStrength + dist * SEA.shark.perDistance);
    say(state, 'log.shark');
    const d = SEA.shark.drop.fish;
    combat(state, 'shark', s, { fish: randInt(state, d[0], d[1]) });
  } else if (kind === 'crate') {
    const late = state.people.filter((x) => x.active && x.type === 'passenger').length >= 5;
    const loot = crateLoot(state);
    const text = late && chance(state, 0.5) ? m('lateCrate.' + randInt(state, 0, LATE_CRATE_COUNT - 1)) : null;
    state.pendingCrate = { loot, text };
    say(state, 'log.crate');
  } else if (kind === 'clue') {
    say(state, 'clue.' + state.clueIndex, 'hint');
    state.clueIndex++;
  }
  return true;
}

export function takeCrate(state: GameState): void {
  const c = state.pendingCrate;
  if (!c) return;
  state.pendingCrate = null;
  const lost = giveAtSea(state, c.loot);
  say(state, 'log.crateOpen', { loot: stockP(c.loot) });
  if (c.text) say(state, c.text);
  if (Object.keys(lost).length) say(state, 'log.lostAtSea', { lost: stockP(lost) });
}
