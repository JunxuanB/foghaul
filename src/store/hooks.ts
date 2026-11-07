import { createContext, useContext, useSyncExternalStore } from 'react';
import type { GameStore } from './GameStore';
import type { GameState } from '../sim/types';
import type { ViewState, ViewStore } from './view';

export const StoreContext = createContext<GameStore | null>(null);
export const ViewContext = createContext<ViewStore | null>(null);

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

export function useViewStore(): ViewStore {
  const v = useContext(ViewContext);
  if (!v) throw new Error('no view');
  return v;
}

/** 订阅界面临时状态 */
export function useView(): ViewState {
  const v = useViewStore();
  useSyncExternalStore(v.subscribe, v.getVersion);
  return v.s;
}
