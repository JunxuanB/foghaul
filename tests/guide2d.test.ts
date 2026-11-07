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
    expect(currentGuide(s)?.id).toBe('setSail');
    // 晚上插一条“回小屋睡觉”
    advance(s, 18 * 60 - (s.time % 1440) + 5);
    expect(currentGuide(s)?.id).toBe('night');
    must(s, { t: 'sleep' });
    expect(currentGuide(s)?.id).toBe('setSail');
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

  it('pack and hold count slots with stack limits; parts take no slot', async () => {
    const { packRoom, roomIn, slotView, slotsUsed } = await import('../src/sim/inventory');
    const { BALANCE } = await import('../src/config/balance');
    const s = createGame(4);
    const I = BALANCE.inventory;
    expect(packRoom(s, 'wood')).toBe(I.packCap * I.stack.material);
    s.player.pack = { wood: 25, fish: 3, partRotor: 1 };
    // 25 木头占 2 格，3 条鱼占 1 格，零件不占
    expect(slotsUsed(s.player.pack)).toBe(3);
    // 按物品顺序排（鱼在木头前），超过堆叠上限的拆成几格
    expect(slotView(s.player.pack).slots).toEqual([
      { id: 'fish', n: 3 },
      { id: 'wood', n: I.stack.material },
      { id: 'wood', n: 25 - I.stack.material },
    ]);
    expect(slotView(s.player.pack).keys).toEqual([{ id: 'partRotor', n: 1 }]);
    // 已有的木头那一格还能再放 15 根，加上空格
    expect(roomIn(s.player.pack, I.packCap, 'wood')).toBe(2 * I.stack.material - 25 + (I.packCap - 3) * I.stack.material);
    // 背包满了，采集的东西会放进主岛仓库
    s.player.pack = { fish: I.packCap * I.stack.consumable };
    expect(packRoom(s, 'wood')).toBe(0);
    must(s, { t: 'gather', what: 'branch' });
    expect(s.islands.find((x) => x.id === 'home')!.stock.wood).toBe(1);
  });

  it('trees and herbs grow at random, run out when picked and regrow every morning', async () => {
    const { BALANCE } = await import('../src/config/balance');
    const { nodesOn } = await import('../src/sim/forage');
    const s = createGame(21);
    const F = BALANCE.forage;
    const trees = () => nodesOn(s, 'home').filter((n) => n.kind === 'tree' && n.left > 0);
    const herbs = () => nodesOn(s, 'home').filter((n) => n.kind === 'herb' && n.left > 0);
    expect(trees().length).toBe(F.tree.start);
    expect(herbs().length).toBe(F.herb.start);
    // 同一种子长在同样的位置
    expect(nodesOn(createGame(21), 'home')).toEqual(nodesOn(s, 'home'));
    // 掰光一棵树：它变成树桩，不能再采
    const t0 = trees()[0];
    s.walk.x = t0.x;
    s.walk.y = t0.y + 2;
    const left = t0.left;
    for (let i = 0; i < left; i++) must(s, { t: 'gather', what: 'branch' });
    expect(t0.left).toBe(0);
    expect(s.player.pack.wood).toBe(left);
    expect(trees().length).toBe(F.tree.start - 1);
    expect(dispatch(s, { t: 'gather', what: 'branch' }).ok).toBe(false);
    // 第二天早上：树桩清掉，新长出几棵（不超过上限）
    advance(s, 1440 - (s.time % 1440) + BALANCE.time.dayStart + 1);
    expect(nodesOn(s, 'home').some((n) => n.id === t0.id)).toBe(false);
    expect(trees().length).toBe(Math.min(F.tree.max, F.tree.start - 1 + F.tree.perDay));
    // 采集点之间不挤在一起
    const all = nodesOn(s, 'home');
    for (const a of all) for (const b of all) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(F.spacing.herb);
  });

  it('migrates a v1 save: herbs and trees become forage nodes', async () => {
    const s = createGame(8) as unknown as Record<string, unknown> & { flags: Record<string, unknown> };
    s.version = 1;
    delete s.forage;
    s.flags.herbsLeft = 3;
    const back = deserialize(JSON.stringify(s))!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.forage.home.length).toBeGreaterThan(0);
    expect('herbsLeft' in back.flags).toBe(false);
  });

  it('M2: sail freely to Stone Isle, land, rescue the engineer and build the lighthouse', async () => {
    const { BALANCE } = await import('../src/config/balance');
    const { island } = await import('../src/sim/util');
    const { canEnter } = await import('../src/sim/map');
    const s = createGame(31);
    s.player.pack = { wood: 8, fish: 6 };
    s.walk.moved = 60;
    must(s, { t: 'craft', recipe: 'raft' });
    must(s, { t: 'ackGuide', id: 'vitals' });
    expect(currentGuide(s)?.id).toBe('setSail');
    // 码头离工作台远：出海要站在码头上（这里直接离岛）
    must(s, { t: 'leave' });
    expect(s.player.at).toBeNull();
    // 出海后木筏在主岛南边的水里，所在格子照亮了
    const T = BALANCE.sail.tile;
    expect(canEnter(s, Math.floor(s.raft.x / T), Math.floor(s.raft.y / T))).toBe(true);
    expect(currentGuide(s)?.id).toBe('toStone');
    const stone = island(s, 'stoneIsle');
    // 按像素航行：每次 16 像素，朝石头岛走（先横后竖，绕开雾的格子由 canEnter 保证这条路是亮的）
    let guard = 0;
    while (Math.max(Math.abs(stone.x - s.player.x), Math.abs(stone.y - s.player.y)) > 2 && guard++ < 400) {
      const tx = stone.x * T + T / 2;
      const ty = stone.y * T + T / 2;
      const dx = Math.sign(tx - s.raft.x);
      const dy = Math.sign(ty - s.raft.y);
      const step = BALANCE.sail.stepPixels;
      const nx = s.raft.x + (Math.abs(tx - s.raft.x) > 8 ? dx * step : 0);
      const ny = s.raft.y + (Math.abs(tx - s.raft.x) > 8 ? 0 : dy * step);
      s.player.hp = 100;
      if (!dispatch(s, { t: 'sail', x: nx, y: ny }).ok) {
        // 这一格进不去：换个方向
        must(s, { t: 'sail', x: s.raft.x, y: s.raft.y + (dy || 1) * step });
      }
      if (s.player.at) break;
    }
    expect(stone.discovered).toBe(true);
    expect(currentGuide(s)?.id).toBe('dockStone');
    // 瞬移太远的一步会被拒绝
    expect(dispatch(s, { t: 'sail', x: s.raft.x + T * 5, y: s.raft.y }).ok).toBe(false);
    must(s, { t: 'dock', island: 'stoneIsle' });
    expect(s.player.at).toBe('stoneIsle');
    expect(s.walk.island).toBe('stoneIsle');
    expect(currentGuide(s)?.id).toBe('engineer');
    // 在码头上交不了：要走到工程师身边
    expect(dispatch(s, { t: 'deliver' }).msg?.k).toBe('err.notNear');
    must(s, { t: 'deliver' });
    expect(s.people.find((p) => p.role === 'engineer')?.active).toBe(true);
    expect(currentGuide(s)?.id).toBe('stoneLighthouse');
    s.player.pack.wood = 30;
    expect(island(s, 'forestIsle').revealed).toBe(false);
    must(s, { t: 'build', what: 'lighthouse' });
    expect(stone.buildings.lighthouse).toBe(true);
    expect(island(s, 'forestIsle').revealed).toBe(true);
    expect(currentGuide(s)).toBeNull();
    // 岛上站在水边才能喝海水，不能跳海捕鱼
    expect(dispatch(s, { t: 'fishSea' }).msg?.k).toBe('err.atSeaOnly');
    must(s, { t: 'drinkSea' });
  });

  it('storage: catches go to the pack, the hold is worked from the raft, stored water can be drunk at the chest', async () => {
    const { runUntil } = await import('../src/sim/bot');
    const { island } = await import('../src/sim/util');
    const { objectsOn } = await import('../src/sim/interact');
    const s = runUntil(41, 'engineer');
    // 在石头岛：救出工程师后有设施（蒸馏）、工作台、储物箱，木筏停在码头边
    expect(s.player.at).toBe('stoneIsle');
    const kinds = objectsOn(s, 'stoneIsle').map((o) => o.kind);
    for (const k of ['facility', 'workbench', 'chest', 'raft', 'npc', 'lighthouse']) expect(kinds, k).toContain(k);
    // 货舱 ⇄ 背包：要在木筏旁边
    s.player.pack = { wood: 4 };
    s.player.hold = {};
    expect(dispatch(s, { t: 'transfer', item: 'wood', from: 'pack', to: 'hold', n: 4 }).msg?.k).toBe('err.notNear');
    must(s, { t: 'transfer', item: 'wood', from: 'pack', to: 'hold', n: 4 });
    expect(s.player.hold.wood).toBe(4);
    // 储物箱里的淡水可以直接喝
    const st = island(s, 'stoneIsle');
    st.stock.water = 5;
    s.player.water = 20;
    must(s, { t: 'consume', from: 'stock', item: 'water' });
    expect(s.player.water).toBeGreaterThan(20);
    expect(st.stock.water).toBe(4);
    // 海上捕到的鱼进背包
    must(s, { t: 'leave' });
    s.player.pack = {};
    for (let i = 0; i < 30 && !(s.player.pack.fish ?? 0); i++) {
      s.player.hp = 100;
      must(s, { t: 'fishSea' });
    }
    expect(s.player.pack.fish).toBeGreaterThan(0);
    expect(s.player.hold.fish ?? 0).toBe(0);
  });

  it('islands upgrade by hand at the facility once fed: meal streak is the condition, materials the cost', async () => {
    const { runUntil } = await import('../src/sim/bot');
    const { island } = await import('../src/sim/util');
    const { BALANCE } = await import('../src/config/balance');
    const s = runUntil(43, 'engineer');
    const st = island(s, 'stoneIsle');
    expect(st.level).toBe(1);
    expect(dispatch(s, { t: 'upgradeIsland' }).msg?.k).toBe('err.notNear');
    st.mealStreak = BALANCE.economy.mealsToUpgrade - 1;
    expect(dispatch(s, { t: 'upgradeIsland' }).ok).toBe(false);
    // 吃饱够了也不会自动升级
    st.mealStreak = BALANCE.economy.mealsToUpgrade + 2;
    advance(s, 60);
    expect(st.level).toBe(1);
    s.player.pack = { ...BALANCE.economy.upgradeCost[0] };
    must(s, { t: 'upgradeIsland' });
    expect(st.level).toBe(2);
    expect(st.mealStreak).toBe(0);
  });

  it('every island has some basics by type: trees on Forest Isle, herbs on Herb Isle, a fishing spot on fishing islands', async () => {
    const { nodesOn } = await import('../src/sim/forage');
    const { objectsOn } = await import('../src/sim/interact');
    const s = createGame(17);
    expect(nodesOn(s, 'forestIsle').filter((n) => n.kind === 'tree').length).toBeGreaterThanOrEqual(6);
    expect(nodesOn(s, 'herbIsle').filter((n) => n.kind === 'herb').length).toBeGreaterThanOrEqual(4);
    expect(objectsOn(s, 'fisherIsle').some((o) => o.kind === 'shoal')).toBe(true);
    expect(objectsOn(s, 'stoneIsle').some((o) => o.kind === 'shoal')).toBe(false);
  });

  it('saves with the 2D format and refuses other versions', () => {
    const s = createGame(11);
    s.walk.x = 123;
    const back = deserialize(serialize(s))!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.walk.x).toBe(123);
    expect(deserialize(JSON.stringify({ ...s, version: 99 }))).toBeNull();
  });

  it('crafting at sea is refused even with materials', async () => {
    const { runUntil } = await import('../src/sim/bot');
    const s = runUntil(2, 'engineer');
    must(s, { t: 'leave' });
    s.player.pack = { wood: 5 };
    expect(dispatch(s, { t: 'craft', recipe: 'cup' }).msg?.k).toBe('err.needWorkbench');
  });
});
