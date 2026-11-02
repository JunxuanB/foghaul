import { createContext, useContext, useSyncExternalStore } from 'react';
import type { GameStore } from './GameStore';
import type { GameState } from '../sim/types';

export const StoreContext = createContext<GameStore | null>(null);

export function useStore(): GameStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('no store');
  return s;
}

/** 订阅游戏状态（每次变化都会重渲染） */
export function useGame(): GameState {
  const store = useStore();
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.state;
}
