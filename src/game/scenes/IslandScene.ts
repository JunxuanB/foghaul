// 岛上场景：人物走动、碰撞、选中面前的东西、按 E 互动、采集动画、岛上的特效。
// 镜头、特效画布、灯光、过渡、昼夜、切场景在 WorldScene 里（和海上场景共用）。
// 规则全部走 store.dispatch；这里只负责“看见什么、按了什么”。
import Phaser from 'phaser';
import { allSprites, mkCanvas, px } from '../../art/draw';
import { hash } from '../../art/noise';
import { DAY, type Pal } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER, ITEMS, type ItemId } from '../../config/items';
import { ANIM, LIGHTS, VIEW, WORK_ICON } from '../../config/visual';
import { pointerStep } from '../../sim/guide';
import { carried, slotView } from '../../sim/inventory';
import { charOf, interactInfo, objectsOn, personOfObj } from '../../sim/interact';
import type { Command, Facing, GameState } from '../../sim/types';
import { island } from '../../sim/util';
import { islandRate } from '../../sim/economy';
import { hasKey } from '../../i18n';

/** 初见介绍按什么分：精灵有自己的介绍（设施地基）就按精灵，否则按种类 */
const introKind = (o: WorldObj): string => (o.sprite !== o.kind && hasKey('intro2d.' + o.sprite) ? o.sprite : o.kind);
import type { Prompt } from '../../store/view';
import { canStand, FEET, layout, raster, rectDist, type Layout, type Raster, type Rect, type WorldObj } from '../../world/island';
import { moveDir, type Action } from '../input/keys';
import { paintFog } from '../render/fog';
import type { Beam, Spot } from '../render/mask';
import { FX_PAD, WorldScene, type FxLayer, type Img } from './WorldScene';
import { paintTerrain, waterFx } from '../world/terrain';
import { Particles } from '../world/particles';
import { fencePieces } from '../world/fence';

const DIR_OF: Record<Facing, 'down' | 'up' | 'side'> = { down: 'down', up: 'up', left: 'side', right: 'side' };
const FACE_VEC: Record<Facing, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

/** 采集类动作：物体种类 → 命令 */
function gatherCmd(state: GameState, o: WorldObj): Command | null {
  const lumber = state.people.some((p) => p.role === 'lumberjack' && p.active);
  if (o.kind === 'tree') return { t: 'gather', what: lumber ? 'chop' : 'branch' };
  if (o.kind === 'shoal') return { t: 'gather', what: 'shoreFish' };
  if (o.kind === 'herb') return { t: 'gather', what: 'herb' };
  return null;
}

/** 玩家身上和主岛仓库里各物品的总数（用来算“+1”） */
function totals(state: GameState): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  const home = island(state, 'home');
  for (const id of ITEM_ORDER) out[id] = carried(state, id) + (home.stock[id] ?? 0);
  return out;
}

export class IslandScene extends WorldScene {
  private L!: Layout;
  private R!: Raster;
  private isl = 'home';
  private player!: Img;
  private objImgs = new Map<string, Img>();
  private aboardImgs: Img[] = [];
  private aboardKey = '';
  /** 这一帧岛上的全部物体（固定的 + 今天的树和草药），以及会挡路的采集点底座 */
  private objs: WorldObj[] = [];
  private blockers: Rect[] = [];
  /** 篝火的火苗和亮着的窗：跟着物体按底边排序（不画在最上层，免得盖住站在前面的人物） */
  private flames = new Map<string, { tex: Phaser.Textures.CanvasTexture; img: Img }>();
  private glows = new Map<string, Img>();
  private hl!: Img;
  private under!: FxLayer;
  private over!: FxLayer;
  private fog!: FxLayer;
  private fogImg!: ImageData;
  private surf!: Float32Array;
  private glints!: Float32Array;
  private walkT = 0;
  private moving = false;
  private pending: { cmd: Command; obj: WorldObj } | null = null;
  /** 采集动画：粒子、计时、被摇动的物体 */
  private parts = new Particles();
  private rseq = 1;
  private actT = 0;
  private shaking: Img | null = null;

  constructor() {
    super('island');
  }

  protected where(): string | null {
    return this.isl;
  }

