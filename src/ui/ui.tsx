import { createContext, useContext } from 'react';

export type DialogKind = 'people' | 'islands' | 'routes' | 'journal' | 'settings' | null;

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
}

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const u = useContext(UiContext);
  if (!u) throw new Error('no ui');
  return u;
}
