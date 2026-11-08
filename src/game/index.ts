// Phaser 入口：画面逻辑大小按窗口算（约 400 宽），整数倍放大铺满窗口。
import Phaser from 'phaser';
import { PALETTE, VIEW, VIEW_FIT } from '../config/visual';
import { PalettePipeline } from './render/PalettePipeline';
import { BootScene } from './scenes/BootScene';
import { IslandScene } from './scenes/IslandScene';
import { SeaScene } from './scenes/SeaScene';
import { CTX_KEY, type GameCtx } from './context';
import { installKeys } from './input/keys';

/**
 * 按窗口算放大倍数 k 和画面的逻辑大小：一屏大约 VIEW_FIT.target 宽（游戏整体放大），k 取整数，
 * 逻辑大小跟着窗口比例变，铺满窗口、不留黑边。窗口太小放不下面板时才用小数倍。
 * 画布按屏幕分辨率（w·k × h·k）渲染，镜头放大 k 倍：像素块大小不变，人物和镜头可以移动不到一像素，走路顺滑。
 */
export function fitView(W: number, H: number): { k: number; w: number; h: number } {
  const T = VIEW_FIT;
  let k = Math.max(1, Math.round(Math.min(W / T.targetW, H / T.targetH)));
  while (k > 1 && (W / k < T.minW || H / k < T.minH)) k--;
  if (W / k < T.minW || H / k < T.minH) k = Math.min(W / T.minW, H / T.minH);
  const w = Math.max(T.minW, Math.min(T.maxW, Math.floor(W / k)));
  const h = Math.max(T.minH, Math.min(T.maxH, Math.floor(H / k)));
  return { k, w, h };
}

function applyView(frame: HTMLElement, ctx: GameCtx): { k: number; changed: boolean } {
  const f = fitView(frame.clientWidth, frame.clientHeight);
  const changed = f.w !== VIEW.w || f.h !== VIEW.h;
  VIEW.w = f.w;
  VIEW.h = f.h;
  ctx.view.set({ k: f.k, vw: f.w, vh: f.h });
  return { k: f.k, changed };
}

export function startGame(parent: HTMLElement, frame: HTMLElement, ctx: GameCtx): Phaser.Game {
  installKeys();
  const { k } = applyView(frame, ctx);
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
    scene: [BootScene, IslandScene, SeaScene],
  });
  const onResize = () => {
    const { k: z, changed } = applyView(frame, ctx);
    game.scale.resize(Math.round(VIEW.w * z), Math.round(VIEW.h * z));
    // 逻辑大小变了：特效画布、灯光遮罩都按画面大小建的，重开当前场景
    if (changed) for (const key of ['island', 'sea']) if (game.scene.isActive(key)) game.scene.getScene(key).scene.restart();
  };
  window.addEventListener('resize', onResize);
  game.events.once(Phaser.Core.Events.DESTROY, () => window.removeEventListener('resize', onResize));
  return game;
}
