// 岛上场景：人物走动、碰撞、镜头、选中面前的东西、按 E 互动、昼夜换色、灯光、雾。
// 规则全部走 store.dispatch；这里只负责“看见什么、按了什么”。
import Phaser from 'phaser';
import { allSprites, px } from '../../art/draw';
import { hash } from '../../art/noise';
import { DAY, phaseAt } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER, ITEMS, type ItemId } from '../../config/items';
import { ANIM, LIGHTS, VIEW } from '../../config/visual';
import { minuteOfDay } from '../../sim/clock';
import { currentGuide } from '../../sim/guide';
import { carried } from '../../sim/inventory';
import { interactInfo } from '../../sim/interact';
import type { Command, Facing, GameState } from '../../sim/types';
import { island } from '../../sim/util';
import { PAUSING_PANELS, type Prompt } from '../../store/view';
import { canStand, layout, raster, rectDist, type Layout, type Raster, type WorldObj } from '../../world/island';
import { CTX_KEY, type GameCtx } from '../context';
import { moveDir, onAction, type Action } from '../input/keys';
import { paintFog } from '../render/fog';
import { paintMask, type Beam, type Spot } from '../render/mask';
import { PalettePipeline } from '../render/PalettePipeline';
import { paintTerrain, waterFx } from '../world/terrain';

type Img = Phaser.GameObjects.Image;

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

export class IslandScene extends Phaser.Scene {
  private ctx!: GameCtx;
  private L!: Layout;
  private R!: Raster;
  private isl = 'home';
  private player!: Img;
  private objImgs = new Map<string, Img>();
  private hl!: Img;
  private arrow!: Img;
  private raft: Img | null = null;
  private under!: Phaser.Textures.CanvasTexture;
  private over!: Phaser.Textures.CanvasTexture;
  private fog!: Phaser.Textures.CanvasTexture;
  private mask!: Phaser.Textures.CanvasTexture;
  private fogImg!: ImageData;
  private maskImg!: ImageData;
  private surf!: Float32Array;
  private glints!: Float32Array;
  private pipe: PalettePipeline | null = null;
  private t = 0;
  private fxAcc = 1;
  private walkT = 0;
  private moving = false;
  private pending: { cmd: Command; obj: WorldObj } | null = null;
  private off: (() => void) | null = null;
  private lastPos = { x: 0, y: 0 };

  constructor() {
    super('island');
  }

  private get state(): GameState {
    return this.ctx.store.state;
  }

