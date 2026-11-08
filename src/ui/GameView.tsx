// 游戏画面：Phaser 画布 + 叠在上面的 DOM 界面层，两者按同一个整数倍 k 放大。
import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { useStore, useView, useViewStore } from '../store/hooks';
import { Hud } from './hud/Hud';
import { WorldLayer } from './hud/WorldLayer';
import { PanelHost } from './panels/Panels';
import { RecipePopup } from './popups/RecipePopup';
import { ReportPopup } from './popups/ReportPopup';
import { JoinedPopup } from './popups/JoinedPopup';
import { DeathPopup } from './popups/DeathPopup';
import { DevPanel } from './DevPanel';

const SHOW_DEV = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

export function GameView() {
  const store = useStore();
  const vs = useViewStore();
  const v = useView();
  const outer = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | null = null;
    let dead = false;
    // Phaser 很大，单独加载
    import('../game').then(({ startGame }) => {
      if (dead || !host.current || !outer.current) return;
      game = startGame(host.current, outer.current, { store, view: vs });
      (window as unknown as { foghaulGame: Phaser.Game }).foghaulGame = game;
    });
    return () => {
      dead = true;
      game?.destroy(true);
    };
  }, [store, vs]);
  const k = v.k;
  return (
    <div className="stage-wrap" ref={outer}>
      <div className="stage" style={{ width: v.vw * k, height: v.vh * k, ['--k' as string]: k, ['--vw' as string]: v.vw, ['--vh' as string]: v.vh, ['--pw' as string]: BALANCE.ui.panel.w, ['--ph' as string]: BALANCE.ui.panel.h }}>
        <div className="canvas-host" ref={host} />
        <Hud />
        <div className="hud">
          <WorldLayer />
        </div>
        <PanelHost />
        <JoinedPopup />
        <RecipePopup />
        <DeathPopup />
        <ReportPopup />
      </div>
      {SHOW_DEV && <DevPanel />}
    </div>
  );
}
