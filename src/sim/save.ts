import { BALANCE } from '../config/balance';
import type { GameState } from './types';

export const SAVE_VERSION = 1;

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
  if (s.version === SAVE_VERSION) return s;
  // 以后的版本迁移写在这里
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
