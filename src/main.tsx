import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameStore } from './store/GameStore';
import { StoreContext } from './store/hooks';
import { App } from './ui/App';
import './ui/styles/global.css';

const store = new GameStore();
store.start();
(window as unknown as { foghaul: GameStore }).foghaul = store;
if (import.meta.env.DEV) {
  // 调试：在控制台里用 foghaulDev.preset('M3 first route') 跳到里程碑
  import('./sim/presets').then(({ applyPreset, PRESETS }) => {
    (window as unknown as { foghaulDev: unknown }).foghaulDev = {
      presets: PRESETS.map((p) => p.id),
      preset: (id: string) => store.replace(applyPreset(id, store.state.seed)),
    };
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <App />
    </StoreContext.Provider>
  </StrictMode>,
);
