// 海上场景：自由航行的木筏、海面（已探索 / 可探索 / 迷雾）、小号的岛、灯塔光、漂流物、海上的按键（E 靠岸、F 捞、X 捕鱼、Z 喝海水）。
// 镜头、特效画布、灯光遮罩、过渡、昼夜、切场景在 WorldScene 里（和岛上场景共用）。
// 规则全部走 store.dispatch：每航行 BALANCE.sail.stepPixels 像素发一次 { t: 'sail', x, y }。
import Phaser from 'phaser';
import { allSprites, mkCanvas, px } from '../../art/draw';
import { hash, vn } from '../../art/noise';
import { DAY, pal, rgb, type Pal } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER, ITEMS, type ItemId } from '../../config/items';
import { ANIM, LIGHTS, SEA_ART, VIEW } from '../../config/visual';
import { currentGuide } from '../../sim/guide';
import { carried, slotView } from '../../sim/inventory';
import { canEnter, isLit } from '../../sim/map';
import { m } from '../../sim/msg';
import { playerLevel } from '../../sim/progression';
import type { GameState, Island } from '../../sim/types';
import { dockableIsland } from '../../sim/actions';
import type { Prompt } from '../../store/view';
import { islandCenter, islandSize, isLand, nearLandOf, seaRaster, type SeaRaster } from '../../world/sea';
import { moveDir, type Action } from '../input/keys';
import { paintFog } from '../render/fog';
import type { Beam, Spot } from '../render/mask';
import { Particles } from '../world/particles';
import { FX_PAD, WorldScene, type FxLayer, type Img } from './WorldScene';

const T = BALANCE.sail.tile;
const SA = BALANCE.sail;

/** 一个物品总数（算“+1”） */
function totals(state: GameState): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = {};
  for (const id of ITEM_ORDER) out[id] = carried(state, id);
  return out;
}

export class SeaScene extends WorldScene {
  private R!: SeaRaster;
  private rasterKey = '';
  private pw = 0;
  private ph = 0;
  /** 海面：已探索的样子、没探索的样子，按格子拼到 terrain 上 */
  private normal!: HTMLCanvasElement;
  private unseen!: HTMLCanvasElement;
  private terrain!: Phaser.Textures.CanvasTexture;
  private seenCopy = new Uint8Array(0);
  private litCopy = new Uint8Array(0);
  private islandImgs: Img[] = [];
  private islandSig = '';
  private raft!: Img;
  private crate!: Img;
  private under!: FxLayer;
  private over!: FxLayer;
  private fog!: FxLayer;
  private fogImg!: ImageData;
  /** 雾：显示中的浓度（每像素）、目标浓度；修好灯塔时从旧的慢慢变成新的 */
  private fogShown = new Float32Array(0);
  private fogTarget = new Float32Array(0);
  private fogFrom = new Float32Array(0);
  private fogT = 1;
  private surf = new Float32Array(0);
  private glints = new Float32Array(0);
  /** 木筏：位置（像素，底边中点）、速度 */
  private rx = 0;
  private ry = 0;
  private vx = 0;
  private vy = 0;
  private stepAcc = 0;
  private face = 1;
  private fogBumpAt = -99;
  private wake: [number, number, number][] = [];
  private parts = new Particles();
  private rseq = 1;
  /** 跳海捕鱼的动作 */
  private action: { until: number } | null = null;

  constructor() {
    super('sea');
  }

  protected where(): string | null {
    return null;
  }

