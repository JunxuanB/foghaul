import type { GameStore } from '../store/GameStore';
import type { ViewStore } from '../store/view';

/** 画面层拿到的两样东西：规则状态和界面临时状态 */
export interface GameCtx {
  store: GameStore;
  view: ViewStore;
}

export const CTX_KEY = 'ctx';
