// M3（docs/2d-design.md 第 12 节）：加入卡片、上船下船、设施地基和培训、倒下卡片；设施的自动入库机。
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { dispatch } from '../src/sim/actions';
import { advance, die } from '../src/sim/advance';
import { runUntil, sailTo } from '../src/sim/bot';
import { approach, objectsOn } from '../src/sim/interact';
import { teachableJobs } from '../src/sim/people';
import { deserialize, serialize, SAVE_VERSION } from '../src/sim/save';
import type { GameState } from '../src/sim/types';
import { createGame } from '../src/sim/create';
import { keepAlive, must } from './helpers';

const isl = (s: GameState, id: string) => s.islands.find((i) => i.id === id)!;

describe('M3: companions', () => {
  it('a rescued companion shows up in the joined queue and can board the raft and get off again', () => {
    const s = runUntil(43, 'engineer');
    const eng = s.people.find((p) => p.role === 'engineer')!;
    expect(s.joined).toContain(eng.id);
    while (s.joined.length) must(s, { t: 'ackJoined' });
    // 上船要站在人旁边，下船要在木筏旁
    s.walk.x = 0;
    s.walk.y = 0;
    expect(dispatch(s, { t: 'pickUp', personId: eng.id }).msg?.k).toBe('err.notNear');
    must(s, { t: 'pickUp', personId: eng.id });
    expect(s.player.aboard).toEqual([eng.id]);
    expect(objectsOn(s, 'stoneIsle').some((o) => o.id === 'npc@' + eng.id)).toBe(false);
    must(s, { t: 'dropOff', personId: eng.id });
    expect(eng.loc).toEqual({ kind: 'island', id: 'stoneIsle' });
  });

  it('recruited natives get a facility plot where a companion trains them; the first job builds the facility', () => {
    const s = runUntil(43, 'lumberjack');
    while (s.joined.length) must(s, { t: 'ackJoined' });
    sailTo(s, 'nativeA');
    keepAlive(s);
    s.player.pack = { bottledWater: 3, fish: 3 };
    must(s, { t: 'deliver' });
    const a = isl(s, 'nativeA');
    expect(a.owned).toBe(true);
    expect(s.joined.length).toBe(1);
    const base = objectsOn(s, 'nativeA').find((o) => o.kind === 'facility');
    expect(base?.sprite).toBe('facilityBase');
    // 带伐木工来：去森林岛接上船，回来在设施地基培训
    const lj = s.people.find((p) => p.role === 'lumberjack')!;
    sailTo(s, 'forestIsle');
    must(s, { t: 'pickUp', personId: lj.id });
    sailTo(s, 'nativeA');
    keepAlive(s);
    const native = s.people.find((p) => p.type === 'native' && p.loc.kind === 'island' && p.loc.id === 'nativeA')!;
    const job = teachableJobs(lj, a)[0];
    s.player.pack = { wood: 20, fish: 10, bottledWater: 10 };
    s.walk.x = 0;
    expect(dispatch(s, { t: 'train', personId: native.id, trainerId: lj.id, job }).msg?.k).toBe('err.notNear');
    must(s, { t: 'train', personId: native.id, trainerId: lj.id, job });
    expect(a.facility).not.toBeNull();
    expect(objectsOn(s, 'nativeA').find((o) => o.kind === 'facility')?.sprite).not.toBe('facilityBase');
  });

  it('collapsing records what was lost and where you woke up', () => {
    const s = createGame(8);
    s.player.pack = { wood: 10 };
    die(s);
    expect(s.lastDeath?.seen).toBe(false);
    expect(s.lastDeath?.bed).toBe('home');
    must(s, { t: 'ackDeath' });
    expect(s.lastDeath?.seen).toBe(true);
  });
});

describe('auto-store machine', () => {
  it('is installed at the facility and moves the output box into the chest', () => {
    const s = runUntil(43, 'engineer');
    const st = isl(s, 'stoneIsle');
    const eng = s.people.find((p) => p.role === 'engineer')!;
    if (!eng.recipes.includes('bottledWater')) eng.recipes.push('bottledWater');
    st.facility = { kind: 'process', recipe: 'bottledWater' };
    st.stock = { water: 60, cup: 60, fish: 30 };
    st.output = { bottledWater: 4 };
    s.player.pack = { ...(BALANCE.buildings.autoStore.cost as Record<string, number>) };
    s.walk.x = 0;
    expect(dispatch(s, { t: 'build', what: 'autoStore' }).msg?.k).toBe('err.notNear');
    approach(s, { t: 'build', what: 'autoStore' });
    must(s, { t: 'build', what: 'autoStore' });
    expect(st.buildings.autoStore).toBe(true);
    expect(st.output.bottledWater ?? 0).toBe(0);
    const before = st.stock.bottledWater ?? 0;
    advance(s, 60 * 6);
    expect(st.stock.bottledWater ?? 0).toBeGreaterThan(before);
    expect(st.output.bottledWater ?? 0).toBe(0);
  });

  it('v5 saves migrate: no machines, nothing joined, no collapse record', () => {
    const s = createGame(4);
    const old = JSON.parse(serialize(s));
    old.version = 5;
    delete old.joined;
    delete old.lastDeath;
    for (const i of old.islands) delete i.buildings.autoStore;
    const back = deserialize(JSON.stringify(old))!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.joined).toEqual([]);
    expect(back.lastDeath).toBeNull();
    expect(back.islands.every((i) => i.buildings.autoStore === false)).toBe(true);
  });
});
