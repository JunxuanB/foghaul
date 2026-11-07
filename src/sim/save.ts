import { BALANCE } from '../config/balance';
import type { GameState } from './types';
import { initForage } from './forage';

/** 2D 版从 1 重新开始，不读文字版存档。v2：树和草药改成可刷新的采集点。v3：木筏在海面上的位置、最近一次战斗。v4：每座岛都有树和草药。v5：设施暂存箱、昨日收成（仓库改成格子，旧档多出来的东西保留，只是放不进新的） */
export const SAVE_VERSION = 5;

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** 解析存档；版本不兼容或损坏时返回 null */
export function deserialize(text: string): GameState | null {
  try {
    const s = JSON.parse(text) as GameState;
    if (!s || typeof s !== 'object' || !Array.isArray(s.islands)) return null;
    return migrate(s);
  } catch {
    return null;
  }
}

function migrate(s: GameState): GameState | null {
  if (!s.walk) return null;
  // v1 → v2：草药从一个总数改成散在岛上的草药丛，树也改成每天刷新
  if (s.version === 1) {
    delete (s.flags as { herbsLeft?: number }).herbsLeft;
    s.forage = {};
    s.forageSeq = 1;
    initForage(s);
    s.version = 2;
  }
  // 早期的 v2 存档没有 MOD 列表
  if (!Array.isArray(s.mods)) s.mods = [];
  // v2 → v3：木筏放在玩家所在格子的中心
  if (s.version === 2) {
    const T = BALANCE.sail.tile;
    s.raft = { x: s.player.x * T + T / 2, y: s.player.y * T + T / 2 };
    s.lastFight = null;
    s.version = 3;
  }
  // v3 → v4：其他岛也长出树和草药（已经有的岛不重复长）
  if (s.version === 3) {
    initForage(s);
    s.version = 4;
  }
  // v4 → v5：每座岛多一个设施暂存箱；记录今天的收成
  if (s.version === 4) {
    for (const isl of s.islands) isl.output = {};
    s.today = {};
    s.report = null;
    s.version = 5;
  }
  if (s.version === SAVE_VERSION) return s;
  return null;
}

export function saveToStorage(state: GameState, storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(BALANCE.save.key, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(storage: Storage | undefined = globalThis.localStorage): GameState | null {
  try {
    const t = storage?.getItem(BALANCE.save.key);
    return t ? deserialize(t) : null;
  } catch {
    return null;
  }
}

export function clearStorage(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(BALANCE.save.key);
  } catch {
    /* ignore */
  }
}
