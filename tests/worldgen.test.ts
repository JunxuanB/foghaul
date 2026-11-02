import { describe, expect, it } from 'vitest';
import { generateLayout } from '../src/sim/worldgen';
import { BALANCE } from '../src/config/balance';
import { manhattan } from '../src/sim/util';

describe('worldgen', () => {
  it('generates valid layouts for many seeds', () => {
    let maxAttempts = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { islands, attempts } = generateLayout(seed * 7919);
      maxAttempts = Math.max(maxAttempts, attempts);
      for (const a of islands) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThan(BALANCE.map.width);
        expect(a.y).toBeLessThan(BALANCE.map.height);
        for (const b of islands) {
          if (a === b) continue;
          expect(manhattan(a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(BALANCE.map.minSpacing);
        }
      }
    }
    console.log('max attempts', maxAttempts);
  });
});
