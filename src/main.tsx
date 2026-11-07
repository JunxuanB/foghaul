import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fusion-pixel-12px-proportional-sc';
import { GameStore } from './store/GameStore';
import { StoreContext, ViewContext } from './store/hooks';
import { ViewStore } from './store/view';
import { App } from './ui/App';
import './ui/styles/global.css';

const store = new GameStore();
const view = new ViewStore();
store.start();
(window as unknown as { foghaul: GameStore; foghaulView: ViewStore }).foghaul = store;
(window as unknown as { foghaulView: ViewStore }).foghaulView = view;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <ViewContext.Provider value={view}>
        <App />
      </ViewContext.Provider>
    </StoreContext.Provider>
  </StrictMode>,
);