  create(): void {
    this.ctx = this.registry.get(CTX_KEY) as GameCtx;
    const s = this.state;
    this.isl = 'home';
    if (s.walk.island !== this.isl) {
      const Ls = layout(this.isl, s.seed);
      s.walk = { island: this.isl, x: Ls.spawn[0], y: Ls.spawn[1], facing: 'down', moved: s.walk.moved };
    }
    this.L = layout(this.isl, s.seed);
    this.R = raster(this.isl, s.seed);
    const key = 'terrain_' + this.isl + '_' + s.seed;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, paintTerrain(this.L, this.R));
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1000);
    const fx = waterFx(this.R, this.L);
    this.surf = fx.surf;
    this.glints = fx.glints;

    this.under = this.screenCanvas('fx_under', -500);
    this.over = this.screenCanvas('fx_over', 50000);
    this.fog = this.screenCanvas('fx_fog', 60000);
    this.mask = this.textures.exists('fx_mask') ? (this.textures.get('fx_mask') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('fx_mask', VIEW.w, VIEW.h)!;
    this.fogImg = this.fog.context.createImageData(VIEW.w, VIEW.h);
    this.maskImg = this.mask.context.createImageData(VIEW.w, VIEW.h);

    const S = allSprites();
    for (const o of this.L.objects) {
      if (!o.sprite || !S[o.sprite]) continue;
      const img = this.add.image(o.x, o.y + 1, o.sprite).setOrigin(0.5, 1).setDepth(o.y);
      this.objImgs.set(o.id, img);
    }
    this.hl = this.add.image(0, 0, 'ui_arrow').setOrigin(0.5, 1).setVisible(false);
    this.arrow = this.add.image(0, 0, 'ui_arrow').setOrigin(0.5, 1).setDepth(55000).setVisible(false);
    this.player = this.add.image(s.walk.x, s.walk.y + 1, 'ch_player_down_0').setOrigin(0.5, 1);
    this.lastPos = { x: s.walk.x, y: s.walk.y };

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.L.pw, this.L.ph);
    cam.setRoundPixels(true);
    cam.setPostPipeline(PalettePipeline);
    const p = cam.getPostPipeline(PalettePipeline);
    this.pipe = (Array.isArray(p) ? p[0] : p) as PalettePipeline;
    this.pipe.mask = this.mask;

    this.off = onAction((a) => this.onAction(a));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.off?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.off?.());
    this.placeCamera();
  }

  private screenCanvas(key: string, depth: number): Phaser.Textures.CanvasTexture {
    const tex = this.textures.exists(key) ? (this.textures.get(key) as Phaser.Textures.CanvasTexture) : this.textures.createCanvas(key, VIEW.w, VIEW.h)!;
    this.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    return tex;
  }

  // ---------------------------------------------------------------- 输入

  private onAction(a: Action): void {
    const v = this.ctx.view;
    const panel = v.s.panel;
    if (a === 'close') {
      if (this.pending) return this.cancelAction();
      v.set({ panel: panel ? null : 'menu' });
      return;
    }
    if (a === 'inventory') return v.set({ panel: panel === 'inventory' ? null : 'inventory' });
    if (a === 'journal') return v.set({ panel: panel === 'journal' ? null : 'journal' });
    if (a === 'help') return v.set({ panel: panel === 'help' ? null : 'help' });
    if (panel || this.pending) return;
    if (a.startsWith('slot')) return v.set({ hotbar: Number(a.slice(4)) - 1 });
    if (a === 'use') return this.useHotbar();
    if (a === 'interact') return this.interact();
  }

  private useHotbar(): void {
    const items = ITEM_ORDER.filter((id) => (this.state.player.pack[id] ?? 0) > 0).slice(0, 5);
    const id = items[this.ctx.view.s.hotbar];
    if (!id || !ITEMS[id].eat) return;
    this.ctx.store.dispatch({ t: 'consume', from: 'pack', item: id });
  }

  private interact(): void {
    const f = this.ctx.view.s.focus;
    if (!f) return;
    const o = this.L.objects.find((x) => x.id === f.id);
    if (!o) return;
    const info = interactInfo(this.state, o);
    if (!info || !info.ok) return;
    const v = this.ctx.view;
    const g = gatherCmd(this.state, o);
    if (g) {
      const what = g.t === 'gather' ? g.what : 'branch';
      const now = performance.now();
      this.pending = { cmd: g, obj: o };
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
      case 'bed':
        this.ctx.store.dispatch({ t: 'sleep' });
        this.ctx.store.save();
        return;
    }
  }

  private cancelAction(): void {
    this.pending = null;
    this.ctx.view.set({ action: null });
  }

  private finishAction(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
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

  // ---------------------------------------------------------------- 每帧

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.t += dt;
    const { store, view } = this.ctx;
    store.hold('panel', !!view.s.panel && PAUSING_PANELS.includes(view.s.panel));
    store.frame(delta);
    const s = this.state;

    if (this.pending && performance.now() >= (view.s.action?.end ?? 0)) this.finishAction();
    this.walk(dt);
    this.placeCamera();
    this.updatePlayerSprite(dt);
    this.updateFocus();
    this.updateIntro();
    this.updateGuide();
    this.updateObjects();

    // 昼夜
    const minute = view.s.debugMinute ?? minuteOfDay(s.time);
    const ph = phaseAt(minute);
    if (this.pipe) this.pipe.mix = ph;

    this.fxAcc += dt;
    if (this.fxAcc >= ANIM.fxInterval) {
      this.fxAcc = 0;
      this.drawFx(ph.s);
    }
    const cam = this.cameras.main;
    view.s.anchors.player = { x: s.walk.x - cam.scrollX, y: s.walk.y - cam.scrollY };
  }

  private walk(dt: number): void {
    const s = this.state;
    const w = s.walk;
    const blocked = !!this.ctx.view.s.panel || !!this.pending || !this.ctx.store.running;
    let [dx, dy] = blocked ? [0, 0] : moveDir();
    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) return;
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    if (Math.abs(dx) > Math.abs(dy) + 0.01) w.facing = dx > 0 ? 'right' : 'left';
    else if (Math.abs(dy) > 0.01) w.facing = dy > 0 ? 'down' : 'up';
    const sp = BALANCE.interact.walkSpeed * dt;
    const nx = w.x + dx * sp;
    if (canStand(this.R, nx, w.y)) w.x = nx;
    const ny = w.y + dy * sp;
    if (canStand(this.R, w.x, ny)) w.y = ny;
    const moved = Math.hypot(w.x - this.lastPos.x, w.y - this.lastPos.y);
    w.moved += moved;
    this.lastPos = { x: w.x, y: w.y };
    if (moved === 0) this.moving = false;
  }

  private placeCamera(): void {
    const w = this.state.walk;
    const cam = this.cameras.main;
    const x = Math.round(Math.max(0, Math.min(this.L.pw - VIEW.w, w.x - VIEW.w / 2)));
    const y = Math.round(Math.max(0, Math.min(this.L.ph - VIEW.h, w.y - 16 - VIEW.h / 2)));
    cam.setScroll(x, y);
  }

  private updatePlayerSprite(dt: number): void {
    const w = this.state.walk;
    let f = 0;
    if (this.moving) {
      this.walkT += dt;
      f = Math.floor(this.walkT * ANIM.walkFps) % 4;
    } else if (this.pending) {
      this.walkT += dt;
      f = Math.floor(this.walkT * 2.5) % 2 ? 1 : 3;
    } else this.walkT = 0;
    this.player.setTexture(`ch_player_${DIR_OF[w.facing]}_${f}`);
    this.player.setFlipX(w.facing === 'left');
    this.player.setPosition(Math.round(w.x), Math.round(w.y) + 1);
    this.player.setDepth(w.y);
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
      for (const o of this.L.objects) {
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
    const cam = this.cameras.main;
    const cur = v.s.intro;
    if (cur && now > cur.until) v.set({ intro: null });
    if (v.s.intro) {
      const o = this.nearestOfKind(v.s.intro.kind);
      const img = o ? this.objImgs.get(o.id) : undefined;
      if (o) v.s.anchors.intro = { x: o.x - cam.scrollX, y: (img ? img.y - img.height : o.y - 16) - cam.scrollY };
      return;
    }
    if (v.s.panel || this.pending) return;
    const w = s.walk;
    for (const o of this.L.objects) {
      if (!o.hit || o.kind === 'decor' || s.intros.includes(o.kind)) continue;
      if (rectDist(w.x, w.y - 1, o.hit) > BALANCE.interact.introRange) continue;
      this.ctx.store.dispatch({ t: 'seeIntro', kind: o.kind });
      v.set({ intro: { kind: o.kind, until: now + BALANCE.ui.introMs } });
      return;
    }
  }

  private nearestOfKind(kind: string): WorldObj | null {
    const w = this.state.walk;
    let best: WorldObj | null = null;
    let bd = Infinity;
    for (const o of this.L.objects) {
      if (o.kind !== kind) continue;
      const d = Math.hypot(o.x - w.x, o.y - w.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** 引导：目标物体头顶上下跳动的箭头；不在屏幕里时屏幕边缘指个方向 */
  private updateGuide(): void {
    const s = this.state;
    const v = this.ctx.view;
    const step = currentGuide(s);
    const cam = this.cameras.main;
    let tx: number | null = null;
    let ty = 0;
    let uiTarget: string | null = null;
    if (step && !v.s.panel) {
      if (step.target.kind === 'player') {
        tx = s.walk.x;
        ty = s.walk.y - 34;
      } else if (step.target.kind === 'object') {
        const o = this.nearestOfKind(step.target.obj);
        if (o) {
          const img = this.objImgs.get(o.id);
          tx = o.x;
          ty = img ? img.y - img.height - 2 : o.hit ? o.hit.y - 4 : o.y - 16;
        }
      } else uiTarget = step.target.id;
    }
    if (v.s.anchors.uiTarget !== uiTarget) {
      v.s.anchors.uiTarget = uiTarget;
      v.set({});
    }
    if (tx === null) {
      this.arrow.setVisible(false);
      v.s.anchors.edge = null;
      return;
    }
    const bob = Math.round(Math.sin(this.t * 5) * 1.5);
    const sx = tx - cam.scrollX;
    const sy = ty - cam.scrollY;
    const inView = sx > 8 && sx < VIEW.w - 8 && sy > 10 && sy < VIEW.h - 4;
    this.arrow.setVisible(inView).setPosition(Math.round(tx), Math.round(ty) + bob);
    if (inView) v.s.anchors.edge = null;
    else {
      const cx = VIEW.w / 2;
      const cy = VIEW.h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((cx - 14) / Math.abs(Math.cos(ang) || 1e-6), (cy - 14) / Math.abs(Math.sin(ang) || 1e-6));
      const dist = Math.round(Math.hypot(tx - s.walk.x, ty - s.walk.y) / 16);
      v.s.anchors.edge = { x: cx + Math.cos(ang) * k, y: cy + Math.sin(ang) * k, angle: ang, dist };
    }
  }

  /** 状态决定的外观：草药丛采完、木筏造好 */
  private updateObjects(): void {
    const s = this.state;
    for (const o of this.L.objects) {
      if (o.kind !== 'herb') continue;
      const img = this.objImgs.get(o.id);
      const want = s.flags.herbsLeft > 0 ? 'herb' : 'herbEmpty';
      if (img && img.texture.key !== want) img.setTexture(want);
    }
    if (s.player.hasRaft && this.L.raftAt && !this.raft) {
      this.raft = this.add.image(this.L.raftAt[0], this.L.raftAt[1], 'raft').setOrigin(0.5, 1).setDepth(this.L.raftAt[1] - 40);
    }
    if (this.raft && this.L.raftAt) this.raft.setY(this.L.raftAt[1] + Math.round(Math.sin(this.t * 1.8) * 1.1));
    if (this.raft) this.raft.setVisible(s.player.hasRaft);
  }

  // ---------------------------------------------------------------- 画面特效（屏幕坐标）

  private drawFx(strength: number): void {
    const cam = this.cameras.main;
    const cx = Math.round(cam.scrollX);
    const cy = Math.round(cam.scrollY);
    const t = this.t;
    const P = DAY;
    const W = VIEW.w;
    const H = VIEW.h;

    // 浪花、闪光
    const u = this.under.context;
    u.clearRect(0, 0, W, H);
    u.fillStyle = P.foam as string;
    const S = this.surf;
    for (let i = 0; i < S.length; i += 4) {
      const x = S[i] - cx;
      const y = S[i + 1] - cy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const h = S[i + 2];
      const n = S[i + 3];
      if (Math.sin(h * 0.6 - t * ANIM.surfPhase + n * 7) > 0.74 || (h > -1.6 && Math.sin(t * 1.4 + S[i] * 0.21 + n * 5) > -0.3)) u.fillRect(x, y, 1, 1);
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
    if (this.raft && this.L.raftAt) {
      const [rx, ry] = this.L.raftAt;
      const bob = Math.round(Math.sin(t * 1.8) * 1.1);
      const rp = Math.floor(t * 2) % 2;
      px(u, P, 'foam', rx - 21 + rp * 2 - cx, ry + bob - cy, 4, 1);
      px(u, P, 'foam', rx + 17 - rp * 2 - cx, ry + bob - cy, 4, 1);
    }
    this.under.refresh();

    // 篝火、炊烟、海鸥、亮着的窗
    const c = this.over.context;
    c.clearRect(0, 0, W, H);
    const spots: Spot[] = [];
    const beams: Beam[] = [];
    const Sp = allSprites();
    const k = Math.floor(t * ANIM.fireFps);
    for (const o of this.L.objects) {
      const g = Sp[o.sprite];
      if (!g) continue;
      const ox = o.x - (g.w >> 1) - cx;
      const oy = o.y - g.h + 1 - cy;
      if (o.sprite === 'fire') {
        const [fx0, fy0] = g.meta.flame as [number, number];
        const fx = ox + fx0;
        const fy = oy + fy0;
        for (let dy = 0; dy < 8; dy++) {
          const w = [3, 3, 3, 2, 2, 1, 1, 0][dy];
          for (let dx = -w; dx <= w; dx++) {
            const r = hash(dx * 7 + dy, k, 77);
            if (dy > 3 && r < 0.3) continue;
            px(c, P, (Math.abs(dx) < w && dy < 5) || r > 0.8 ? 'f1' : 'f0', fx + dx, fy - dy);
          }
        }
        spots.push([fx, fy, (LIGHTS.fire + Math.round(Math.sin(t * 9) * LIGHTS.fireFlicker)) * strength]);
      } else if (o.sprite === 'house') {
        const [chx, chy] = g.meta.chim as [number, number];
        for (let i = 0; i < 7; i++) {
          const a = (t * 0.2 + i / 7) % 1;
          const x = ox + chx + Math.round(a * 14 + Math.sin(a * 6 + i) * 2);
          const y = oy + chy - Math.round(a * 40);
          const sz = a < 0.3 ? 2 : 3;
          if (a > 0.7 && (x + y) & 1) continue;
          px(c, P, 'smoke', x, y, sz, sz);
        }
        const wins = g.meta.win as [number, number, number, number][];
        if (strength > LIGHTS.windowGlowFrom)
          for (const [x, y, w, h] of wins) {
            px(c, P, 'y0', ox + x, oy + y, w, h);
            px(c, P, 'y1', ox + x + 2, oy + y + 2, w - 4, h - 4);
            px(c, P, 'w0', ox + x + 7, oy + y, 1, h);
            px(c, P, 'w0', ox + x, oy + y + 5, w, 1);
          }
        for (const [x, y, w, h] of wins) spots.push([ox + x + w / 2, oy + y + h / 2, LIGHTS.window * strength]);
        const [lx, ly] = g.meta.lantern as [number, number];
        spots.push([ox + lx, oy + ly, LIGHTS.doorLamp * strength]);
      } else if (o.sprite === 'light') {
        const [lx, ly] = g.meta.lamp as [number, number];
        spots.push([ox + lx, oy + ly, LIGHTS.lighthouse * strength]);
        if (strength >= LIGHTS.beam.minStrength)
          beams.push([ox + lx, oy + ly, LIGHTS.beam.length * strength, (t / LIGHTS.beam.secondsPerTurn) * Math.PI * 2, LIGHTS.beam.halfAngle]);
      }
    }
    if (this.raft && this.L.raftAt) {
      const g = Sp.raft;
      const [lx, ly] = g.meta.lantern as [number, number];
      spots.push([this.L.raftAt[0] - (g.w >> 1) + lx - cx, this.L.raftAt[1] - g.h + 1 + ly - cy, LIGHTS.lantern * strength]);
    }
    const gull = Sp[Math.floor(t * ANIM.gullFps) % 2 ? 'gull1' : 'gull2'];
    if (gull) {
      const g1 = this.textures.get(Math.floor(t * ANIM.gullFps) % 2 ? 'gull1' : 'gull2').getSourceImage() as HTMLCanvasElement;
      c.drawImage(g1, Math.round(((t * 15) % 560) - 40), Math.round(70 + Math.sin(t * 1.1) * 6));
      c.drawImage(g1, Math.round(520 - ((t * 11 + 260) % 560)), Math.round(30 + Math.sin(t * 0.9 + 1) * 5));
    }
    this.over.refresh();

    // 雾
    paintFog(this.fogImg, this.R.fog, this.R.w, this.R.h, cx, cy, t);
    this.fog.context.putImageData(this.fogImg, 0, 0);
    this.fog.refresh();

    // 灯光遮罩
    const useMask = strength > LIGHTS.maskFrom;
    if (this.pipe) this.pipe.useMask = useMask;
    if (useMask) {
      paintMask(this.maskImg, spots, beams);
      this.mask.context.putImageData(this.maskImg, 0, 0);
      this.mask.refresh();
    }
  }
}

