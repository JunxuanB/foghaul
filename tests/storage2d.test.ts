// 岛上的存放（docs/2d-design.md “玩法梳理”）：储物箱按格子 + 堆叠、淡水在水缸、设施产物进暂存箱；昨日收成。
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { dispatch } from '../src/sim/actions';
import { advance } from '../src/sim/advance';
import { runUntil } from '../src/sim/bot';
import { createGame } from '../src/sim/create';
import { closeDay, islandRate, produce } from '../src/sim/economy';
import { approach } from '../src/sim/interact';
import { outputCap, stockRoom, stockSlots, tankCap } from '../src/sim/inventory';
import { deserialize, serialize, SAVE_VERSION } from '../src/sim/save';
import type { GameState } from '../src/sim/types';
import { must } from './helpers';

const IS = BALANCE.inventory.island;
const stone = (s: GameState) => s.islands.find((i) => i.id === 'stoneIsle')!;

describe('island storage', () => {
  it('the chest uses slots and stacks that grow with the island level; fresh water goes to its own tank', () => {
    const s = runUntil(43, 'engineer');
    const st = stone(s);
    st.stock = {};
    expect(stockSlots(s, st)).toBe(IS.slots[0]);
    expect(stockRoom(s, st, 'wood')).toBe(IS.slots[0] * BALANCE.inventory.stack.material);
    // 淡水不占格子
    st.stock = { water: 10 };
    expect(stockRoom(s, st, 'wood')).toBe(IS.slots[0] * BALANCE.inventory.stack.material);
    expect(stockRoom(s, st, 'water')).toBe(tankCap(s, st) - 10);
    st.level = 2;
    expect(stockSlots(s, st)).toBe(IS.slots[1]);
    expect(tankCap(s, st)).toBe(IS.tank[1]);
    // 背包放进储物箱：按格子算放得下多少
    st.level = 1;
    st.stock = { fish: IS.slots[0] * BALANCE.inventory.stack.consumable };
    s.player.pack = { wood: 5 };
    approach(s, { t: 'transfer', item: 'wood', from: 'pack', to: 'stock', n: 5 });
    expect(dispatch(s, { t: 'transfer', item: 'wood', from: 'pack', to: 'stock', n: 5 }).ok).toBe(false);
  });

  it('the water facility fills the tank and stops when it is full', () => {
    const s = runUntil(43, 'engineer');
    const st = stone(s);
    expect(st.facility).toEqual({ kind: 'produce', item: 'water' });
    st.stock = { fish: 40 };
    advance(s, 60 * 48);
    // 岛民每顿喝掉一点，水缸接近满
    expect(st.stock.water).toBeGreaterThan(tankCap(s, st) - 5);
    expect(st.output).toEqual({});
    st.stock.water = tankCap(s, st);
    produce(s, 60);
    expect(islandRate(s, st).rate).toBeGreaterThan(0);
    expect(st.stock.water).toBe(tankCap(s, st));
    expect(st.workNote).toBe('work.tankFull');
  });

  it('other products go to the output box next to the facility, which stops production when full; residents can eat from it', () => {
    const s = runUntil(43, 'engineer');
    const st = stone(s);
    const eng = s.people.find((p) => p.role === 'engineer')!;
    if (!eng.recipes.includes('bottledWater')) eng.recipes.push('bottledWater');
    st.facility = { kind: 'process', recipe: 'bottledWater' };
    st.stock = { water: 60, cup: 60, fish: 40 };
    advance(s, 60 * 24);
    expect(st.output.bottledWater).toBe(outputCap(st, 'bottledWater'));
    expect(st.stock.bottledWater ?? 0).toBe(0);
    expect(st.workNote).toBe('work.outputFull');
    // 拿到背包 / 全部放进仓库：要站在设施旁
    expect(dispatch(s, { t: 'collect', to: 'stock' }).msg?.k).toBe('err.notNear');
    approach(s, { t: 'collect', to: 'stock' });
    must(s, { t: 'collect', to: 'stock' });
    expect(st.output.bottledWater ?? 0).toBe(0);
    expect(st.stock.bottledWater).toBe(outputCap(st, 'bottledWater'));
    st.output = { bottledWater: 3 };
    must(s, { t: 'collect', to: 'pack', item: 'bottledWater' });
    expect(s.player.pack.bottledWater).toBe(3);
    expect(dispatch(s, { t: 'collect', to: 'pack' }).msg?.k).toBe('err.outputEmpty');
    // 储物箱没吃的，岛民从暂存箱里拿
    st.stock = { water: 30 };
    st.output = { fish: 5 };
    st.facility = { kind: 'produce', item: 'water' };
    advance(s, 60 * 8);
    expect(st.output.fish).toBeLessThan(5);
    expect(st.lastMeal).not.toBe('none');
  });

  it('fills a cup from the tank at the chest', () => {
    const s = runUntil(43, 'engineer');
    const st = stone(s);
    if (!s.player.recipes.includes('bottledWater')) s.player.recipes.push('bottledWater');
    st.stock = { water: 5 };
    s.player.pack = { cup: 1 };
    expect(dispatch(s, { t: 'fillCup' }).msg?.k).toBe('err.notNear');
    approach(s, { t: 'fillCup' });
    must(s, { t: 'fillCup' });
    expect(s.player.pack.bottledWater).toBe(1);
    expect(s.player.pack.cup ?? 0).toBe(0);
    expect(st.stock.water).toBe(4);
  });
});

describe('yesterday’s harvest', () => {
  it('each morning turns the day’s production and meals into a report the player acknowledges', () => {
    const s = runUntil(43, 'engineer');
    const st = stone(s);
    st.stock = { fish: 40 };
    s.today = {};
    s.report = null;
    advance(s, 60 * 26);
    expect(s.report).not.toBeNull();
    const row = s.report!.rows.find((r) => r.id === 'stoneIsle')!;
    expect(row.made.water).toBeGreaterThan(0);
    expect(row.meals.length).toBeGreaterThan(0);
    expect(s.report!.seen).toBe(false);
    must(s, { t: 'ackReport' });
    expect(s.report!.seen).toBe(true);
  });

  it('shows nothing when nothing was made', () => {
    const s = createGame(3);
    closeDay(s, 1);
    expect(s.report).toBeNull();
  });

  it('old saves get an empty output box and no report', () => {
    const s = createGame(4);
    const old = JSON.parse(serialize(s));
    old.version = 4;
    delete old.today;
    delete old.report;
    for (const i of old.islands) delete i.output;
    const back = deserialize(JSON.stringify(old))!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.islands.every((i) => i.output && Object.keys(i.output).length === 0)).toBe(true);
    expect(back.report).toBeNull();
  });
});
