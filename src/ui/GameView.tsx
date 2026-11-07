// 游戏画面：Phaser 画布 + 叠在上面的 DOM 界面层，两者按同一个整数倍 k 放大。
import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { VIEW } from '../config/visual';
import { useStore, useView, useViewStore } from '../store/hooks';
import { Hud } from './hud/Hud';
import { WorldLayer } from './hud/WorldLayer';
import { PanelHost } from './panels/Panels';
import { RecipePopup } from './popups/RecipePopup';
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
      <div className="stage" style={{ width: VIEW.w * k, height: VIEW.h * k, ['--k' as string]: k }}>
        <div className="canvas-host" ref={host} />
        <Hud />
        <div className="hud">
          <WorldLayer />
        </div>
        <PanelHost />
        <RecipePopup />
      </div>
      {SHOW_DEV && <DevPanel />}
    </div>
  );
}