  create(): void {
    this.setupWorld();
    const s = this.state;
    this.pw = s.width * T;
    this.ph = s.height * T;
    this.rx = s.raft.x;
    this.ry = s.raft.y;
    this.vx = this.vy = 0;
    this.wake = [];
    this.parts = new Particles();
    this.action = null;
    this.islandImgs = [];
    this.islandSig = '';
    this.rasterKey = '';
    this.fogT = 1;
    this.under = this.fxCanvas('fx_under', -500);
    this.over = this.fxCanvas('fx_over', 50000);
    this.fog = this.fxCanvas('fx_fog', 60000);
    this.fogImg = this.fog.tex.context.createImageData(this.fog.tex.width, this.fog.tex.height);
    this.terrain = this.textures.exists('sea_terrain') ? (this.textures.get('sea_terrain') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('sea_terrain', this.pw, this.ph)!;
    this.add.image(0, 0, 'sea_terrain').setOrigin(0, 0).setDepth(-1000);
    this.rebuildSea(true);
    this.raft = this.add.image(this.rx, this.ry, 'mraft').setOrigin(0.5, 1);
    this.crate = this.add.image(0, 0, 'float').setOrigin(0.5, 1).setVisible(false);
    this.placeCamera();
    this.finishSetup();
  }

  // ---------------------------------------------------------------- 海面

  private revealed(): Island[] {
    return this.state.islands.filter((i) => i.revealed);
  }

  /** 岛的集合变了（新的岛出现）就重画海面；灯塔修好（雾变了）就重算雾 */
  private rebuildSea(force = false): void {
    const s = this.state;
    const isl = this.revealed();
    const key = s.seed + ':' + isl.map((i) => `${i.id}@${i.x},${i.y}`).join('|');
    if (force || key !== this.rasterKey) {
      this.rasterKey = key;
      this.R = seaRaster(isl.map((i) => ({ id: i.id, x: i.x, y: i.y, kind: i.kind })), s.seed, s.width, s.height);
      this.normal = this.paintSea(DAY);
      this.unseen = this.paintSea(pal('day_u'));
      this.seenCopy = new Uint8Array(s.width * s.height).fill(255);
      this.litCopy = new Uint8Array(s.width * s.height).fill(255);
      this.waterFx();
    }
    this.syncTiles();
    this.syncIslands();
  }

  /** 画一整张海面（某个调色板）：深海、浅海、浪区、沙滩、草地、石头 */
  private paintSea(P: Pal): HTMLCanvasElement {
    const { w, h, hgt, own, islands } = this.R;
    const cv = mkCanvas(w, h);
    const c = cv.getContext('2d')!;
    const id = c.createImageData(w, h);
    const D = id.data;
    const C: Record<string, [number, number, number]> = {};
    for (const k of ['d0', 'd1', 'd2', 'h0', 'h1', 'h2', 'sa1', 'sa2', 'gr1', 'gr2', 'gr3', 'ro1', 'ro2', 'ro3']) C[k] = rgb(P[k] as string);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = hgt[i];
        let col: [number, number, number];
        if (v < -14) {
          const q = vn(x / 14, y / 3.2, 21);
          col = q > 0.75 ? C.d2 : q < 0.2 ? C.d0 : C.d1;
        } else if (v < -5) col = v > -9 ? C.h2 : C.h1;
        else if (v < 0) col = C.h2;
        else {
          const kind = islands[own[i]]?.kind;
          const rocky = kind === 'islet' || kind === 'bureau';
          if (v < 3.5) col = C.sa2;
          else if (rocky) col = vn(x / 4, y / 4, 31) > 0.55 ? C.ro3 : C.ro2;
          else {
            const q = vn(x / 6, y / 6, 11);
            col = q < 0.3 ? C.gr1 : q > 0.7 ? C.gr3 : C.gr2;
          }
        }
        const j = i * 4;
        D[j] = col[0];
        D[j + 1] = col[1];
        D[j + 2] = col[2];
        D[j + 3] = 255;
      }
    c.putImageData(id, 0, 0);
    return cv;
  }

