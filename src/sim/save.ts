import { BALANCE } from '../config/balance';
import type { GameState } from './types';

export const SAVE_VERSION = 4;

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
  // v3 → v4：新增新配方弹窗队列
  if (s.version === 3) {
    s.recipePopup = [];
    s.version = 4;
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

/** 读过的旧存档键（格式兼容时可以迁移） */
const OLD_KEYS = ['foghaul.save.v3'];

export function loadFromStorage(storage: Storage | undefined = globalThis.localStorage): GameState | null {
  try {
    const t = storage?.getItem(BALANCE.save.key) ?? OLD_KEYS.map((k) => storage?.getItem(k)).find(Boolean);
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
