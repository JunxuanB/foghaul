import { SAVE_VERSION } from './save';
import { layout } from '../world/island';
import { initForage } from './forage';
import { modIds } from '../mod/registry';
import { BALANCE } from '../config/balance';
import { NATIVE_NAME_COUNT, OPENING_LINES } from '../config/text';
import { ISLANDS, VILLAGES, type VillageId } from '../config/world';
import { look } from './map';
import { say } from './log';
import { m, roleM } from './msg';
import type { GameState, Island, Person, VillageState } from './types';
import { placeHomeAndBureau } from './worldgen';
import { checkReveals, lightFrom } from './reveal';
import { updateUnlocks } from './tutorial';

export function newSeed(): number {
  return BALANCE.map.fixedSeed ?? Math.floor(Math.random() * 2 ** 31);
}

export function createGame(seed: number = newSeed()): GameState {
  const fixed = placeHomeAndBureau(seed);
  const islands: Island[] = ISLANDS.map((t) => {
    const p = t.kind === 'home' ? fixed.home : t.kind === 'bureau' ? fixed.bureau : { x: -1, y: -1 };
    const biome = t.biome && t.biome !== 'native' && t.biome !== 'forestOrStone' ? t.biome : null;
    return {
      id: t.id,
      kind: t.kind,
      stage: t.stage,
      x: p.x,
      y: p.y,
      rot: 0,
      biome,
      revealed: t.kind === 'home',
      lightEvents: [],
      discovered: t.kind === 'home',
      visited: t.kind === 'home',
      owned: t.kind === 'home',
      needProgress: (t.rescueNeed ?? t.recruitNeed ?? []).map(() => 0),
      facility: null,
      level: 1,
      mealStreak: 0,
      lastMeal: null,
      lastMealNote: '',
      stock: {},
      buildings: { lighthouse: t.kind === 'home', bed: t.kind === 'home', depot: false, helipad: false },
      sleepy: false,
      prodAcc: 0,
      workNote: '',
      reserve: {},
      target: {},
    };
  });

  const people: Person[] = [];
  let no = 1;
  for (const t of ISLANDS) {
    if (t.passenger) {
      people.push({
        id: 'p_' + t.passenger,
        name: roleM(t.passenger),
        type: 'passenger',
        role: t.passenger,
        job: null,
        loc: { kind: 'island', id: t.id },
        lastIsland: t.id,
        recipes: [],
        xp: 0,
        active: false,
        learning: null,
      });
    } else if (t.kind === 'native') {
      people.push(newNative(no++, t.id, false));
    }
  }

  const home = islands[0];
  const villages = {} as Record<VillageId, VillageState>;
  for (const id of Object.keys(VILLAGES) as VillageId[]) {
    villages[id] = { favor: 0, progress: VILLAGES[id].requests[0].need.map(() => 0), pendingRecipes: [], repeatCount: 0 };
  }

  const S = BALANCE.survival;
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed ^ 0x5bd1e995,
    time: BALANCE.time.startMinute,
    width: BALANCE.map.width,
    height: BALANCE.map.height,
    islands,
    people,
    seen: new Array(BALANCE.map.width * BALANCE.map.height).fill(0),
    lit: new Array(BALANCE.map.width * BALANCE.map.height).fill(0),
    lightSeq: 1,
    lighthouseAsked: [],
    unlocks: [],
    tips: [],
    newRecipes: [],
    recipePopup: [],
    player: {
      x: home.x,
      y: home.y,
      at: 'home',
      hp: S.startHp,
      water: S.startWater,
      food: S.startFood,
      hasRaft: false,
      pack: {},
      hold: {},
      holdCap: BALANCE.inventory.holdCap,
      holdUpgrades: 0,
      aboard: [],
      xp: { sail: 0, attack: 0, manage: 0 },
      weapons: [],
      recipes: ['raft'],
      target: null,
      twoStep: true,
    },
    walk: { island: 'home', x: 0, y: 0, facing: 'down', moved: 0 },
    guide: { step: 0, vitalsSeen: false },
    intros: [],
    forage: {},
    forageSeq: 1,
    mods: modIds(),
    villages,
    flags: {
      farm: new Array(BALANCE.home.farm.plots).fill(null),
      firstTraining: false,
      waterDispute: null,
      partsInstalled: [],
      planeRepaired: false,
      flightDone: false,
      reported: false,
      whisperIndex: 0,
    },
    hints: {},
    pendingCrate: null,
    clueIndex: 0,
    log: [],
    transport: { rafts: 0, routes: [], nextNo: 1 },
    bureau: {
      trade: 0,
      totalTrade: 0,
      exported: {},
      order: null,
      nextOrderAt: 0,
      ordersDone: 0,
      upgrades: { speed: 0, storage: 0, output: 0 },
    },
    stats: { produced: {}, transported: 0, deaths: 0, moves: 0, fights: 0, wins: 0 },
    cutscene: null,
    nextPersonNo: no,
  };
  const L = layout('home', seed);
  state.walk.x = L.spawn[0];
  state.walk.y = L.spawn[1];
  initForage(state);
  lightFrom(state, home);
  look(state);
  for (let i = 0; i < OPENING_LINES; i++) say(state, 'opening.' + i);
  checkReveals(state);
  updateUnlocks(state);
  return state;
}

export function newNative(no: number, islandId: string, active: boolean): Person {
  return {
    id: 'n' + no,
    name: m('native.name', { base: m('native.' + ((no - 1) % NATIVE_NAME_COUNT)), gen: no > NATIVE_NAME_COUNT ? String(Math.ceil(no / NATIVE_NAME_COUNT)) : '' }),
    type: 'native',
    role: null,
    job: null,
    loc: { kind: 'island', id: islandId },
    lastIsland: islandId,
    recipes: [],
    xp: 0,
    active,
    learning: null,
  };
}

export function spawnNative(state: GameState, islandId: string): Person {
  const p = newNative(state.nextPersonNo++, islandId, true);
  state.people.push(p);
  return p;
}
