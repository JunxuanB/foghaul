// M4 / M5（docs/2d-design.md 第 12 节）：村落的请求板和学堂、建设地基、船坞和运输线、修飞机、停机坪、进出口局，
// 以及脚本走完以后的目标箭头。
import { describe, expect, it } from 'vitest';
import { PART_IDS } from '../src/config/items';
import { dispatch } from '../src/sim/actions';
import { runUntil, sailTo } from '../src/sim/bot';
import { approach, objectsOn } from '../src/sim/interact';
import { objectiveTarget } from '../src/sim/objectives';
import { deserialize, serialize, SAVE_VERSION } from '../src/sim/save';
import type { GameState } from '../src/sim/types';
import { keepAlive, must } from './helpers';

const far = (s: GameState) => {
  s.walk.x = 0;
  s.walk.y = 0;
};

describe('M4: villages', () => {
  it('village requests are delivered at the request board, recipes are learned at the school', () => {
    const s = runUntil(43, 'fisher');
    while (s.joined.length) must(s, { t: 'ackJoined' });
    sailTo(s, 'village1');
    keepAlive(s);
    const kinds = objectsOn(s, 'village1').map((o) => o.kind);
    expect(kinds).toContain('board');
    expect(kinds).toContain('school');
    // 村长站在请求板旁
    expect(objectsOn(s, 'village1').some((o) => o.id === 'npc@elder')).toBe(true);
    s.player.pack = { fish: 6, bottledWater: 4 };
    far(s);
    expect(dispatch(s, { t: 'deliver' }).msg?.k).toBe('err.notNear');
    must(s, { t: 'deliver' });
    expect(s.villages.tide.pendingRecipes).toContain('grilledFish');
    // 学：渔民要在场，要站在学堂旁
    const fisher = s.people.find((p) => p.role === 'fisher')!;
    sailTo(s, 'fisherIsle');
    must(s, { t: 'pickUp', personId: fisher.id });
    sailTo(s, 'village1');
    far(s);
    expect(dispatch(s, { t: 'learn', personId: fisher.id, recipe: 'grilledFish' }).msg?.k).toBe('err.notNear');
    must(s, { t: 'learn', personId: fisher.id, recipe: 'grilledFish' });
    expect(fisher.learning).not.toBeNull();
    // 学的时候站在村里（npc 槽位上）
    expect(objectsOn(s, 'village1').some((o) => o.id === 'npc@' + fisher.id)).toBe(true);
  });

  it('the objective arrow points at the board, then the school, then elsewhere', () => {
    const s = runUntil(43, 'fisher');
    // 潮声村还没出现：先去渔民岛修灯塔
    expect(objectiveTarget(s)).toEqual({ at: 'fisherIsle', obj: 'lighthouse' });
    sailTo(s, 'village1');
    expect(objectiveTarget(s)).toEqual({ at: 'village1', obj: 'board' });
    s.villages.tide.pendingRecipes.push('grilledFish');
    expect(objectiveTarget(s)).toEqual({ at: 'village1', obj: 'school' });
  });
});

describe('M4: building plots', () => {
  it('a hut built on a network island is a bed you can sleep in', () => {
    const s = runUntil(43, 'engineer');
    while (s.joined.length) must(s, { t: 'ackJoined' });
    keepAlive(s);
    expect(objectsOn(s, 'stoneIsle').some((o) => o.kind === 'plot')).toBe(true);
    expect(objectsOn(s, 'stoneIsle').some((o) => o.kind === 'bed')).toBe(false);
    s.player.pack = { wood: 20 };
    far(s);
    expect(dispatch(s, { t: 'build', what: 'bed' }).msg?.k).toBe('err.notNear');
    must(s, { t: 'build', what: 'bed' });
    expect(objectsOn(s, 'stoneIsle').some((o) => o.kind === 'bed' && o.sprite === 'hut')).toBe(true);
    s.time = Math.floor(s.time / 1440) * 1440 + 20 * 60;
    must(s, { t: 'sleep' });
  });
});

describe('M4: shipyard and routes', () => {
  it('transport rafts are built, crew trained and routes opened at the home shipyard; rafts sail on the sea', () => {
    const s = runUntil(43, 'route');
    expect(objectsOn(s, 'home').some((o) => o.kind === 'shipyard')).toBe(true);
    expect(s.transport.routes.length).toBe(1);
    // 不在船坞旁不能开通路线
    far(s);
    const r = s.transport.routes[0];
    expect(dispatch(s, { t: 'deleteRoute', id: r.id }).msg?.k).toBe('err.notNear');
    // 别的岛上没有船坞：不能开
    sailTo(s, 'fisherIsle');
    expect(dispatch(s, { t: 'createRoute', a: 'home', b: 'fisherIsle', cargoAB: null, cargoBA: 'fish', crewId: r.crewId }).msg?.k).toBe('err.notNear');
  });
});

describe('M5: plane, helipad, bureau', () => {
  it('parts go into the wreck, the repaired plane is a helipad, the flight lands on the bureau pad, the report is made at the office', () => {
    const s = runUntil(43, 'parts');
    sailTo(s, 'home');
    keepAlive(s);
    for (const p of PART_IDS) if ((s.player.pack[p] ?? 0) > 0) must(s, { t: 'installPart', item: p });
    s.player.pack.wood = 30;
    s.player.pack.medkit = 2;
    must(s, { t: 'repairPlane' });
    expect(s.cutscene?.kind).toBe('flight');
    const plane = objectsOn(s, 'home').find((o) => o.sprite === 'plane');
    expect(plane?.kind).toBe('helipad');
    must(s, { t: 'endCutscene' });
    expect(s.player.at).toBe('bureau');
    // 落在进出口局的停机坪旁
    expect(s.walk.island).toBe('bureau');
    const pad = objectsOn(s, 'bureau').find((o) => o.kind === 'helipad')!;
    expect(Math.abs(s.walk.x - (pad.hit!.x + pad.hit!.w / 2))).toBeLessThan(2);
    far(s);
    expect(dispatch(s, { t: 'report' }).msg?.k).toBe('err.notNear');
    approach(s, { t: 'report' });
    must(s, { t: 'report' });
    expect(s.cutscene?.kind).toBe('ending');
    must(s, { t: 'endCutscene' });
    // 无尽模式：出口、升级都在办公楼
    s.player.pack.fish = 10;
    must(s, { t: 'export', item: 'fish', from: 'pack', n: 10 });
    expect(s.bureau.trade).toBeGreaterThan(0);
    // 飞回主岛（直升机旁）
    must(s, { t: 'fly', to: 'home' });
    expect(s.player.at).toBe('home');
    expect(s.walk.island).toBe('home');
  });
});

describe('save v7', () => {
  it('a v6 save loads: trees and herbs regrow on the new maps, never on a building slot', () => {
    const s = runUntil(43, 'fisher');
    const old = JSON.parse(serialize(s));
    old.version = 6;
    old.forage.home = [{ id: 'f999', kind: 'tree', sprite: 'tree', x: 500, y: 452, left: 3 }];
    const back = deserialize(JSON.stringify(old))!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.forage.home.some((n) => n.id === 'f999')).toBe(false);
    expect(back.forage.home.length).toBeGreaterThan(0);
  });
});
