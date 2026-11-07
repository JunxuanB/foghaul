// Phaser 入口：原生 480 × 270，只按整数倍放大（窗口比 480 还窄时才缩小）。
import Phaser from 'phaser';
import { PALETTE, VIEW } from '../config/visual';
import { PalettePipeline } from './render/PalettePipeline';
import { BootScene } from './scenes/BootScene';
import { IslandScene } from './scenes/IslandScene';
import { CTX_KEY, type GameCtx } from './context';
import { installKeys } from './input/keys';

/** 窗口能放下的最大整数倍；不到 1 倍时按比例缩小 */
export function fitZoom(w: number, h: number): number {
  const k = Math.min(w / VIEW.w, h / VIEW.h);
  return k >= 1 ? Math.floor(k) : k;
}

export function startGame(parent: HTMLElement, frame: HTMLElement, ctx: GameCtx): Phaser.Game {
  installKeys();
  const k = fitZoom(frame.clientWidth, frame.clientHeight);
  ctx.view.set({ k });
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: VIEW.w,
    height: VIEW.h,
    backgroundColor: PALETTE[0],
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    banner: false,
    scale: { mode: Phaser.Scale.NONE, zoom: k },
    input: { keyboard: false },
    pipeline: { palette: PalettePipeline } as unknown as Phaser.Types.Core.PipelineConfig,
    callbacks: {
      preBoot: (g) => g.registry.set(CTX_KEY, ctx),
    },
    scene: [BootScene, IslandScene],
  });
  const onResize = () => {
    const z = fitZoom(frame.clientWidth, frame.clientHeight);
    game.scale.setZoom(z);
    ctx.view.set({ k: z });
  };
  window.addEventListener('resize', onResize);
  game.events.once(Phaser.Core.Events.DESTROY, () => window.removeEventListener('resize', onResize));
  return game;
}
