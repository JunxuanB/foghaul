import { createContext, useContext } from 'react';
import type { Lang } from '../i18n';

/** 外壳级操作：语言、回到欢迎页、重新开始 */
export interface Ui {
  lang: Lang;
  setLang: (l: Lang) => void;
  toWelcome: () => void;
  restart: () => void;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const u = useContext(UiContext);
  if (!u) throw new Error('no ui');
  return u;
}
