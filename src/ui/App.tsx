import { useMemo, useState } from 'react';
import { getLang, setLang as setI18nLang, type Lang } from '../i18n';
import { useStore } from '../store/hooks';
import { GameView } from './GameView';
import { Intro } from './screens/Intro';
import { Welcome } from './screens/Welcome';
import { UiContext, type Ui } from './ui';

export function App() {
  const store = useStore();
  const [screen, setScreen] = useState<'welcome' | 'intro' | 'game'>('welcome');
  const [lang, setLangState] = useState<Lang>(getLang());
  const [hasSave, setHasSave] = useState(store.hadSave);

  const ui: Ui = useMemo(
    () => ({
      lang,
      setLang: (l) => {
        setI18nLang(l);
        setLangState(l);
      },
      toWelcome: () => {
        setHasSave(true);
        setScreen('welcome');
      },
      restart: () => {
        store.newGame();
        setScreen('intro');
      },
    }),
    [lang, store],
  );

  return (
    <UiContext.Provider value={ui}>
      <div key={lang} style={{ display: 'contents' }}>
        {screen === 'welcome' && (
          <Welcome
            canContinue={hasSave}
            onContinue={() => setScreen('game')}
            onNew={() => {
              store.newGame();
              setScreen('intro');
            }}
          />
        )}
        {screen === 'intro' && <Intro onDone={() => setScreen('game')} />}
        {screen === 'game' && <GameView />}
      </div>
    </UiContext.Provider>
  );
}
