// 岛上场景和海上场景共用的部分：镜头（对齐屏幕像素）、特效画布（按世界坐标摆放）、
// 灯光遮罩（每帧按镜头画）、换色着色器、点阵过渡、昼夜、全局按键、切换场景、引导的边缘箭头。
// 两个场景用同一套办法做这些事，不各写一套（见 docs/2d-tech.md）。
import Phaser from 'phaser';
import { phaseAt, type PhaseMix } from '../../art/palette';
import { ANIM, LIGHTS, VIEW } from '../../config/visual';
import { minuteOfDay } from '../../sim/clock';
import type { GameState } from '../../sim/types';
import { PAUSING_PANELS } from '../../store/view';
import { CTX_KEY, type GameCtx } from '../context';
import { onAction, type Action } from '../input/keys';
import { paintMask, type Beam, type Spot } from '../render/mask';
import { PalettePipeline } from '../render/PalettePipeline';

export type Img = Phaser.GameObjects.Image;
export interface FxLayer {
  tex: Phaser.Textures.CanvasTexture;
  img: Img;
}

/** 特效画布比画面每边大出的像素：两次重画之间镜头移动时边上不露空 */
export const FX_PAD = 16;

export abstract class WorldScene extends Phaser.Scene {
  protected ctx!: GameCtx;
  protected pipe: PalettePipeline | null = null;
  protected mask!: Phaser.Textures.CanvasTexture;
  protected maskImg!: ImageData;
  /** 场景开始后的秒数 */
  protected t = 0;
  protected fxAcc = 1;
  /** 点阵过渡：t 从 0 到 1 变黑（到 1 时执行 mid），从 1 到 2 亮起 */
  protected fade: { t: number; mid: (() => void) | null } | null = null;
  private deaths = 0;
  private off: (() => void) | null = null;
  /** 镜头左上角在世界里的位置（游戏像素，对齐到 1/k） */
  protected camX = 0;
  protected camY = 0;
  /** 灯光的位置（世界坐标，已乘灯光强度），每次画特效时更新 */
  protected spots: Spot[] = [];
  protected beams: Beam[] = [];
  protected phase: PhaseMix = phaseAt(12 * 60);
  protected guideArrow!: Img;

  protected get state(): GameState {
    return this.ctx.store.state;
  }

  /** 子类在 create() 开头调用 */
  protected setupWorld(): void {
    this.ctx = this.registry.get(CTX_KEY) as GameCtx;
    this.t = 0;
    this.fxAcc = 1;
    this.spots = [];
    this.beams = [];
    this.deaths = this.state.stats.deaths;
    // 进场景时从黑亮起
    this.fade = { t: 1, mid: null };
    this.mask = this.textures.exists('fx_mask') ? (this.textures.get('fx_mask') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('fx_mask', VIEW.w + 1, VIEW.h + 1)!;
    this.maskImg = this.mask.context.createImageData(VIEW.w + 1, VIEW.h + 1);
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setPostPipeline(PalettePipeline);
    const p = cam.getPostPipeline(PalettePipeline);
    this.pipe = (Array.isArray(p) ? p[0] : p) as PalettePipeline;
    this.pipe.mask = this.mask;
    this.pipe.fade = 1;
    this.guideArrow = this.add.image(0, 0, 'ui_arrow').setOrigin(0.5, 1).setDepth(55000).setVisible(false);
    // 换场景时清掉上一个场景的临时界面（介绍卡、按键提示、选中、动作、岛名）
    this.ctx.view.set({ intro: null, prompts: [], focus: null, action: null, labels: [] });
    this.ctx.view.s.anchors.edge = null;
    this.off = onAction((a) => this.onAction(a));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.off?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.off?.());
  }

