import { createContext, useContext } from 'react';

export type SideTab = 'items' | 'craft' | 'log' | 'isle';

export type DialogKind = 'people' | 'islands' | 'routes' | 'journal' | 'settings' | 'help' | null;

export interface Ui {
  dialog: DialogKind;
  dialogArg: string | null;
  open: (d: DialogKind, arg?: string | null) => void;
  close: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  lang: 'zh' | 'en';
  setLang: (l: 'zh' | 'en') => void;
  /** 侧栏 / 手机底部标签：物品、制作、日志、岛上 */
  sideTab: SideTab;
  setSideTab: (t: SideTab) => void;
  /** 新游戏：清档并播放开场剧情 */
  restart: () => void;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const u = useContext(UiContext);
  if (!u) throw new Error('no ui');
  return u;
}
