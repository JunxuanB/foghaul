// Phaser 入口：原生 480 × 270，只按整数倍放大（窗口比 480 还窄时才缩小）。
import Phaser from 'phaser';
import { PALETTE, VIEW } from '../config/visual';
import { PalettePipeline } from './render/PalettePipeline';
import { BootScene } from './scenes/BootScene';
import { IslandScene } from './scenes/IslandScene';
import { CTX_KEY, type GameCtx } from './context';
import { installKeys } from './input/keys';

/**
 * 窗口能放下的最大整数倍；放不下 2 倍的小屏幕（手机）按比例铺满，保证字看得清。
 * 画布按屏幕分辨率（480k × 270k）渲染，镜头放大 k 倍：像素块大小不变，但人物和镜头可以移动不到一像素，走路顺滑。
 */
export function fitZoom(w: number, h: number): number {
  const k = Math.min(w / VIEW.w, h / VIEW.h);
  return k >= 2 ? Math.floor(k) : k;
}

export function startGame(parent: HTMLElement, frame: HTMLElement, ctx: GameCtx): Phaser.Game {
  installKeys();
  const k = fitZoom(frame.clientWidth, frame.clientHeight);
  ctx.view.set({ k });
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: Math.round(VIEW.w * k),
    height: Math.round(VIEW.h * k),
    backgroundColor: PALETTE[0],
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    banner: false,
    scale: { mode: Phaser.Scale.NONE },
    input: { keyboard: false },
    pipeline: { palette: PalettePipeline } as unknown as Phaser.Types.Core.PipelineConfig,
    callbacks: {
      preBoot: (g) => g.registry.set(CTX_KEY, ctx),
    },
    scene: [BootScene, IslandScene],
  });
  const onResize = () => {
    const z = fitZoom(frame.clientWidth, frame.clientHeight);
    game.scale.resize(Math.round(VIEW.w * z), Math.round(VIEW.h * z));
    ctx.view.set({ k: z });
  };
  window.addEventListener('resize', onResize);
  game.events.once(Phaser.Core.Events.DESTROY, () => window.removeEventListener('resize', onResize));
  return game;
}
