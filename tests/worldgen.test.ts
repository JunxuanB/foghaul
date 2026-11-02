import { describe, expect, it } from 'vitest';
import { REVEALS } from '../src/config/world';
import { createGame } from '../src/sim/create';
import { findPath, isLit } from '../src/sim/map';
import { lightFrom, placeIsland } from '../src/sim/reveal';
import { island, manhattan } from '../src/sim/util';
import { BALANCE } from '../src/config/balance';

describe('progressive map', () => {
  it('starts with only home and the first island placed, the rest hidden', () => {
    const s = createGame(5);
    const revealed = s.islands.filter((i) => i.revealed && i.kind !== 'bureau').map((i) => i.id);
    expect(revealed.sort()).toEqual(['home', 'stoneIsle']);
    const st = island(s, 'stoneIsle');
    expect(st.discovered).toBe(false);
    expect(findPath(s, s.player.x, s.player.y, st.x, st.y)).not.toBeNull();
    const b = island(s, 'bureau');
    expect(isLit(s, b.x, b.y)).toBe(false);
  });

  it('each island appears inside the new area lit by its anchor lighthouse, for many seeds', () => {
    let notOwn = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = createGame(seed * 7919);
      for (const r of REVEALS) {
        const a = island(s, r.anchor);
        if (!a.buildings.lighthouse) {
          a.buildings.lighthouse = true;
          lightFrom(s, a);
        }
        placeIsland(s, r.island, r.anchor);
        const i = island(s, r.island);
        if (!a.lightEvents.includes(s.lit[i.y * s.width + i.x])) notOwn++;
      }
      const home = island(s, 'home');
      for (const r of REVEALS) {
        const i = island(s, r.island);
        expect(i.x).toBeGreaterThanOrEqual(0);
        expect(i.y).toBeLessThan(BALANCE.map.height);
        expect(isLit(s, i.x, i.y), `${seed} ${r.island} lit`).toBe(true);
        expect(findPath(s, home.x, home.y, i.x, i.y), `${seed} ${r.island} reachable`).not.toBeNull();
        for (const o of s.islands) if (o !== i && (o.revealed || o.kind === 'bureau')) expect(manhattan(i.x, i.y, o.x, o.y)).toBeGreaterThanOrEqual(5);
      }
    }
    // 几乎所有岛都应该落在锚点灯塔“新照亮”的海域里
    expect(notOwn).toBeLessThan(200 * REVEALS.length * 0.05);
  });
});
