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
    must(s, { t: 'craft', recipe: 'raft' });
    expect(s.player.hasRaft).toBe(true);
    // 采集到的东西进背包
    expect((s.player.pack.fish ?? 0) + (s.player.pack.wood ?? 0)).toBeGreaterThan(0);
    sailTo(s, 'stoneIsle');
    must(s, { t: 'deliver' });
    const eng = s.people.find((p) => p.role === 'engineer')!;
    expect(eng.active).toBe(true);
    expect(s.player.recipes).toContain('distill');
    expect(island(s, 'stoneIsle').owned).toBe(true);
    expect(s.hints.forestIsle).toBeTruthy();
    // 一次只开放一座新岛
    expect(island(s, 'forestIsle').revealed).toBe(true);
    expect(island(s, 'nativeA').revealed).toBe(false);
    expect(island(s, 'fisherIsle').revealed).toBe(false);
    // 伐木工要 4 份食物
    sailTo(s, 'forestIsle');
    must(s, { t: 'deliver' });
    expect(s.people.find((p) => p.role === 'lumberjack')!.active).toBe(true);
    expect(s.player.recipes).toContain('bottledWater');
    expect(island(s, 'nativeA').revealed).toBe(true);
    expect(island(s, 'fisherIsle').revealed).toBe(false);
  });

  it('crafts anywhere: cups at sea, but distilling needs a network island', async () => {
    const { runUntil } = await import('../src/sim/bot');
    const { craftBlock } = await import('../src/sim/actions');
    const s = runUntil(8, 'lumberjack');
    must(s, { t: 'leave' });
    s.player.pack = { wood: 3 };
    s.player.hold = {};
    must(s, { t: 'craft', recipe: 'cup', times: 2 });
    expect(s.player.pack.cup).toBe(4);
    expect(s.player.pack.wood).toBe(1);
    expect(craftBlock(s, 'distill')?.k).toBe('err.needOwnedIsland');
    expect(craftBlock(s, 'raft')?.k).toBe('err.hasRaft');
  });

  it('reveals interface features gradually', () => {
    const s = createGame(77);
    expect(s.unlocks).not.toContain('shoreFish');
    must(s, { t: 'gather', what: 'branch' });
    must(s, { t: 'gather', what: 'branch' });
    expect(s.unlocks).toContain('shoreFish');
    expect(s.unlocks).not.toContain('sea');
    expect(s.player.pack.wood).toBe(2);
  });

  it('lighthouse-gated islands are placed with a hint but stay in fog until the lighthouse', async () => {
    const { runUntil } = await import('../src/sim/bot');
    const s = runUntil(31, 'fisher');
    const v = island(s, 'village1');
    expect(v.revealed).toBe(true);
    expect(v.opened).toBe(false);
    expect(s.hints.village1).toBeTruthy();
    const { STEPS } = await import('../src/sim/bot');
    STEPS.find((x) => x.id === 'lighthouse1')!.run(s);
    expect(island(s, 'village1').opened).toBe(true);
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
    must(s, { t: 'craft', recipe: 'raft' });
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
