import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/create';
import { dispatch } from '../src/sim/actions';
import { advance } from '../src/sim/advance';
import { homeGather, must, sailTo } from './helpers';
import { island } from '../src/sim/util';
import { t, tm, setLang } from '../src/i18n';
import { serialize, deserialize } from '../src/sim/save';

describe('opening', () => {
  it('builds raft and rescues engineer and lumberjack', () => {
    const s = createGame(12345);
    expect(s.player.at).toBe('home');
    expect(dispatch(s, { t: 'leave' }).ok).toBe(false);
    homeGather(s, 8, 8);
    must(s, { t: 'buildRaft' });
    expect(s.player.hasRaft).toBe(true);
    must(s, { t: 'transfer', item: 'fish', from: 'stock', to: 'hold', n: 8 });
    sailTo(s, 'stoneIsle');
    must(s, { t: 'deliver' });
    const eng = s.people.find((p) => p.role === 'engineer')!;
    expect(eng.active).toBe(true);
    expect(s.player.recipes).toContain('distill');
    expect(island(s, 'stoneIsle').owned).toBe(true);
    expect(s.hints.forestIsle).toBeTruthy();
    // 伐木工要 4 份食物
    sailTo(s, 'forestIsle');
    must(s, { t: 'deliver' });
    expect(s.people.find((p) => p.role === 'lumberjack')!.active).toBe(true);
    expect(s.player.recipes).toContain('bottledWater');
  });

  it('time advances survival and night damage at sea', () => {
    const s = createGame(7);
    s.player.hasRaft = true;
    must(s, { t: 'leave' });
    const hp = s.player.hp;
    advance(s, 20 * 60); // 07:00 -> 03:00 next day
    expect(s.player.water).toBeCloseTo(10, 5);
    expect(s.player.hp).toBeLessThan(hp);
  });

  it('death respawns at home bed and keeps parts', () => {
    const s = createGame(9);
    s.player.hasRaft = true;
    s.player.hold = { fish: 10 };
    s.player.pack = { partRotor: 1, herb: 4 };
    must(s, { t: 'leave' });
    s.player.hp = 1;
    s.player.water = 0;
    advance(s, 60);
    expect(s.stats.deaths).toBe(1);
    expect(s.player.at).toBe('home');
    expect(s.player.hold.fish).toBe(5);
    expect(s.player.pack.partRotor).toBe(1);
  });

  it('save roundtrip', () => {
    const s = createGame(3);
    const r = deserialize(serialize(s))!;
    expect(r).toEqual(s);
  });

  it('renders all log lines in both languages without missing keys', () => {
    const s = createGame(12345);
    homeGather(s, 8, 8);
    must(s, { t: 'buildRaft' });
    for (const lang of ['zh', 'en'] as const) {
      setLang(lang);
      for (const l of s.log) {
        const txt = tm(l.m);
        expect(txt).not.toMatch(/\{\w+\}/);
        expect(txt).not.toMatch(/^(log|err|obj|hint)\./);
      }
    }
    expect(t('item.wood')).toBe('Wood');
    setLang('zh');
  });
});
