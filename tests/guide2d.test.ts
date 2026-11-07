import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/create';
import { dispatch } from '../src/sim/actions';
import { advance } from '../src/sim/advance';
import { currentGuide, GUIDE } from '../src/sim/guide';
import { approach, interactInfo, nearKind, objectsOn, positionError } from '../src/sim/interact';
import { deserialize, serialize, SAVE_VERSION } from '../src/sim/save';
import { INTERACTIVE } from '../src/config/buildings';
import zh from '../src/i18n/zh';
import { must } from './helpers';

const keys = zh as Record<string, string>;

describe('2D rules', () => {
  it('starts next to the wreck, away from trees and the workbench', () => {
    const s = createGame(5);
    expect(s.walk.island).toBe('home');
    expect(nearKind(s, 'tree')).toBeNull();
    expect(nearKind(s, 'workbench')).toBeNull();
    expect(positionError(s, { t: 'craft', recipe: 'raft' })?.k).toBe('err.notNear');
    approach(s, { t: 'craft', recipe: 'raft' });
    expect(nearKind(s, 'workbench')).not.toBeNull();
  });

  it('the first-day script runs in order and skips steps that are already done', () => {
    const s = createGame(9);
    expect(currentGuide(s)?.id).toBe('walk');
    s.walk.moved = 60;
    must(s, { t: 'wait', minutes: 1 });
    expect(currentGuide(s)?.id).toBe('branch');
    must(s, { t: 'gather', what: 'branch' });
    expect(currentGuide(s)?.id).toBe('moreWood');
    // 一次给够木头：捞鱼和 8 根木头两步都直接跳过
    s.player.pack.wood = 8;
    must(s, { t: 'wait', minutes: 1 });
    expect(currentGuide(s)?.id).toBe('raft');
    must(s, { t: 'craft', recipe: 'raft' });
    expect(currentGuide(s)?.id).toBe('vitals');
    must(s, { t: 'ackGuide', id: 'vitals' });
    expect(s.guide.step).toBe(GUIDE.length);
    // 晚上插一条“回小屋睡觉”
    advance(s, 18 * 60 - (s.time % 1440) + 5);
    expect(currentGuide(s)?.id).toBe('night');
    must(s, { t: 'sleep' });
    expect(currentGuide(s)).toBeNull();
  });

  it('every interactive object has a name, an intro and a prompt', () => {
    const s = createGame(3);
    for (const k of INTERACTIVE) {
      expect(keys['thing.' + k], k).toBeTruthy();
      expect(keys['intro2d.' + k], k).toBeTruthy();
    }
    for (const o of objectsOn(s, 'home')) if (o.kind !== 'decor') expect(interactInfo(s, o), o.id).not.toBeNull();
    for (const g of GUIDE) expect(keys['guide.' + g.id], g.id).toBeTruthy();
    expect(keys['guide.night']).toBeTruthy();
  });

  it('saves with the 2D format and refuses other versions', () => {
    const s = createGame(11);
    s.walk.x = 123;
    const back = deserialize(serialize(s))!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.walk.x).toBe(123);
    expect(deserialize(JSON.stringify({ ...s, version: 4 }))).toBeNull();
  });

  it('crafting at sea is refused even with materials', async () => {
    const { runUntil } = await import('../src/sim/bot');
    const s = runUntil(2, 'engineer');
    must(s, { t: 'leave' });
    s.player.pack = { wood: 5 };
    expect(dispatch(s, { t: 'craft', recipe: 'cup' }).msg?.k).toBe('err.needWorkbench');
  });
});