  /** 格子的状态变了就重拼那一格：已探索 = 正常颜色 + 格角一个小点；可探索 = 降一档；迷雾里的也画降一档（雾盖着） */
  private syncTiles(): void {
    const s = this.state;
    const ctx = this.terrain.context;
    let changed = false;
    for (let ty = 0; ty < s.height; ty++)
      for (let tx = 0; tx < s.width; tx++) {
        const i = ty * s.width + tx;
        const seen = s.seen[i] ? 1 : 0;
        const lit = s.lit[i] > 0 ? 1 : 0;
        if (this.seenCopy[i] === seen && this.litCopy[i] === lit) continue;
        this.seenCopy[i] = seen;
        this.litCopy[i] = lit;
        changed = true;
        ctx.drawImage(seen ? this.normal : this.unseen, tx * T, ty * T, T, T, tx * T, ty * T, T, T);
        if (seen && this.R.hgt[ty * T * this.R.w + tx * T] < -5) px(ctx, DAY, 'line', tx * T, ty * T);
      }
    if (changed) {
      this.terrain.refresh();
      this.updateFogTarget();
    }
  }

  /** 雾的目标浓度：没照亮的格子是浓雾（过不去），照亮的边上有一圈薄雾 */
  private updateFogTarget(): void {
    const s = this.state;
    const W = s.width;
    const H = s.height;
    let g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = s.lit[i] > 0 ? 0 : 1;
    // 两次 3×3 模糊，边缘变成过渡
    for (let pass = 0; pass < 2; pass++) {
      const o = new Float32Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let sum = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const X = Math.min(W - 1, Math.max(0, x + dx));
              const Y = Math.min(H - 1, Math.max(0, y + dy));
              sum += g[Y * W + X];
              n++;
            }
          o[y * W + x] = sum / n;
        }
      g = o;
    }
    const pw = this.pw;
    const ph = this.ph;
    const target = new Float32Array(pw * ph);
    for (let y = 0; y < ph; y++) {
      const fy = Math.min(H - 1.001, Math.max(0, y / T - 0.5));
      const y0 = Math.floor(fy);
      const ay = fy - y0;
      for (let x = 0; x < pw; x++) {
        const fx = Math.min(W - 1.001, Math.max(0, x / T - 0.5));
        const x0 = Math.floor(fx);
        const ax = fx - x0;
        const a = g[y0 * W + x0] * (1 - ax) + g[y0 * W + x0 + 1] * ax;
        const b = g[(y0 + 1) * W + x0] * (1 - ax) + g[(y0 + 1) * W + x0 + 1] * ax;
        target[y * pw + x] = a * (1 - ay) + b * ay;
      }
    }
    const first = this.fogShown.length !== target.length;
    this.fogFrom = first ? target : this.fogShown.slice();
    this.fogTarget = target;
    this.fogShown = first ? target.slice() : this.fogShown;
    this.fogT = first ? 1 : 0;
  }

  private stepFog(dt: number): void {
    if (this.fogT >= 1) return;
    this.fogT = Math.min(1, this.fogT + dt / SEA_ART.fogRecede);
    const k = this.fogT * this.fogT * (3 - 2 * this.fogT);
    const A = this.fogFrom;
    const B = this.fogTarget;
    const S = this.fogShown;
    for (let i = 0; i < S.length; i++) S[i] = A[i] + (B[i] - A[i]) * k;
  }

  /** 浪花（岛周围）和水面闪光（深海）要用的点 */
  private waterFx(): void {
    const { w, h, hgt } = this.R;
    const surf: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = hgt[y * w + x];
        if (v < 0 && v > -6) surf.push(x, y, v, vn(x / 7, y / 7, 72));
      }
    const glints: number[] = [];
    for (let k = 0; glints.length / 3 < 180 && k < 12000; k++) {
      const x = 4 + Math.floor(hash(k, 1, 34) * (w - 8));
      const y = 4 + Math.floor(hash(k, 2, 34) * (h - 8));
      if (hgt[y * w + x] < -20) glints.push(x, y, hash(k, 3, 34));
    }
    this.surf = Float32Array.from(surf);
    this.glints = Float32Array.from(glints);
  }

  /** 岛上的小号素材：主岛有小屋、灯塔、树；其他岛修了灯塔才有灯塔；按群系放树或石头 */
  private syncIslands(): void {
    const s = this.state;
    const sig = this.revealed()
      .map((i) => i.id + (i.buildings.lighthouse ? 'L' : '') + (i.owned ? 'O' : ''))
      .join('|');
    if (sig === this.islandSig) return;
    this.islandSig = sig;
    for (const img of this.islandImgs) img.destroy();
    this.islandImgs = [];
    const add = (key: string, x: number, y: number) => {
      const img = this.add.image(Math.round(x), Math.round(y) + 1, key).setOrigin(0.5, 1).setDepth(y);
      this.islandImgs.push(img);
      return img;
    };
    for (const isl of this.revealed()) {
      const [cx, cy] = islandCenter(isl);
      const { rx, ry } = islandSize(isl.kind);
      const seed = isl.x * 31 + isl.y * 7;
      if (isl.kind === 'home') {
        add('mhouse', cx - 8, cy + 4);
        for (const [dx, dy, k] of [[-28, -2, 'mtree'], [-20, 8, 'mtree2'], [-34, 10, 'mtree'], [14, 12, 'mtree2'], [-14, -10, 'mtree2']] as const) add(k, cx + dx, cy + dy);
      } else if (isl.kind === 'recipeVillage' || isl.kind === 'laborVillage' || isl.kind === 'bureau') {
        add('mhouse', cx - 6, cy + 3);
        add('mhouse', cx + 9, cy + 6);
      } else {
        const biome = s.islands.find((x) => x.id === isl.id)?.biome;
        const n = isl.kind === 'islet' ? 1 : 3;
        for (let k = 0; k < n; k++) {
          const a = hash(k, seed, 3) * Math.PI * 2;
          const r = 0.35 + hash(k, seed, 4) * 0.3;
          const x = cx + Math.cos(a) * rx * r;
          const y = cy + Math.sin(a) * ry * r + 3;
          add(biome === 'stone' || isl.kind === 'islet' ? 'rock' : k % 2 ? 'mtree' : 'mtree2', x, y);
        }
      }
      if (isl.buildings.lighthouse) add('mlight', cx + rx * 0.45, cy - 1);
    }
  }

  // ---------------------------------------------------------------- 按键

  protected onAction(a: Action): void {
    if (this.panelAction(a)) return;
    if (this.ctx.view.s.panel || this.fading || this.action) return;
    const store = this.ctx.store;
    const s = this.state;
    if (a === 'interact') {
      const isl = this.dockTarget();
      if (isl) this.fadeThrough(() => store.dispatch({ t: 'dock', island: isl.id }));
      return;
    }
    if (a === 'grab') {
      if (!this.crateNear()) return;
      const before = totals(s);
      if (store.dispatch({ t: 'takeCrate' }).ok) this.popGains(before);
      return;
    }
    if (a === 'fish') {
      // 跳海捕鱼：一小段动作（水花），结束时结算
      this.action = { until: this.t + 0.8 };
      this.splash(14);
      return;
    }
    if (a === 'drink') {
      store.dispatch({ t: 'drinkSea' });
      this.splash(4);
      return;
    }
    if (a === 'use') {
      // 快捷栏吃喝（海上也能用）
      const id = slotView(s.player.pack).slots[this.ctx.view.s.hotbar]?.id;
      if (id && ITEMS[id].eat) store.dispatch({ t: 'consume', from: 'pack', item: id });
    }
  }

  private popGains(before: Partial<Record<ItemId, number>>): void {
    const after = totals(this.state);
    for (const id of ITEM_ORDER) {
      const d = (after[id] ?? 0) - (before[id] ?? 0);
      if (d > 0) this.ctx.view.pop(id, '+' + d, this.rx, this.ry - 16);
    }
  }

  private rnd = (): number => hash(this.rseq++, 9, 13);

  private splash(n: number): void {
    this.parts.burst(n, this.rx + this.face * 6, this.ry - 1, ['foam', 'foam', 'e3'], { speed: 20, up: 30, g: 140, floor: this.ry, life: 0.6 }, this.rnd);
  }

  /** 能靠岸的岛：规则层认可（离得够近），并且木筏离那座岛的陆地 dockPixels 以内 */
  private dockTarget(): Island | undefined {
    const near = nearLandOf(this.R, this.rx, this.ry - 4, SA.dockPixels);
    if (near < 0) return undefined;
    const id = this.R.islands[near]?.id;
    const isl = id ? dockableIsland(this.state, id) : undefined;
    return isl && isl.discovered ? isl : undefined;
  }

  private crateNear(): boolean {
    const c = this.state.pendingCrate;
    return !!c && c.x != null && c.y != null && Math.hypot(c.x - this.rx, c.y - this.ry) <= SA.crateGrab;
  }

  // ---------------------------------------------------------------- 每帧

  update(_time: number, delta: number): void {
    if (!this.tickWorld(delta)) return;
    const dt = Math.min(delta, 100) / 1000;
    const s = this.state;
    this.rebuildSea();
    this.stepFog(dt);
    this.parts.step(dt);
    if (this.action && this.t >= this.action.until) {
      this.action = null;
      const before = totals(s);
      if (this.ctx.store.dispatch({ t: 'fishSea' }).ok) this.popGains(before);
      this.splash(8);
    }
    this.sailRaft(dt);
    this.placeCamera();
    this.updateRaftSprite();
    this.updatePrompts();
    this.updateGuide();
    this.updateLabels();
    this.fxAcc += dt;
    if (this.fxAcc >= ANIM.fxInterval) {
      this.fxAcc = 0;
      this.drawFx(this.phase.s);
    }
    this.ctx.view.s.anchors.player = { x: this.snap(this.rx, this.camX) - this.camX, y: this.snap(this.ry, this.camY) - this.camY - 4 };
    this.paintLights();
  }

  /** 木筏不能进的地方：陆地、浓雾（没照亮的格子）、地图外 */
  private blocked(x: number, y: number): 'land' | 'fog' | null {
    const s = this.state;
    for (const [dx, dy] of [[-6, 0], [6, 0], [0, -3], [0, 0]]) {
      const X = x + dx;
      const Y = y + dy;
      if (X < 0 || Y < 0 || X >= this.pw || Y >= this.ph) return 'fog';
      if (isLand(this.R, X, Y)) return 'land';
      if (!canEnter(s, Math.floor(X / T), Math.floor(Y / T))) return 'fog';
    }
    return null;
  }

  /** 木筏：有惯性，松手约 1 秒停下；撞岸、撞雾反弹 20%。每走 stepPixels 像素交给规则层一次 */
  private sailRaft(dt: number): void {
    const s = this.state;
    const v = this.ctx.view;
    const stopped = !!v.s.panel || this.fading || !!this.action || !this.ctx.store.running;
    let [ix, iy] = stopped ? [0, 0] : moveDir();
    const len = Math.hypot(ix, iy);
    if (len > 0) {
      ix /= len;
      iy /= len;
      this.vx += ix * SA.accel * dt;
      this.vy += iy * SA.accel * dt;
      if (ix) this.face = ix > 0 ? 1 : -1;
    } else {
      const k = Math.exp(-SA.drag * dt);
      this.vx *= k;
      this.vy *= k;
    }
    const max = SA.maxSpeed * (1 + SA.perSailLevel * (playerLevel(s, 'sail') - 1)) * (1 + s.bureau.upgrades.speed * BALANCE.endgame.upgrades.speed.per);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > max) {
      this.vx *= max / sp;
      this.vy *= max / sp;
    }
    if (Math.hypot(this.vx, this.vy) < 0.5 && len === 0) {
      this.vx = this.vy = 0;
      return;
    }
    const x0 = this.rx;
    const y0 = this.ry;
    const nx = this.rx + this.vx * dt;
    const bx = this.blocked(nx, this.ry);
    if (bx) {
      this.vx = -this.vx * SA.bounce;
      if (bx === 'fog') this.fogBumpAt = this.t;
    } else this.rx = nx;
    const ny = this.ry + this.vy * dt;
    const by = this.blocked(this.rx, ny);
    if (by) {
      this.vy = -this.vy * SA.bounce;
      if (by === 'fog') this.fogBumpAt = this.t;
    } else this.ry = ny;
    const moved = Math.hypot(this.rx - x0, this.ry - y0);
    if (moved > 0) {
      this.wake.push([x0, y0, this.t]);
      if (this.wake.length > SEA_ART.wakePoints) this.wake.shift();
    }
    this.stepAcc += moved;
    // 规则层：每 stepPixels 像素推进一次时间、检定一次事件
    while (this.stepAcc >= SA.stepPixels) {
      this.stepAcc -= SA.stepPixels;
      const r = this.ctx.store.dispatch({ t: 'sail', x: this.rx, y: this.ry });
      if (!r.ok) break;
      if (s.player.at) return;
    }
  }

  private placeCamera(): void {
    this.placeCameraOn(this.rx, this.ry - 8, this.pw, this.ph);
  }

  private updateRaftSprite(): void {
    const bob = Math.hypot(this.vx, this.vy) < 2 ? Math.round(Math.sin(this.t * 1.8) * 1) : 0;
    this.raft.setPosition(this.snap(this.rx, this.camX), this.snap(this.ry, this.camY) + bob);
    this.raft.setFlipX(this.face < 0);
    this.raft.setDepth(this.ry);
    // 船上有几位同伴就换哪张图（mraft / mraft1–3）
    const n = Math.min(3, this.state.player.aboard.length);
    const key = n ? 'mraft' + n : 'mraft';
    if (this.raft.texture.key !== key) this.raft.setTexture(key);
    const c = this.state.pendingCrate;
    if (c && c.x != null && c.y != null) {
      this.crate.setVisible(true).setPosition(Math.round(c.x), Math.round(c.y) + Math.round(Math.sin(this.t * 2.2))).setDepth(c.y);
    } else this.crate.setVisible(false);
  }

  /** 按键提示：警告 > E 靠岸 > F 捞 > X / Z，最多 3 条 */
  private updatePrompts(): void {
    const v = this.ctx.view;
    const s = this.state;
    const out: Prompt[] = [];
    if (this.t - this.fogBumpAt < SA.fogWarnSeconds) out.push({ key: '!', label: m('sea.fogBlock'), ok: false, warn: true });
    const isl = this.dockTarget();
    if (isl) out.push({ key: 'E', label: m('act.dock', { isl: m('island.' + isl.id) }), ok: true });
    if (this.crateNear()) out.push({ key: 'F', label: m('act.grab'), ok: true });
    if (this.action) {
      v.setIfChanged('prompts', [{ key: 'X', label: m('act.diving'), ok: true }]);
      return;
    }
    if (out.length < 3) out.push({ key: 'X', label: m('act.fishSea'), ok: true });
    if (out.length < 3 && s.unlocks.includes('vitals')) out.push({ key: 'Z', label: m('act.drinkSea'), ok: true });
    v.setIfChanged('prompts', out.slice(0, 3));
    v.setIfChanged('focus', null);
    v.s.anchors.promptBelow = false;
  }

  /** 引导：指向要去的岛 */
  private updateGuide(): void {
    const s = this.state;
    const step = currentGuide(s);
    const v = this.ctx.view;
    let id: string | null = null;
    if (step && !v.s.panel) id = step.target.kind === 'island' ? step.target.id : step.at ?? null;
    if (!id && s.player.target) id = s.player.target;
    const isl = id ? s.islands.find((x) => x.id === id && x.revealed) : undefined;
    this.setUiTarget(null);
    if (!isl) return this.pointAt(null, 0, 0, 0);
    const [cx, cy] = islandCenter(isl);
    this.pointAt(cx, cy - islandSize(isl.kind).ry - 6, this.rx, this.ry);
  }

  /** 已发现的岛在画面里显示名字 */
  private updateLabels(): void {
    const s = this.state;
    const v = this.ctx.view;
    const list = s.islands.filter((i) => i.revealed && i.discovered).map((i) => ({ id: i.id, dim: !isLit(s, i.x, i.y) }));
    v.setIfChanged('labels', list);
    const pos: Record<string, { x: number; y: number }> = {};
    for (const i of s.islands) {
      if (!i.revealed || !i.discovered) continue;
      const [cx, cy] = islandCenter(i);
      pos[i.id] = { x: cx - this.camX, y: cy + islandSize(i.kind).ry + 4 - this.camY };
    }
    v.s.anchors.labels = pos;
  }

  // ---------------------------------------------------------------- 画面特效（按世界坐标）

  private drawFx(strength: number): void {
    const [cx, cy] = this.fxOrigin();
    const t = this.t;
    const P = DAY;
    const W = VIEW.w + FX_PAD * 2;
    const H = VIEW.h + FX_PAD * 2;

    // 岛周围的浪花、深海的闪光、木筏的尾迹
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
      if (Math.sin(h * 0.9 - t * ANIM.surfPhase + n * 7) > 0.8 || (h > -1.5 && Math.sin(t * ANIM.surfSparkle + S[i] * 0.21 + n * 5) > -0.2)) u.fillRect(x, y, 1, 1);
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
    for (const [x, y, born] of this.wake) {
      const age = (t - born) / SEA_ART.wakeSeconds;
      if (age > 1) continue;
      if (age > 0.6 && (Math.round(x) + Math.round(y)) & 1) continue;
      px(u, P, 'foam', Math.round(x - cx) - 1, Math.round(y - cy) - 1, 2, 1);
    }
    this.under.tex.refresh();
    this.under.img.setPosition(cx, cy);

    // 海鸥、水花
    const c = this.over.tex.context;
    c.clearRect(0, 0, W, H);
    const gk = Math.floor(t * ANIM.gullFps) % 2 ? 'gull1' : 'gull2';
    const g1 = this.textures.get(gk).getSourceImage() as HTMLCanvasElement;
    const vx = this.camX - cx;
    const vy = this.camY - cy;
    c.drawImage(g1, Math.round(vx + ((t * 15) % 560) - 40), Math.round(vy + 60 + Math.sin(t * 1.1) * 6));
    this.parts.draw(c, P, cx, cy);
    this.over.tex.refresh();
    this.over.img.setPosition(cx, cy);

    // 雾
    paintFog(this.fogImg, this.fogShown, this.pw, this.ph, cx, cy, t);
    this.fog.tex.context.putImageData(this.fogImg, 0, 0);
    this.fog.tex.refresh();
    this.fog.img.setPosition(cx, cy);

    // 灯光：木筏的提灯、各岛的灯塔和光束
    const spots: Spot[] = [];
    const beams: Beam[] = [];
    const Sp = allSprites();
    const lan = Sp.mraft.meta.lantern as [number, number];
    spots.push([this.rx - (Sp.mraft.w >> 1) + (this.face < 0 ? Sp.mraft.w - 1 - lan[0] : lan[0]), this.ry - Sp.mraft.h + 1 + lan[1], LIGHTS.lantern * strength]);
    const lamp = Sp.mlight.meta.lamp as [number, number];
    for (const img of this.islandImgs) {
      if (img.texture.key !== 'mlight') continue;
      const lx = img.x - (Sp.mlight.w >> 1) + lamp[0];
      const ly = img.y - Sp.mlight.h + lamp[1];
      spots.push([lx, ly, LIGHTS.lighthouse * strength]);
      if (strength >= LIGHTS.beam.minStrength) beams.push([lx, ly, LIGHTS.beam.length * strength, (t / LIGHTS.beam.secondsPerTurn) * Math.PI * 2 + lx * 0.01, LIGHTS.beam.halfAngle]);
    }
    this.spots = spots;
    this.beams = beams;
  }
}
