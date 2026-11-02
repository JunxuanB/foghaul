import { describe, expect, it } from 'vitest';
import { REVEALS } from '../src/config/world';
import { createGame } from '../src/sim/create';
import { findPath, isLit } from '../src/sim/map';
import { openIsland, placeIsland } from '../src/sim/reveal';
import { island, manhattan } from '../src/sim/util';
import { BALANCE } from '../src/config/balance';

describe('progressive map', () => {
  it('starts with only home and the first island placed, the rest hidden', () => {
    const s = createGame(5);
    const revealed = s.islands.filter((i) => i.revealed && i.kind !== 'bureau').map((i) => i.id);
    expect(revealed.sort()).toEqual(['home', 'stoneIsle']);
    expect(island(s, 'stoneIsle').discovered).toBe(false);
    const st = island(s, 'stoneIsle');
    expect(findPath(s, s.player.x, s.player.y, st.x, st.y)).not.toBeNull();
    // 进出口局在浓雾里
    const b = island(s, 'bureau');
    expect(isLit(s, b.x, b.y)).toBe(false);
  });

  it('every island in the chain can be placed and reached, for many seeds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createGame(seed * 7919);
      for (const r of REVEALS) {
        placeIsland(s, r.island, r.anchor);
        openIsland(s, r.island, r.anchor);
      }
      const home = island(s, 'home');
      for (const r of REVEALS) {
        const i = island(s, r.island);
        expect(i.x).toBeGreaterThanOrEqual(0);
        expect(i.y).toBeGreaterThanOrEqual(0);
        expect(i.x).toBeLessThan(BALANCE.map.width);
        expect(i.y).toBeLessThan(BALANCE.map.height);
        expect(isLit(s, i.x, i.y), `${seed} ${r.island} lit`).toBe(true);
        expect(findPath(s, home.x, home.y, i.x, i.y), `${seed} ${r.island} reachable`).not.toBeNull();
        for (const o of s.islands) if (o !== i && (o.revealed || o.kind === 'bureau')) expect(manhattan(i.x, i.y, o.x, o.y)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