  create(): void {
    this.setupWorld();
    const s = this.state;
    this.isl = s.player.at ?? 'home';
    this.objImgs = new Map();
    this.aboardImgs = [];
    this.aboardKey = '';
    this.flames = new Map();
    this.glows = new Map();
    this.pending = null;
    this.shaking = null;
    this.parts = new Particles();
    if (s.walk.island !== this.isl) {
      const Ls = layout(this.isl, s.seed);
      s.walk = { island: this.isl, x: Ls.spawn[0], y: Ls.spawn[1], facing: 'up', moved: s.walk.moved };
    }
    this.L = layout(this.isl, s.seed);
    this.R = raster(this.isl, s.seed);
    const key = 'terrain_' + this.isl + '_' + s.seed;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, paintTerrain(this.L, this.R));
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1000);
    const fx = waterFx(this.R, this.L);
    this.surf = fx.surf;
    this.glints = fx.glints;

    this.under = this.fxCanvas('fx_under', -500);
    this.over = this.fxCanvas('fx_over', 50000);
    this.fog = this.fxCanvas('fx_fog', 60000);
    this.fogImg = this.fog.tex.context.createImageData(this.fog.tex.width, this.fog.tex.height);

    this.syncObjects();
    this.makeOverlays();
    for (const [i, f] of fencePieces(this.L.template).entries()) {
      const key = `fence_${this.isl}_${i}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, f.canvas);
      this.add.image(f.x, f.y, key).setOrigin(0, 0).setDepth(f.depth);
    }
    this.hl = this.add.image(0, 0, 'ui_arrow').setOrigin(0.5, 1).setVisible(false);
    this.player = this.add.image(s.walk.x, s.walk.y + 1, 'ch_player_down_0').setOrigin(0.5, 1);
    this.lastX = s.walk.x;
    this.lastY = s.walk.y;
    this.placeCamera();
    this.finishSetup();
  }

  // ---------------------------------------------------------------- 输入

  protected onAction(a: Action): void {
    if (a === 'close' && this.pending) return this.cancelAction();
    if (this.panelAction(a)) return;
    if (this.ctx.view.s.panel || this.pending || this.fading) return;
    if (a === 'use') return this.useHotbar();
    if (a === 'interact') return this.interact();
    // 站在水边按 Z 喝海水
    if (a === 'drink') this.ctx.store.dispatch({ t: 'drinkSea' });
  }

  /** 庆祝：人物头顶一圈亮片，分三次撒（升级、有人加入、修好飞机） */
  protected onFx(e: string): void {
    if (e !== 'celebrate') return;
    const w = this.state.walk;
    for (let k = 0; k < 3; k++)
      this.time.delayedCall(k * 180, () => this.parts.burst(10, w.x + (k - 1) * 8, w.y - 30, ['y1', 'fw', 'e3', 'fy'], { speed: 40, up: 50, g: 60, floor: w.y + 2, life: 1.4 }, this.rnd));
  }

  protected onDied(): void {
    this.cancelAction();
  }

  private useHotbar(): void {
    const id = slotView(this.state.player.pack).slots[this.ctx.view.s.hotbar]?.id;
    if (!id || !ITEMS[id].eat) return;
    this.ctx.store.dispatch({ t: 'consume', from: 'pack', item: id });
  }

  private interact(): void {
    const f = this.ctx.view.s.focus;
    if (!f) return;
    const o = this.objs.find((x) => x.id === f.id);
    if (!o) return;
    const info = interactInfo(this.state, o);
    if (!info || !info.ok) return;
    const v = this.ctx.view;
    const g = gatherCmd(this.state, o);
    if (g) {
      const what = g.t === 'gather' ? g.what : 'branch';
      const now = performance.now();
      this.pending = { cmd: g, obj: o };
      this.actT = 0;
      this.faceTo(o);
      v.set({ action: { label: info.label, start: now, end: now + (ANIM.actionSeconds[what] ?? 1) * 1000 } });
      return;
    }
    switch (o.kind) {
      case 'workbench':
        return v.set({ panel: 'craft' });
      case 'chest':
        return v.set({ panel: 'chest' });
      case 'lighthouse':
        return v.set({ panel: 'lighthouse' });
      case 'wreck':
        return v.set({ panel: 'wreck' });
      case 'raft':
        return v.set({ panel: 'raft' });
      case 'facility':
        // 犯困的工人：按 E 叫醒，不开面板
        if (island(this.state, this.isl).sleepy) {
          this.ctx.store.dispatch({ t: 'wake' });
          return;
        }
        return v.set({ panel: 'facility' });
      case 'board':
      case 'school':
      case 'shipyard':
      case 'plot':
      case 'office':
      case 'helipad':
      case 'farm':
        return v.set({ panel: o.kind });
      case 'npc':
        return v.set({ panel: 'talk', talkTo: personOfObj(this.state, o.id)?.id ?? null });
      case 'dock':
        // 出海：点阵变黑，离岛，换到海上场景
        this.fadeThrough(() => this.ctx.store.dispatch({ t: 'leave' }));
        return;
      case 'bed':
        this.fadeThrough(() => {
          this.ctx.store.dispatch({ t: 'sleep' });
          this.ctx.store.save();
        });
        return;
    }
  }

  private cancelAction(): void {
    this.stopShake();
    this.pending = null;
    this.ctx.view.set({ action: null });
  }

  private finishAction(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.stopShake();
    this.actionBurst(p.obj, true);
    const before = totals(this.state);
    const r = this.ctx.store.dispatch(p.cmd);
    this.ctx.view.set({ action: null });
    if (!r.ok) return;
    const after = totals(this.state);
    const w = this.state.walk;
    for (const id of ITEM_ORDER) {
      const d = (after[id] ?? 0) - (before[id] ?? 0);
      if (d > 0) this.ctx.view.pop(id, '+' + d, w.x, w.y - 30);
    }
  }

  // ---------------------------------------------------------------- 采集动画

  private rnd = (): number => hash(this.rseq++, 7, 91);

  /** 动作开始时转身面对物体 */
  private faceTo(o: WorldObj): void {
    const w = this.state.walk;
    const r = o.hit ?? { x: o.x, y: o.y, w: 0, h: 0 };
    const dx = r.x + r.w / 2 - w.x;
    const dy = r.y + r.h / 2 - w.y;
    w.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  private stopShake(): void {
    if (!this.shaking) return;
    const o = this.objs.find((x) => this.objImgs.get(x.id) === this.shaking);
    if (o) this.shaking.setX(o.x);
    this.shaking = null;
  }

  /** 动作进行中：树和草药丛被摇动、掉叶子；捞鱼时浮漂一沉一浮 */
  private animateAction(dt: number): void {
    const p = this.pending;
    if (!p) return;
    const o = p.obj;
    const img = this.objImgs.get(o.id);
    const prev = this.actT;
    this.actT += dt;
    const beat = ANIM.gatherBeat;
    const hit = Math.floor(this.actT / beat) !== Math.floor(prev / beat);
    if ((o.kind === 'tree' || o.kind === 'herb') && img) {
      this.shaking = img;
      // 每一下摇两帧
      const ph = (this.actT % beat) / beat;
      img.setX(o.x + (ph < 0.15 ? 1 : ph < 0.3 ? -1 : 0));
    }
    if (hit) this.actionBurst(o, false);
  }

  /** 一下动作的粒子；end 为动作完成 */
  private actionBurst(o: WorldObj, end: boolean): void {
    const img = this.objImgs.get(o.id);
    if (o.kind === 'tree' && img) {
      // 树冠掉叶子，树干飞木屑
      const top = img.y - img.height;
      for (let i = 0; i < (end ? 4 : 2); i++)
        this.parts.add({ x: o.x + (this.rnd() - 0.5) * img.width * 0.7, y: top + img.height * (0.15 + this.rnd() * 0.4), vx: (this.rnd() - 0.5) * 10, vy: 4, g: 10, floor: o.y + this.rnd() * 6, life: 1.6, role: this.rnd() < 0.5 ? 'l2' : 'l3' });
      this.parts.burst(end ? 5 : 2, o.x, o.y - 6, ['w2', 'w3'], { speed: 26, up: 30, g: 140, floor: o.y + 3, life: 0.8 }, this.rnd);
    } else if (o.kind === 'herb' && img) {
      this.parts.burst(end ? 5 : 2, o.x, o.y - 8, ['l2', 'l3', 'fw'], { speed: 16, up: 28, g: 90, floor: o.y + 2, life: 0.9 }, this.rnd);
    } else if (o.kind === 'shoal') {
      const [bx, by] = this.bobber(o);
      if (end) this.parts.burst(8, bx, by, ['foam', 'foam', 'e3'], { speed: 22, up: 34, g: 150, floor: by + 1, life: 0.6 }, this.rnd);
      else this.parts.burst(2, bx, by, ['foam'], { speed: 8, up: 12, g: 90, floor: by + 1, life: 0.4 }, this.rnd);
    }
  }

  /** 浅滩钓点里浮漂的位置 */
  private bobber(o: WorldObj): [number, number] {
    return [o.x + 3, o.y + 6];
  }

  // ---------------------------------------------------------------- 每帧

  update(_time: number, delta: number): void {
    if (!this.tickWorld(delta)) return;
    const dt = Math.min(delta, 100) / 1000;
    const { view } = this.ctx;
    const s = this.state;
    if (this.pending && performance.now() >= (view.s.action?.end ?? 0)) this.finishAction();
    this.animateAction(dt);
    this.parts.step(dt);
    this.walk(dt);
    this.placeCamera();
    this.updatePlayerSprite(dt);
    this.updateFocus();
    this.updateIntro();
    this.updateGuide();
    this.updateObjects();
    view.setIfChanged('labels', []);
    this.fxAcc += dt;
    if (this.fxAcc >= ANIM.fxInterval) {
      this.fxAcc = 0;
      this.drawFx(this.phase.s);
    }
    view.s.anchors.player = { x: this.snap(s.walk.x, this.camX) - this.camX, y: this.snap(s.walk.y, this.camY) - this.camY };
    this.paintLights();
  }

  /** 上一帧人物的位置（行走帧按距离换） */
  private lastX = 0;
  private lastY = 0;

  /**
   * 走路：连续坐标，任何方向都是同样的速度（斜着走不会更快）。
   * 画面按屏幕分辨率渲染（镜头放大 k 倍），所以不到一像素的移动也看得见，斜着走不会一顿一顿。
   * 斜着走用左右的行走动画。
   */
  private walk(dt: number): void {
    const s = this.state;
    const w = s.walk;
    const blocked = !!this.ctx.view.s.panel || !!this.pending || this.fading || !this.ctx.store.running;
    let [dx, dy] = blocked ? [0, 0] : moveDir();
    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) return;
    if (dx !== 0) w.facing = dx > 0 ? 'right' : 'left';
    else w.facing = dy > 0 ? 'down' : 'up';
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const sp = BALANCE.interact.walkSpeed * dt;
    const x0 = w.x;
    const y0 = w.y;
    if (dx !== 0 && this.canWalk(w.x + dx * sp, w.y)) w.x += dx * sp;
    if (dy !== 0 && this.canWalk(w.x, w.y + dy * sp)) w.y += dy * sp;
    const moved = Math.hypot(w.x - x0, w.y - y0);
    w.moved += moved;
    if (moved === 0) this.moving = false;
  }

  private placeCamera(): void {
    const w = this.state.walk;
    this.placeCameraOn(w.x, w.y - 16, this.L.pw, this.L.ph);
  }

  /**
   * 人物精灵：行走帧按走过的距离换（每 ANIM.walkStride 像素一帧），帧率掉了也不会像在跑；
   * 绘制位置对齐到屏幕像素（1/k 游戏像素），停在半个像素上会糊、会闪。
   */
  private updatePlayerSprite(_dt: number): void {
    const w = this.state.walk;
    let f = 0;
    if (this.moving) {
      this.walkT += Math.hypot(w.x - this.lastX, w.y - this.lastY);
      f = Math.floor(this.walkT / ANIM.walkStride) % 4;
    } else if (this.pending) {
      // 采集：跟着节奏挥一下手（捞鱼时站着不动，只看浮漂）
      const swing = (this.actT % ANIM.gatherBeat) / ANIM.gatherBeat < 0.3;
      f = this.pending.obj.kind === 'shoal' ? 0 : swing ? 1 : 3;
    } else this.walkT = 0;
    this.player.setTexture(`ch_player_${DIR_OF[w.facing]}_${f}`);
    this.player.setFlipX(w.facing === 'left');
    this.player.setPosition(this.snap(w.x, this.camX), this.snap(w.y, this.camY) + 1);
    this.player.setDepth(w.y);
    this.lastX = w.x;
    this.lastY = w.y;
  }

  /** 选出人物前方 reach 以内最近的一个可互动物体，更新按键提示 */
  private updateFocus(): void {
    const s = this.state;
    const v = this.ctx.view;
    const w = s.walk;
    const reach = BALANCE.interact.reach;
    const [fx, fy] = FACE_VEC[w.facing];
    const probe = { x: w.x + fx * 10, y: w.y - 2 + fy * 10 };
    let best: WorldObj | null = null;
    let bs = Infinity;
    if (!v.s.panel) {
      for (const o of this.objs) {
        if (!o.hit || o.kind === 'decor') continue;
        if (rectDist(w.x, w.y - 1, o.hit) > reach) continue;
        const sc = rectDist(probe.x, probe.y, o.hit);
        if (sc < bs) {
          bs = sc;
          best = o;
        }
      }
    }
    const prompts: Prompt[] = [];
    if (best) {
      const info = interactInfo(s, best);
      if (info) prompts.push({ key: 'E', label: info.label, ok: info.ok, reason: info.reason });
      else best = null;
    }
    v.setIfChanged('focus', best ? { id: best.id, kind: best.kind } : null);
    const ref = this.pending?.obj ?? best;
    v.s.anchors.promptBelow = !!ref?.hit && ref.hit.y + ref.hit.h <= w.y - 2;
    v.setIfChanged('prompts', prompts);
    // 选中描边
    const img = best ? this.objImgs.get(best.id) : undefined;
    if (best && img && this.textures.exists(best.sprite + '_hl')) {
      this.hl.setTexture(best.sprite + '_hl').setPosition(img.x, img.y).setDepth(img.depth + 0.5).setVisible(true);
    } else this.hl.setVisible(false);
  }

  /** 第一次走近一种物体时，头顶出现名字 + 一句话 */
  private updateIntro(): void {
    const s = this.state;
    const v = this.ctx.view;
    const now = performance.now();
    const cur = v.s.intro;
    if (cur && now > cur.until) v.set({ intro: null });
    if (v.s.intro) {
      const o = this.nearestOfKind(v.s.intro.kind);
      const img = o ? this.objImgs.get(o.id) : undefined;
      if (o) {
        // 物体在人物下方时卡片放在物体旁边（不挡人物，也不挡物体周围），否则放在物体上方
        const top = img ? img.y - img.height : o.y - 16;
        // 卡片放在物体上方会顶到画面上沿的 HUD（高的东西，比如灯塔）时也放旁边
        const below = o.y > s.walk.y + 4 || top - this.camY < BALANCE.ui.introTopMin;
        const half = img ? img.width / 2 : 8;
        const side = o.x - this.camX < VIEW.w / 2 ? 1 : -1;
        v.s.anchors.intro = below
          ? { x: o.x + side * (half + 6) - this.camX, y: top - this.camY, below, side }
          : { x: o.x - this.camX, y: top - this.camY, below, side };
      }
      return;
    }
    if (v.s.panel || this.pending) return;
    const w = s.walk;
    for (const o of this.objs) {
      const ik = introKind(o);
      if (!o.hit || o.kind === 'decor' || s.intros.includes(ik)) continue;
      if (rectDist(w.x, w.y - 1, o.hit) > BALANCE.interact.introRange) continue;
      this.ctx.store.dispatch({ t: 'seeIntro', kind: ik });
      v.set({ intro: { kind: ik, until: now + BALANCE.ui.introMs } });
      return;
    }
  }

  private nearestOfKind(kind: string): WorldObj | null {
    const w = this.state.walk;
    let best: WorldObj | null = null;
    let bd = Infinity;
    for (const o of this.objs) {
      if (introKind(o) !== kind) continue;
      const d = Math.hypot(o.x - w.x, o.y - w.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** 引导：目标物体头顶上下跳动的箭头；不在屏幕里时屏幕边缘指个方向（WorldScene.pointAt） */
  private updateGuide(): void {
    const s = this.state;
    const v = this.ctx.view;
    const step = pointerStep(s);
    let tx: number | null = null;
    let ty = 0;
    let uiTarget: string | null = null;
    if (step && !v.s.panel) {
      const t = step.target;
      if (t.kind === 'player') {
        tx = s.walk.x;
        ty = s.walk.y - 34;
      } else if (t.kind === 'object' || (t.kind === 'island' && t.id !== this.isl)) {
        // 目标在别的岛上：先去码头
        const elsewhere = (t.kind === 'island' && t.id !== this.isl) || (t.kind === 'object' && !!step.at && step.at !== this.isl);
        const o = this.nearestOfKind(elsewhere ? 'dock' : t.kind === 'object' ? t.obj : 'dock');
        if (o) {
          const img = this.objImgs.get(o.id);
          tx = o.x;
          ty = img ? img.y - img.height - 2 : o.hit ? o.hit.y - 4 : o.y - 16;
        }
      } else if (t.kind === 'ui') uiTarget = t.id;
    }
    this.setUiTarget(uiTarget);
    this.pointAt(tx, ty, s.walk.x, s.walk.y);
  }

  /** 物体和存档同步：今天的树和草药（长出、采完变树桩、第二天清掉）、木筏 */
  private syncObjects(): void {
    const s = this.state;
    this.objs = objectsOn(s, this.isl);
    // 固定物体的底座已经在 Raster 的可走遮罩里；其余（采集点、岛上的人、灯塔、加入网络后的建筑）每帧单独挡
    const fixed = new Set(this.L.objects.map((o) => o.id));
    this.blockers = this.objs.filter((o) => o.foot && !fixed.has(o.id)).map((o) => o.foot!);
    const S = allSprites();
    const seen = new Set<string>();
    for (const o of this.objs) {
      if (!o.sprite || !S[o.sprite]) continue;
      seen.add(o.id);
      let img = this.objImgs.get(o.id);
      if (!img) {
        img = this.add.image(o.x, o.y + 1, o.sprite).setOrigin(0.5, 1).setDepth(o.y);
        this.objImgs.set(o.id, img);
      } else if (img.texture.key !== o.sprite) img.setTexture(o.sprite);
    }
    for (const [id, img] of this.objImgs) {
      if (seen.has(id)) continue;
      if (this.shaking === img) this.shaking = null;
      img.destroy();
      this.objImgs.delete(id);
    }
  }

  private updateObjects(): void {
    this.syncObjects();
    // 停在码头边的木筏：在水里上下轻轻浮动，画在码头后面
    const raft = this.raftObj();
    const img = raft ? this.objImgs.get(raft.id) : undefined;
    const bob = Math.round(Math.sin(this.t * 1.8) * 1.1);
    if (raft && img) img.setY(raft.y + 1 + bob).setDepth(raft.y - 40);
    // 随船的同伴站在木筏上（上船、下船时重建）
    const aboard = this.state.player.aboard;
    const key = aboard.join(',');
    if (key !== this.aboardKey) {
      for (const im of this.aboardImgs) im.destroy();
      this.aboardImgs = aboard.slice(0, 3).map((id) => {
        const p = this.state.people.find((x) => x.id === id);
        return this.add.image(0, 0, `ch_${p ? charOf(p) : 'islander'}_down_0`).setOrigin(0.5, 1);
      });
      this.aboardKey = key;
    }
    this.aboardImgs.forEach((im, i) => {
      im.setVisible(!!raft);
      if (raft) im.setPosition(raft.x + [-9, 3, 13][i], raft.y - 7 + bob).setDepth(raft.y - 39);
    });
  }

  private raftObj(): WorldObj | undefined {
    return this.objs.find((o) => o.kind === 'raft');
  }

  /**
   * 设施头顶：运转时一根进度条（这一批做了多少），下面一排等级小星；
   * 停工时换成一个气泡，里面是停工原因的图标（缺人、缺饭、满仓……，和设施面板同一套 WORK_ICON），慢慢上下浮。
   * 等级也画在建筑上：2 级起屋顶插一面小旗，3 级两面。
   */
  private drawFacilityStatus(c: CanvasRenderingContext2D, P: Pal, x: number, y: number, top: number, left: number): void {
    const isl = this.state.islands.find((i) => i.id === this.isl);
    if (!isl) return;
    for (let i = 1; i < isl.level; i++) {
      const fx = left + 3 + (i - 1) * 6;
      px(c, P, 'o', fx - 1, top - 9, 3, 11);
      px(c, P, 'w1', fx, top - 8, 1, 10);
      px(c, P, 'o', fx + 1, top - 9, 5, 5);
      px(c, P, i === 1 ? 'x2' : 'y1', fx + 1, top - 8, 4, 3);
    }
    const r = islandRate(this.state, isl);
    if (r.rate <= 0 || isl.sleepy) {
      const note = r.note === 'work.ok' ? isl.workNote || 'work.nobody' : r.note;
      const key = 'ic_' + (WORK_ICON[note] ?? 'ui_warn');
      if (!this.textures.exists(key)) return;
      const ic = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const by = y - 20 + Math.round(Math.sin(this.t * 2) * 1);
      px(c, P, 'o', x - 10, by - 1, 20, 20);
      px(c, P, 'i0', x - 9, by, 18, 18);
      px(c, P, 'x2', x - 9, by, 18, 1);
      px(c, P, 'o', x - 2, by + 19, 4, 2);
      px(c, P, 'o', x - 1, by + 21, 2, 1);
      c.drawImage(ic, x - 8, by + 1);
      return;
    }
    const w = 16;
    const p = Math.max(0, Math.min(1, isl.prodAcc % 1));
    px(c, P, 'o', x - w / 2 - 1, y - 4, w + 2, 5);
    px(c, P, 'i0', x - w / 2, y - 3, w, 3);
    const fw = Math.round(w * p);
    if (fw > 0) {
      px(c, P, 'y0', x - w / 2, y - 3, fw, 3);
      px(c, P, 'y1', x - w / 2, y - 3, fw, 1);
    }
  }

  /** 篝火火苗（每帧重画的小画布）和小屋亮着的窗（固定的一张图），深度紧贴在物体上面 */
  private makeOverlays(): void {
    const S = allSprites();
    for (const o of this.L.objects) {
      const g = S[o.sprite];
      if (!g) continue;
      const ox = o.x - (g.w >> 1);
      const oy = o.y - g.h + 1;
      if (o.sprite === 'fire') {
        const key = 'flame_' + this.isl + '_' + o.id;
        const tex = this.textures.exists(key) ? (this.textures.get(key) as Phaser.Textures.CanvasTexture) : this.textures.createCanvas(key, 9, 9)!;
        const [fx, fy] = g.meta.flame as [number, number];
        const img = this.add.image(ox + fx - 4, oy + fy - 8, key).setOrigin(0, 0).setDepth(o.y + 0.1);
        this.flames.set(o.id, { tex, img });
      } else if (g.meta.win) this.makeGlow(o);
    }
  }

  /** 亮着的窗（夜里显示）：有窗的精灵（小屋、村里的房子、学堂、进出口局）都有一张 */
  private makeGlow(o: WorldObj): Img | undefined {
    const g = allSprites()[o.sprite];
    if (!g?.meta.win) return undefined;
    const key = 'glow_' + o.sprite;
    if (!this.textures.exists(key)) {
      const cv = mkCanvas(g.w, g.h);
      const c = cv.getContext('2d')!;
      for (const [x, y, w, h] of g.meta.win as [number, number, number, number][]) {
        px(c, DAY, 'y0', x, y, w, h);
        if (w > 4 && h > 4) px(c, DAY, 'y1', x + 2, y + 2, w - 4, h - 4);
        if (w >= 12) px(c, DAY, 'w0', x + (w >> 1), y, 1, h);
        if (h >= 10) px(c, DAY, 'w0', x, y + (h >> 1), w, 1);
      }
      this.textures.addCanvas(key, cv);
    }
    const img = this.add.image(o.x - (g.w >> 1), o.y - g.h + 1, key).setOrigin(0, 0).setDepth(o.y + 0.1).setVisible(false);
    this.glows.set(o.id, img);
    return img;
  }

  /** 篝火火苗：(wx, wy) 为火苗底部的世界坐标，k 为帧号 */
  private drawFlame(id: string, wx: number, wy: number, k: number): void {
    const f = this.flames.get(id);
    if (!f) return;
    const c = f.tex.context;
    c.clearRect(0, 0, 9, 9);
    const bx = wx - f.img.x;
    const by = wy - f.img.y;
    for (let dy = 0; dy < 8; dy++) {
      const w = [3, 3, 3, 2, 2, 1, 1, 0][dy];
      for (let dx = -w; dx <= w; dx++) {
        const r = hash(dx * 7 + dy, k, 77);
        if (dy > 3 && r < 0.3) continue;
        px(c, DAY, (Math.abs(dx) < w && dy < 5) || r > 0.8 ? 'f1' : 'f0', bx + dx, by - dy);
      }
    }
    f.tex.refresh();
  }

  /** 人物脚底中点能不能站在 (x, y)：地形 + 固定物体（Raster）+ 今天的采集点 */
  private canWalk(x: number, y: number): boolean {
    if (!canStand(this.R, x, y)) return false;
    const fx = x + FEET.x;
    const fy = y + FEET.y;
    return !this.blockers.some((b) => fx < b.x + b.w && fx + FEET.w > b.x && fy < b.y + b.h && fy + FEET.h > b.y);
  }

  // ---------------------------------------------------------------- 画面特效


  /**
   * 特效层按世界坐标画：画布左上角 = 镜头左上角往外 FX_PAD 像素，画完把图片摆到那个位置。
   * 两次重画之间，特效跟着世界一起动（浪花、雾不会贴在屏幕上来回“游”）。
   */
  private drawFx(strength: number): void {
    const [cx, cy] = this.fxOrigin();
    const t = this.t;
    const P = DAY;
    const W = VIEW.w + FX_PAD * 2;
    const H = VIEW.h + FX_PAD * 2;

    // 浪花、闪光
    const u = this.under.tex.context;
    u.clearRect(0, 0, W, H);
    u.fillStyle = P.foam as string;
    const S = this.surf;
    for (let i = 0; i < S.length; i += 4) {
      const x = S[i] - cx;
      const y = S[i + 1] - cy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const h = S[i + 2];
      const n = S[i + 3];
      if (Math.sin(h * 0.6 - t * ANIM.surfPhase + n * 7) > 0.74 || (h > -1.6 && Math.sin(t * ANIM.surfSparkle + S[i] * 0.21 + n * 5) > -0.3)) u.fillRect(x, y, 1, 1);
    }
    u.fillStyle = P.glint as string;
    const G = this.glints;
    for (let i = 0; i < G.length; i += 3) {
      const x = G[i] - cx;
      const y = G[i + 1] - cy;
      if (x < -4 || y < 0 || x >= W + 4 || y >= H) continue;
      const ph = (t / ANIM.glintPeriod + G[i + 2]) % 1;
      if (ph < 0.22) {
        const len = ph < 0.11 ? 2 : 4;
        u.fillRect(x - (len >> 1), y, len, 1);
      }
    }
    // 浅滩钓点：一圈圈水纹（平时也有，好找）；捞鱼时多一个浮漂
    for (const o of this.L.objects) {
      if (o.kind !== 'shoal') continue;
      const fishing = this.pending?.obj.id === o.id;
      const [bx, by] = this.bobber(o);
      const period = fishing ? ANIM.gatherBeat : ANIM.rippleSeconds;
      for (const off of [0, 0.5]) {
        const ph = ((t + off * period) / period) % 1;
        const r = 3 + ph * (fishing ? 9 : 16);
        if (ph > 0.85 && Math.floor(t * 20) % 2) continue;
        const pts = Math.round(r * 4);
        for (let a = 0; a < pts; a++) {
          if (a % 4 === 3) continue;
          const ang = (a / pts) * Math.PI * 2;
          px(u, P, 'foam', Math.round(bx + Math.cos(ang) * r - cx), Math.round(by + Math.sin(ang) * r * 0.45 - cy));
        }
      }
      if (fishing) {
        const dip = (this.actT % ANIM.gatherBeat) / ANIM.gatherBeat < 0.25 ? 1 : 0;
        px(u, P, 'x2', bx - cx, by - 3 + dip - cy, 2, 2);
        px(u, P, 'e3', bx - cx, by - 1 + dip - cy, 2, 1);
      }
    }
    const ro = this.raftObj();
    if (ro) {
      const [rx, ry] = [ro.x, ro.y];
      const bob = Math.round(Math.sin(t * 1.8) * 1.1);
      const rp = Math.floor(t * 2) % 2;
      px(u, P, 'foam', rx - 21 + rp * 2 - cx, ry + bob - cy, 4, 1);
      px(u, P, 'foam', rx + 17 - rp * 2 - cx, ry + bob - cy, 4, 1);
    }
    this.under.tex.refresh();
    this.under.img.setPosition(cx, cy);

    // 篝火、炊烟、海鸥、亮着的窗
    const c = this.over.tex.context;
    c.clearRect(0, 0, W, H);
    const spots: Spot[] = [];
    const beams: Beam[] = [];
    const Sp = allSprites();
    const k = Math.floor(t * ANIM.fireFps);
    // 所有物体（固定的和跟着存档出现的，比如石头岛修好的灯塔）都可能发光
    for (const o of this.objs) {
      const g = Sp[o.sprite];
      if (!g) continue;
      const ox = o.x - (g.w >> 1) - cx;
      const oy = o.y - g.h + 1 - cy;
      if (o.sprite === 'fire') {
        const [fx0, fy0] = g.meta.flame as [number, number];
        const fx = ox + fx0;
        const fy = oy + fy0;
        this.drawFlame(o.id, fx + cx, fy + cy, k);
        spots.push([fx, fy, (LIGHTS.fire + Math.round(Math.sin(t * 9) * LIGHTS.fireFlicker)) * strength]);
      } else if (g.meta.win) {
        if (g.meta.chim) {
          const [chx, chy] = g.meta.chim as [number, number];
          for (let i = 0; i < 7; i++) {
            const a = (t * 0.2 + i / 7) % 1;
            const x = ox + chx + Math.round(a * 14 + Math.sin(a * 6 + i) * 2);
            const y = oy + chy - Math.round(a * 40);
            const sz = a < 0.3 ? 2 : 3;
            if (a > 0.7 && (x + y) & 1) continue;
            px(c, P, 'smoke', x, y, sz, sz);
          }
        }
        const wins = g.meta.win as [number, number, number, number][];
        // 跟着存档出现的房子（建好的小屋、学堂）第一次画到时才做亮窗
        (this.glows.get(o.id) ?? this.makeGlow(o))?.setVisible(strength > LIGHTS.windowGlowFrom);
        for (const [x, y, w, h] of wins) spots.push([ox + x + w / 2, oy + y + h / 2, LIGHTS.window * strength]);
        if (g.meta.lantern) {
          const [lx, ly] = g.meta.lantern as [number, number];
          spots.push([ox + lx, oy + ly, LIGHTS.doorLamp * strength]);
        }
      } else if (o.sprite === 'light') {
        const [lx, ly] = g.meta.lamp as [number, number];
        spots.push([ox + lx, oy + ly, LIGHTS.lighthouse * strength]);
        if (strength >= LIGHTS.beam.minStrength)
          beams.push([ox + lx, oy + ly, LIGHTS.beam.length * strength, (t / LIGHTS.beam.secondsPerTurn) * Math.PI * 2, LIGHTS.beam.halfAngle]);
      } else if (o.kind === 'raft') {
        const [lx, ly] = g.meta.lantern as [number, number];
        spots.push([ox + lx, oy + ly, LIGHTS.lantern * strength]);
      } else if (o.kind === 'facility') {
        // 设施：有火的（蒸馏器、烤炉）发光；头顶一根进度条，停工时换成“!”
        if (g.meta.flame) {
          const [fx, fy] = g.meta.flame as [number, number];
          spots.push([ox + fx, oy + fy, LIGHTS.doorLamp * strength]);
        }
        this.drawFacilityStatus(c, P, o.x - cx, oy - 4, oy, ox);
      }
    }
    const gull = Sp[Math.floor(t * ANIM.gullFps) % 2 ? 'gull1' : 'gull2'];
    if (gull) {
      const g1 = this.textures.get(Math.floor(t * ANIM.gullFps) % 2 ? 'gull1' : 'gull2').getSourceImage() as HTMLCanvasElement;
      // 海鸥沿着画面飞过（位置按镜头算，画进世界坐标的画布）
      const vx = this.camX - cx;
      const vy = this.camY - cy;
      c.drawImage(g1, Math.round(vx + ((t * 15) % 560) - 40), Math.round(vy + 70 + Math.sin(t * 1.1) * 6));
      c.drawImage(g1, Math.round(vx + 520 - ((t * 11 + 260) % 560)), Math.round(vy + 30 + Math.sin(t * 0.9 + 1) * 5));
    }
    // 鱼线：从人物手里到浮漂，深色，画在最上层
    const fo = this.pending?.obj;
    if (fo && fo.kind === 'shoal') {
      const [bx, by] = this.bobber(fo);
      const w = this.state.walk;
      const hx = w.x + (w.facing === 'left' ? -6 : w.facing === 'right' ? 6 : 5);
      const hy = w.y - 13;
      const n = Math.ceil(Math.hypot(bx - hx, by - 3 - hy));
      for (let i = 0; i < n; i++) {
        const k = i / n;
        px(c, P, 'o', Math.round(hx + (bx - hx) * k - cx), Math.round(hy + (by - 3 - hy) * k + Math.sin(k * Math.PI) * 2 - cy));
      }
    }
    this.parts.draw(c, P, cx, cy);
    this.over.tex.refresh();
    this.over.img.setPosition(cx, cy);

    // 雾
    paintFog(this.fogImg, this.R.fog, this.R.w, this.R.h, cx, cy, t);
    this.fog.tex.context.putImageData(this.fogImg, 0, 0);
    this.fog.tex.refresh();
    this.fog.img.setPosition(cx, cy);

    // 灯光的位置换成世界坐标，遮罩每帧按镜头画（WorldScene.paintLights）
    this.spots = spots.map(([x, y, r]) => [x + cx, y + cy, r]);
    this.beams = beams.map(([x, y, l, a, hw]) => [x + cx, y + cy, l, a, hw]);
  }



}

