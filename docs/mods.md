# MOD（插件）设计与预留

现在还不能加载外部 MOD，但代码已经按“以后能加 MOD”的方式组织。这份文档说明已经预留了什么、MOD 能改什么不能改什么，以及以后真正开放 MOD 还差哪些工作。改动内容注册方式、存档格式、命令时，回来更新这份文档。

## 原则

1. **MOD 只加数据，不加规则代码。** 精灵、物体定义、地图模板、文字都是数据；玩法行为只能通过已有的 `dispatch(state, command)` 命令发生。这样存档可复现、自动通关测试依然有效。
2. **命名空间。** MOD 新加的 id（精灵名、物体名、地图 id、文字键）都要以 `<modId>:` 开头，比如 `more-trees:pine`。不能覆盖内置内容，也不能覆盖别的 MOD。
3. **要么全加，要么不加。** `registerMod()` 先检查所有内容，任何一项不合格就抛 `ModError`，什么都不加。
4. **中英文同时给。** MOD 的文字两种语言要有同样的键。
5. **存档记下 MOD。** 新开的一局在 `state.mods` 记录 `id@版本`；以后读档时用它提示缺了哪个 MOD。
6. **随机只用 `sim/rng.ts`，颜色只用 12 色。** MOD 的精灵用角色名网格（`art/grid.ts`）画，昼夜换色自动生效。

## 已经预留的

| 位置 | 作用 |
| --- | --- |
| `src/mod/registry.ts` | `registerMod(manifest)`、`ModManifest` 类型、`MOD_SPRITES`、`MOD_STRINGS`、`LOADED_MODS`、`modIds()` |
| `src/art/draw.ts` 的 `allSprites()` | 合并 `MOD_SPRITES`，启动时和内置精灵一起烘焙成纹理 |
| `src/i18n/index.ts` 的 `t()` | 内置词典查不到时查 `MOD_STRINGS` |
| `src/config/buildings.ts` 的 `OBJ_DEFS` | MOD 的物体定义直接合并进来（种类、碰撞底座、互动范围） |
| `src/config/maps.ts` 的 `MAPS` | MOD 的地图模板直接合并进来 |
| `GameState.mods` | 这一局加载了哪些 MOD |
| `tests/mods.test.ts` | 注册、命名空间检查、全加或不加 |

MOD 清单的样子：

```ts
registerMod({
  id: 'more-trees',
  name: 'More Trees',
  version: '1.0.0',
  content: {
    sprites: { 'more-trees:pine': () => /* 返回一个 G 网格 */ },
    objects: { 'more-trees:pine': { kind: 'tree', foot: { x: -4, y: -5, w: 8, h: 5 } } },
    strings: { zh: { 'more-trees:hello': '你好' }, en: { 'more-trees:hello': 'Hello' } },
  },
});
```

`registerMod` 必须在游戏开始之前调用（精灵在 Boot 场景里烘焙，地图在第一次用到时生成并缓存）。

## 还不能做的（以后开放 MOD 前要做）

- **物品、配方、岛屿、村落请求**现在是 TypeScript 的联合类型和常量表（`ItemId`、`RecipeId`、`ISLANDS`），MOD 加不进去。要开放这部分，需要把它们改成按字符串 id 注册的表，并给存档加迁移。
- **采集点种类**（`ForageKind = 'tree' | 'herb'`）和 `BALANCE.forage` 是固定的；改成注册表后 MOD 才能加新的可采集物。
- **加载方式**还没定：候选是“JSON 数据 + PNG 精灵包”从文件选择框或网址导入。在定下沙箱方案之前，不加载任意 JS。
- **事件钩子**（每天早上、靠岸、交付之类）没有开放。如果以后需要，只能是只读的通知，或者返回新的命令交给 `dispatch`，不能直接改状态。
- **读档检查**：读到记录了 MOD 的存档时，如果缺 MOD，应该提示并拒绝加载（现在只记录，不检查）。

## 写新代码时为 MOD 留路

- 新内容放进 `src/config/` 的表里，用字符串 id 查，不要在逻辑里写死某个 id。
- 新的精灵放进 `allSprites()`，新的物体种类放进 `OBJ_DEFS`，按 E 的行为写在 `sim/interact.ts`。
- 新的文字一定走词典，界面不拼死中文或英文。
- 需要遍历“所有某种东西”时遍历表，而不是写一串 `if`。