  /** 子类在 create() 末尾调用：所有纹理按最近邻采样（像素画放大、移动时不糊） */
  protected finishSetup(): void {
    for (const key of this.textures.getTextureKeys()) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /** 特效层：比画面大一圈的画布，按世界坐标摆放（见 drawFx 的说明） */
  protected fxCanvas(key: string, depth: number): FxLayer {
    const P = FX_PAD;
    const tex = this.textures.exists(key) ? (this.textures.get(key) as Phaser.Textures.CanvasTexture) : this.textures.createCanvas(key, VIEW.w + P * 2, VIEW.h + P * 2)!;
    const img = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(depth);
    return { tex, img };
  }

  /** 特效画布这次重画的原点（世界坐标）：镜头左上角取整再往外 FX_PAD */
  protected fxOrigin(): [number, number] {
    return [Math.floor(this.camX) - FX_PAD, Math.floor(this.camY) - FX_PAD];
  }

  // ---------------------------------------------------------------- 按键

  protected abstract onAction(a: Action): void;

  /** 全局面板键（两个场景一样）。处理了返回 true */
  protected panelAction(a: Action): boolean {
    const v = this.ctx.view;
    const panel = v.s.panel;
    if (a === 'close') {
      v.set({ panel: panel ? null : 'menu' });
      return true;
    }
    const toggle = (id: 'inventory' | 'journal' | 'help' | 'map') => v.set({ panel: panel === id ? null : id });
    if (a === 'inventory') return toggle('inventory'), true;
    if (a === 'journal') return toggle('journal'), true;
    if (a === 'help') return toggle('help'), true;
    if (a === 'map') {
      if (this.state.unlocks.includes('map')) toggle('map');
      return true;
    }
    if (a.startsWith('slot') && !panel) {
      v.set({ hotbar: Number(a.slice(4)) - 1 });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- 每帧（子类的 update 先调这个）

  /**
   * 推进时间、点阵过渡、死亡、昼夜。返回 false 表示这一帧要切换场景（子类直接 return）。
   */
  protected tickWorld(delta: number): boolean {
    const dt = Math.min(delta, 100) / 1000;
    this.t += dt;
    const { store, view } = this.ctx;
    store.hold('panel', !!view.s.panel && PAUSING_PANELS.includes(view.s.panel));
    store.frame(delta);
    this.stepFade(dt);
    const s = this.state;
    if (s.stats.deaths !== this.deaths) {
      this.deaths = s.stats.deaths;
      this.onDied();
    }
    if (this.switchIfNeeded()) return false;
    const minute = view.s.debugMinute ?? minuteOfDay(s.time);
    this.phase = phaseAt(minute);
    if (this.pipe) this.pipe.mix = this.phase;
    return true;
  }

  /** 死了：子类可以取消正在做的动作 */
  protected onDied(): void {}

  /** 这个场景对应的“人在哪”：岛上场景是岛 id，海上场景是 null */
  protected abstract where(): string | null;

  /** 人不在这个场景该在的地方了（靠岸、出海、死后在床边醒来）：换场景 */
  private switchIfNeeded(): boolean {
    const at = this.state.player.at;
    if (at === this.where()) return false;
    this.scene.start(at ? 'island' : 'sea');
    return true;
  }

  protected fadeThrough(mid: () => void): void {
    if (this.fade && this.fade.t < 1) return;
    this.fade = { t: 0, mid };
  }

  private stepFade(dt: number): void {
    const f = this.fade;
    if (!f) return;
    f.t += dt / ANIM.fadeSeconds;
    if (f.t >= 1 && f.mid) {
      const mid = f.mid;
      f.mid = null;
      f.t = 1;
      mid();
    }
    if (f.t >= 2) this.fade = null;
    if (this.pipe) this.pipe.fade = this.fade ? (this.fade.t < 1 ? this.fade.t : 2 - this.fade.t) : 0;
  }

  /** 正在过渡（黑屏）时不能动 */
  protected get fading(): boolean {
    return !!this.fade && this.fade.t < 1.3;
  }

  // ---------------------------------------------------------------- 镜头

  /** 镜头跟着 (x, y)，在地图边缘停住；位置对齐到屏幕像素（1/k 游戏像素） */
  protected placeCameraOn(x: number, y: number, mapW: number, mapH: number): void {
    const cam = this.cameras.main;
    const k = this.ctx.view.s.k;
    if (cam.zoom !== k) cam.setZoom(k);
    if (this.pipe) this.pipe.scale = k;
    const cx = Math.max(0, Math.min(mapW - VIEW.w, x - VIEW.w / 2));
    const cy = Math.max(0, Math.min(mapH - VIEW.h, y - VIEW.h / 2));
    this.camX = Math.round(cx * k) / k;
    this.camY = Math.round(cy * k) / k;
    cam.centerOn(this.camX + VIEW.w / 2, this.camY + VIEW.h / 2);
  }

  /** 世界坐标对齐到屏幕像素：镜头左上角 + 整数个屏幕像素（会动的精灵都用它） */
  protected snap(v: number, cam: number): number {
    const k = this.ctx.view.s.k;
    return cam + Math.round((v - cam) * k) / k;
  }

  // ---------------------------------------------------------------- 灯光

  /** 灯光遮罩和屏幕对齐（着色器按屏幕坐标读），每帧按当前镜头重画 */
  protected paintLights(): void {
    const strength = this.phase.s;
    const useMask = strength > LIGHTS.maskFrom;
    if (this.pipe) this.pipe.useMask = useMask;
    if (!useMask) return;
    const cx = Math.floor(this.camX);
    const cy = Math.floor(this.camY);
    if (this.pipe) this.pipe.maskOff = [this.camX - cx, this.camY - cy];
    paintMask(
      this.maskImg,
      this.spots.map(([x, y, r]) => [x - cx, y - cy, r]),
      this.beams.map(([x, y, l, a, hw]) => [x - cx, y - cy, l, a, hw]),
    );
    this.mask.context.putImageData(this.maskImg, 0, 0);
    this.mask.refresh();
  }

  // ---------------------------------------------------------------- 引导

  /**
   * 引导目标：在画面里时头顶一个上下跳动的箭头；不在画面里时屏幕边缘一个指向它的小箭头和格数。
   * (fromX, fromY) 是人（或木筏）的位置，用来算距离。tx 为 null 时都隐藏。
   */
  protected pointAt(tx: number | null, ty: number, fromX: number, fromY: number): void {
    const v = this.ctx.view;
    if (tx === null) {
      this.guideArrow.setVisible(false);
      v.s.anchors.edge = null;
      return;
    }
    const bob = Math.round(Math.sin(this.t * 5) * 1.5);
    const sx = tx - this.camX;
    const sy = ty - this.camY;
    const inView = sx > 8 && sx < VIEW.w - 8 && sy > 10 && sy < VIEW.h - 4;
    this.guideArrow.setVisible(inView).setPosition(Math.round(tx), Math.round(ty) + bob);
    if (inView) v.s.anchors.edge = null;
    else {
      const cx = VIEW.w / 2;
      const cy = VIEW.h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((cx - 14) / Math.abs(Math.cos(ang) || 1e-6), (cy - 14) / Math.abs(Math.sin(ang) || 1e-6));
      const dist = Math.round(Math.hypot(tx - fromX, ty - fromY) / 16);
      v.s.anchors.edge = { x: cx + Math.cos(ang) * k, y: cy + Math.sin(ang) * k, angle: ang, dist };
    }
  }

  /** 界面上要高亮的元素（引导的状态条那一步） */
  protected setUiTarget(id: string | null): void {
    const v = this.ctx.view;
    if (v.s.anchors.uiTarget === id) return;
    v.s.anchors.uiTarget = id;
    v.set({});
  }
}
