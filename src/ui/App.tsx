import { useEffect, useMemo, useRef, useState } from 'react';
import { getLang, setLang as setI18nLang, type Lang } from '../i18n';
import { useGame, useStore } from '../store/hooks';
import { Cutscene } from './components/Cutscene';
import { Coach } from './components/Coach';
import { RecipePopup } from './components/RecipePopup';
import { DevPanel } from './components/DevPanel';
import { Header } from './components/Header';
import { IslandsDialog } from './dialogs/IslandsDialog';
import { JournalDialog } from './dialogs/JournalDialog';
import { PeopleDialog } from './dialogs/PeopleDialog';
import { RoutesDialog } from './dialogs/RoutesDialog';
import { SettingsDialog } from './dialogs/SettingsDialog';
import { HelpDialog } from './dialogs/HelpDialog';
import { Welcome } from './screens/Welcome';
import { Intro } from './screens/Intro';
import { IslandScene } from './scenes/IslandScene';
import { SeaScene } from './scenes/SeaScene';
import { UiContext, type DialogKind, type SideTab, type Ui } from './ui';
import { BALANCE } from '../config/balance';

const THEME_KEY = 'foghaul.theme';

function initialTheme(): 'dark' | 'light' {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* ignore */
  }
  return 'dark';
}

const SHOW_DEV = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

export function App() {
  const g = useGame();
  const store = useStore();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogArg, setDialogArg] = useState<string | null>(null);
  const [zoom, setZoomState] = useState(() => (window.matchMedia('(max-width: 760px)').matches ? 0 : BALANCE.map.defaultZoom));
  const [screen, setScreen] = useState<'welcome' | 'intro' | 'game'>('welcome');
  const [theme, setThemeState] = useState(initialTheme);
  const [lang, setLangState] = useState<Lang>(getLang());
  const startedFresh = useRef(false);
  const [sideTab, setSideTab] = useState<SideTab>('items');

  const ui: Ui = useMemo(
    () => ({
      dialog,
      dialogArg,
      open: (d, arg = null) => {
        setDialog(d);
        setDialogArg(arg);
      },
      close: () => setDialog(null),
      zoom,
      setZoom: (z) => setZoomState(Math.max(0, Math.min(BALANCE.map.zooms.length - 1, z))),
      theme,
      setTheme: (t) => {
        setThemeState(t);
        try {
          localStorage.setItem(THEME_KEY, t);
        } catch {
          /* ignore */
        }
      },
      lang,
      sideTab,
      setSideTab,
      restart: () => {
        store.newGame();
        startedFresh.current = true;
        setDialog(null);
        setScreen('intro');
      },
      setLang: (l) => {
        setI18nLang(l);
        setLangState(l);
      },
    }),
    [dialog, dialogArg, zoom, theme, lang, store, sideTab],
  );

  // 欢迎页和剧情介绍时暂停时间
  useEffect(() => {
    store.hold('screen', screen !== 'game');
  }, [screen, store]);

  useEffect(() => {
    setI18nLang(lang, false);
    document.body.style.background = theme === 'dark' ? '#0B1316' : '#F7F9F8';
  }, [lang, theme]);

  // 键盘：方向键 / WASD 移动，+/- 缩放，回车靠岸/出海，空格暂停
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || store.state.cutscene || screen !== 'game') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const dirs: Record<string, [number, number]> = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
      };
      const d = dirs[e.key];
      if (d && !store.state.player.at) {
        e.preventDefault();
        store.dispatch({ t: 'move', dx: d[0], dy: d[1] });
      } else if (e.key === '+' || e.key === '=') ui.setZoom(zoom - 1);
      else if (e.key === '-' || e.key === '_') ui.setZoom(zoom + 1);
      else if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        if (store.state.player.at) store.dispatch({ t: 'leave' });
        else store.dispatch({ t: 'dock' });
      } else if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        e.preventDefault();
        store.setPaused(!store.paused);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, zoom, store, ui, screen]);

  return (
    <UiContext.Provider value={ui}>
      <div className={'app t-' + theme} key={lang}>
        {screen === 'welcome' && (
          <Welcome
            canContinue={store.hadSave && !startedFresh.current}
            onContinue={() => setScreen('game')}
            onNew={() => {
              store.newGame();
              startedFresh.current = true;
              setScreen('intro');
            }}
          />
        )}
        {screen === 'intro' && <Intro onDone={() => setScreen('game')} />}
        {screen === 'game' && (
        <>
        <div className="wrap">
          <Header />
          {g.player.at ? <IslandScene /> : <SeaScene />}
        </div>
        {dialog === 'people' && <PeopleDialog />}
        {dialog === 'islands' && <IslandsDialog />}
        {dialog === 'routes' && <RoutesDialog />}
        {dialog === 'journal' && <JournalDialog />}
        {dialog === 'settings' && <SettingsDialog />}
        {dialog === 'help' && <HelpDialog />}
        <Cutscene />
        <RecipePopup />
        <Coach />
        {SHOW_DEV && <DevPanel />}
        </>
        )}
      </div>
    </UiContext.Provider>
  );
}
