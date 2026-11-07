// MOD（插件）预留：内容注册表。现在只有内置内容，以后的 MOD 通过 registerMod() 往这些表里加东西。
// 设计和限制见 docs/mods.md。规则：
// - MOD 只加“数据”（精灵、物体、地图模板、文字），行为仍然只能通过 dispatch 的命令发生；
// - MOD 新加的 id 必须带前缀 `<modId>:`，不能覆盖内置内容；
// - 不依赖 Phaser / DOM，规则层和测试里都能用。
import { OBJ_DEFS, type ObjDef } from '../config/buildings';
import { MAPS, type MapTemplate } from '../config/maps';
import type { G } from '../art/grid';

export interface ModManifest {
  /** 小写字母、数字、连字符，比如 `more-trees` */
  id: string;
  name: string;
  version: string;
  content?: {
    /** 精灵：名字 → 生成函数（角色名网格，见 art/grid.ts） */
    sprites?: Record<string, () => G>;
    /** 物体定义：精灵名 → 种类、碰撞、互动范围 */
    objects?: Record<string, ObjDef>;
    /** 岛屿地图模板 */
    maps?: Record<string, MapTemplate>;
    /** 文字：两种语言要给同样的键 */
    strings?: { zh: Record<string, string>; en: Record<string, string> };
  };
}

/** MOD 加的精灵（art/draw.ts 的 allSprites 会合并进去） */
export const MOD_SPRITES: Record<string, () => G> = {};
/** MOD 加的文字（i18n 查不到内置键时查这里） */
export const MOD_STRINGS: { zh: Record<string, string>; en: Record<string, string> } = { zh: {}, en: {} };
/** 已加载的 MOD（按加载顺序） */
export const LOADED_MODS: ModManifest[] = [];

const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;

export class ModError extends Error {}

/** 加载一个 MOD 的内容。出错时什么都不加，抛 ModError */
export function registerMod(mod: ModManifest): void {
  if (!ID_RE.test(mod.id)) throw new ModError(`bad mod id: ${mod.id}`);
  if (LOADED_MODS.some((m) => m.id === mod.id)) throw new ModError(`mod already loaded: ${mod.id}`);
  const c = mod.content ?? {};
  const prefix = mod.id + ':';
  const keys = (o?: Record<string, unknown>) => Object.keys(o ?? {});
  // 先全部检查，再一起加，保证要么全加要么都不加
  for (const k of [...keys(c.sprites), ...keys(c.objects), ...keys(c.maps)]) {
    if (!k.startsWith(prefix)) throw new ModError(`${mod.id}: id must start with "${prefix}": ${k}`);
  }
  for (const k of keys(c.sprites)) if (MOD_SPRITES[k]) throw new ModError(`${mod.id}: sprite exists: ${k}`);
  for (const k of keys(c.objects)) if (OBJ_DEFS[k]) throw new ModError(`${mod.id}: object exists: ${k}`);
  for (const k of keys(c.maps)) if (MAPS[k]) throw new ModError(`${mod.id}: map exists: ${k}`);
  if (c.strings) {
    const a = keys(c.strings.zh).sort().join('|');
    const b = keys(c.strings.en).sort().join('|');
    if (a !== b) throw new ModError(`${mod.id}: zh and en strings must have the same keys`);
    for (const k of keys(c.strings.zh)) if (!k.startsWith(prefix)) throw new ModError(`${mod.id}: string key must start with "${prefix}": ${k}`);
  }
  Object.assign(MOD_SPRITES, c.sprites ?? {});
  Object.assign(OBJ_DEFS, c.objects ?? {});
  Object.assign(MAPS, c.maps ?? {});
  if (c.strings) {
    Object.assign(MOD_STRINGS.zh, c.strings.zh);
    Object.assign(MOD_STRINGS.en, c.strings.en);
  }
  LOADED_MODS.push(mod);
}

/** 存档里记的 MOD 列表（以后读档时用来提示缺了哪个 MOD） */
export function modIds(): string[] {
  return LOADED_MODS.map((m) => `${m.id}@${m.version}`);
}
