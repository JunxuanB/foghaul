// 把角色名网格画到 canvas（需要 DOM）。画面层用白天调色板烘焙，昼夜靠换色着色器。
import type { G } from './grid';
import { ICONS } from './icons';
import { DAY, type Pal } from './palette';
import * as S from './sprites';
import { MOD_SPRITES } from '../mod/registry';

export const mkCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** 把精灵按底边中点 (bx, by) 盖到 ctx 上 */
export function stamp(ctx: CanvasRenderingContext2D, g: G, bx: number, by: number, P: Pal = DAY): void {
  const x0 = bx - (g.w >> 1);
  const y0 = by - g.h + 1;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      let r = g.d[y * g.w + x];
      if (!r) continue;
      if (r[0] === '~') r = r.slice(1);
      const c = P[r];
      if (c == null) continue;
      const X = x0 + x;
      const Y = y0 + y;
      if (typeof c === 'object') {
        if (((X + Y) & 1) !== 0) continue;
        ctx.fillStyle = c.on;
      } else ctx.fillStyle = c;
      ctx.fillRect(X, Y, 1, 1);
    }
}

/** 单个像素或矩形，按角色名取色 */
export function px(c: CanvasRenderingContext2D, P: Pal, role: string, x: number, y: number, w = 1, h = 1): void {
  const v = P[role];
  if (v == null || typeof v === 'object') return;
  c.fillStyle = v;
  c.fillRect(x, y, w, h);
}

export function gridCanvas(g: G, P: Pal = DAY): HTMLCanvasElement {
  const cv = mkCanvas(g.w, g.h);
  stamp(cv.getContext('2d')!, g, g.w >> 1, g.h - 1, P);
  return cv;
}

// ---------------------------------------------------------------- 精灵表

export const WALK_DIRS: S.Dir[] = ['down', 'side', 'up'];

let sprites: Record<string, G> | null = null;

/** 全部精灵（懒加载，生成一次） */
export function allSprites(): Record<string, G> {
  if (sprites) return sprites;
  const out: Record<string, G> = {
    tree: S.spTree(3, true),
    tree2: S.spTree(8, true),
    stree: S.spTree(11, false),
    bush: S.spBush(14),
    palm: S.spPalm(),
    house: S.spHouse(),
    light: S.spLight(),
    wreck: S.spWreck(),
    raft: S.spRaft(),
    crate: S.spCrate(),
    barrel: S.spBarrel(),
    rock: S.spRock(21, false),
    boulder: S.spRock(23, true),
    fire: S.spFire(),
    woodpile: S.spWoodpile(),
    net: S.spNetRack(),
    post: S.spPost(),
    gull1: S.spGull(true),
    gull2: S.spGull(false),
    stump: S.spStump(),
    workbench: S.spWorkbench(),
    chest: S.spChest(),
    herb: S.spHerbBush(false),
    herbEmpty: S.spHerbBush(true),
    shoal: S.spShoal(),
    sign: S.spSign(),
    lhBase: S.spLighthouseBase(),
    distiller: S.spDistiller(),
    grill: S.spGrill(),
    wheatPatch: S.spWheatPatch(),
    herbGarden: S.spHerbGarden(),
    oven: S.spOven(),
    saltPan: S.spSaltPan(),
    board: S.spBoard(),
    facilityBase: S.spFacilityBase(),
    autoStore: S.spAutoStore(),
    // 其他岛上装饰用的树（和主岛能采的树同一种画法）
    tree_d: S.spTree(5, true),
    stree_d: S.spTree(13, false),
    // 海上的小号素材
    mlight: S.spMiniLight(),
    mhouse: S.spMiniHouse(),
    mtree: S.spMiniTree(5),
    mtree2: S.spMiniTree(9),
    mraft: S.spMiniRaft(),
    mraft1: S.spMiniRaft(1),
    mraft2: S.spMiniRaft(2),
    mraft3: S.spMiniRaft(3),
    float: S.spFloat(),
  };
  for (const id of Object.keys(S.CHARS))
    for (const dir of WALK_DIRS) for (let f = 0; f < 4; f++) out[`ch_${id}_${dir}_${f}`] = S.spChar(S.CHARS[id], dir, f);
  for (const k of Object.keys(ICONS)) out['ic_' + k] = ICONS[k];
  // MOD 加的精灵（名字带 `<modId>:` 前缀，不会和内置的重名）
  for (const [k, make] of Object.entries(MOD_SPRITES)) out[k] = make();
  return (sprites = out);
}

const iconUrls: Record<string, string> = {};

/** 物品图标的 dataURL（DOM 界面用） */
export function iconURL(id: string): string {
  if (iconUrls[id]) return iconUrls[id];
  const g = ICONS[id];
  if (!g) return '';
  return (iconUrls[id] = gridCanvas(g).toDataURL());
}

export function charURL(id: string, dir: S.Dir = 'down'): string {
  const k = `ch_${id}_${dir}_0`;
  if (iconUrls[k]) return iconUrls[k];
  return (iconUrls[k] = gridCanvas(allSprites()[k]).toDataURL());
}

/** 任意精灵（建筑、木筏……）的 dataURL，面板里当“图”用 */
export function spriteURL(name: string): { url: string; w: number; h: number } {
  const g = allSprites()[name];
  if (!g) return { url: '', w: 0, h: 0 };
  const k = 'sp_' + name;
  if (!iconUrls[k]) iconUrls[k] = gridCanvas(g).toDataURL();
  return { url: iconUrls[k], w: g.w, h: g.h };
}
