# 2D 版技术文档

这份文档描述 2D 版**现在的实现**：模块怎么分、数据怎么流、每个系统用什么办法做。设计目标和玩法规则看 `docs/2d-design.md`，MOD 看 `docs/mods.md`。

**每次改动代码，都在同一个提交里更新这份文档**（新模块、换了做法、加了约定都要写进来）。目的是让后来的人用同一套办法做事，不要每处各写一套。

---

## 1. 分层

```
config/   数值和内容数据（BALANCE、物品、配方、岛屿、地图模板 maps.ts、物体定义 buildings.ts、画面参数 visual.ts）
art/      调色板、换色表、程序精灵（纯函数，只有 draw.ts 用 DOM canvas）
world/    岛屿地图生成：地形、可走遮罩、固定物体、采集点候选位置（纯 TS）
sim/      规则层：GameState、dispatch(命令)、时间推进、生存、经济、引导（不依赖 Phaser / DOM，不产出文字）
mod/      MOD 注册表（预留）
store/    GameStore（规则状态、时间、存档）+ ViewStore（界面临时状态）
game/     Phaser：场景、渲染、输入
ui/       React DOM：HUD、面板、弹窗、欢迎页
i18n/     中英词典
```

依赖方向只能往上：`ui`、`game` → `store` → `sim` → `world` → `art`、`config`。`sim` 和 `world` 能在 Vitest 里直接跑。

## 2. 一帧里发生什么

`IslandScene.update(time, delta)`：

1. `store.hold('panel', …)`：菜单、帮助打开时暂停时间。
2. `store.frame(delta)`：把现实时间换成游戏分钟，满 1 分钟才调 `advance()`，再 `updateUnlocks()`（HUD 元素逐步出现、引导推进）。
3. 点阵过渡、死亡检测、动作计时（到点就 `dispatch` 采集命令）、采集动画、粒子。
4. 走路（连续坐标）、镜头、人物精灵。
5. 选中面前的物体、按键提示、初见介绍、引导箭头。
6. `syncObjects()`：按存档同步今天的树和草药（长出、变树桩、清掉）。
7. 昼夜：`phaseAt(当天分钟)` → 着色器的换色表。
8. 每 1/30 秒重画特效层（按世界坐标）：浪花、水纹、火苗、炊烟、海鸥、粒子、雾；灯光遮罩每帧按镜头重画。

界面层（React）订阅两个 store：`useGame()`（规则状态变化时重渲染）和 `useView()`（面板、提示变化时重渲染）。每帧都变的位置（人物在屏幕上的坐标）放在 `view.s.anchors` 里，`WorldLayer` 用 requestAnimationFrame 直接改样式，不触发 React 重渲染。

## 3. 状态

`GameState`（`sim/types.ts`）必须能 JSON 序列化。2D 版新增：

| 字段 | 内容 |
| --- | --- |
| `walk` | 人物在岛上的位置（像素，脚底中点）、朝向、累计走过的距离。画面层每帧写回 |
| `guide` | 第一天脚本走到第几步；状态条介绍看过没有 |
| `intros` | 出现过初见介绍的物体种类 |
| `forage` / `forageSeq` | 每座岛今天的树和草药丛（位置、精灵、还能采几次） |
| `mods` | 开局时加载的 MOD |

存档：`sim/save.ts`，`SAVE_VERSION = 2`，键 `foghaul2d.save.v1`。改结构就提升版本并在 `migrate()` 里写迁移，同时加一条读旧档的测试（见 `tests/guide2d.test.ts`）。

界面临时状态（不存档）在 `store/view.ts` 的 `ViewState`：开着的面板、选中的物体、按键提示、初见介绍、正在做的动作、快捷栏选中格、“+1”、调试用的画面时刻。

## 4. 地图与物体

- **模板**：`config/maps.ts`。岛的椭圆、小路、农田、码头、浅滩方向、出生点、固定物体、采集点区域、外圈雾。
- **生成**：`world/island.ts`
  - `layout(id, seed)`：固定物体（带碰撞底座 `foot` 和互动范围 `hit`）、码头、木筏停靠点。便宜，规则层也用。
  - `raster(id, seed)`：每像素的地形类别、高度、离小路距离、可走遮罩、外圈雾浓度，另存一份 16 像素格的可走记录。只给画面层用（生成一次约 0.1 秒，按种子缓存）。
  - `forageSpots(id, seed, kind)`：树 / 草药可以长在哪些位置。
  - `fenceRects(t)`：农田围栏挡路的范围。
- **物体定义**：`config/buildings.ts` 的 `OBJ_DEFS`（精灵名 → 种类、底座、互动范围）。新物体先在这里登记。
- **一座岛上的全部物体**：`sim/interact.ts` 的 `objectsOn(state, island)` = 模板里固定的 + 今天的采集点（`nodeObject` 把采集点变成物体，采完的变成树桩 / 空草丛，只是装饰）。规则层和画面层都只用这一个函数。

## 5. 碰撞

人物脚下是一个 8×3 的框（`world/island.ts` 的 `FEET`）。能不能站：

1. `canStand(raster, x, y)`：地形（沙滩以上、码头）+ 固定物体的底座 + 围栏；
2. 场景里的 `canWalk()` 再加上今天采集点的底座（它们每天变，不进缓存的 raster）。

**规则：看起来挡路的东西就必须挡路，四条边都要对齐画面。** 新加会挡路的东西时，同时检查碰撞和遮挡（见第 7 节）。

## 6. 走路和镜头

- **画布按屏幕分辨率渲染**：画布 480k × 270k（k 为放大倍数），镜头 `setZoom(k)`。像素块大小不变，但人物和镜头可以移动 1/k 游戏像素，所以走路顺滑。不要回到“480 × 270 画布再用 CSS 放大”，那样只能整像素移动，斜着走必然一顿一顿。
- `IslandScene.walk()`：连续坐标，方向归一化，任何方向都是 `BALANCE.interact.walkSpeed` 像素/秒（斜着走不会更快）。分两个方向分别检查碰撞，撞墙时沿墙滑。斜着走的朝向取左右。
- `placeCamera()`：镜头左上角 `camX`、`camY`（游戏像素，对齐到 1/k），在地图边缘停住，用 `centerOn` 摆镜头。需要“镜头在哪”时一律用 `camX`、`camY`，不要读 `cam.scrollX`（缩放后两者不一样）。

## 7. 渲染

### 调色板和昼夜

- 所有精灵、地形按**白天调色板**烘焙成纹理（`art/draw.ts`、`game/world/terrain.ts`）。
- 镜头挂一个后处理着色器 `game/render/PalettePipeline.ts`：把每个像素换回 0–11 号色，再按当前换色表上色。
- 时段之间用 `art/palette.ts` 的 `blendTable()`：每个颜色沿自己的色阶一档一档地变，全屏一起变。**不要用点阵在两张表之间混合**，那样看起来像叠了一层网格。
- 灯光遮罩（`game/render/mask.ts`）：屏幕大小的一张图，遮罩里的像素读白天那一行。
- 点阵过渡（睡觉、复活）：着色器的 `uFade`，Bayer 阈值以下的像素变成深渊色。
- HUD 里随时段变色的字：`Hud.tsx` 用同一个 `blendTable` 改 `--w*` 变量。

### 前后遮挡（深度）

- 世界里的东西都是 Phaser 图片，**深度 = 底边 y**（人物是脚底 y）。
- 贴在物体上的动画（篝火火苗、亮着的窗）用单独的小图，深度 = 物体底边 y + 0.1，跟着物体排序。
- 只有“天上”的东西画在最上层的屏幕特效层：炊烟、海鸥、粒子、鱼线、雾。**不要把贴在地上的东西画进最上层**，会盖住站在前面的人物。
- 地面装饰（草丛、小花、贝壳、码头木板、小路）画进地形大图；有高度的东西（围栏、木牌、树）一定是排序的精灵。
- 特效层（`fx_under` 在地形和物体之间，`fx_over`、`fx_fog` 在最上面）是比画面每边大 `FX_PAD` 像素的画布，**按世界坐标摆放**：每 1/30 秒以镜头左上角取整为原点重画，画完把图片摆到那个世界位置。两次重画之间它跟着世界动。不要把特效画布贴在屏幕上（`setScrollFactor(0)`），否则镜头一动浪花和雾就会来回“游”，看久了头晕。
- 灯光遮罩和屏幕对齐（着色器按屏幕坐标读），所以每帧重画：按镜头左上角取整画在 481 × 271 的画布上，镜头的小数部分作为 `uMaskOff` 交给着色器，灯光边缘不会随镜头移动闪烁。
- 着色器里的点阵（黑屏过渡）按游戏像素排：`gl_FragCoord / uScale`。
- 雾两层噪声朝同一个方向慢慢飘（`FOG.driftX/driftY/layer2`）；浪花推进和闪烁也放慢（`ANIM.surfPhase/surfSparkle`）。大面积运动要慢、要同向。

### 程序美术

- 精灵用角色名网格（`art/grid.ts` 的 `G`）画：`材质 + 明暗档`（如 `w2`），或 `iN` 直接用 N 号色；`z` 是棋盘格影子；`~` 开头的不描边。
- 新精灵写在 `art/sprites.ts`，登记到 `art/draw.ts` 的 `allSprites()`。需要选中描边的物体，Boot 场景会自动生成 `<名字>_hl`。
- 颜色只能是 12 色；暖色（8–11）只给人造的东西和火光。

## 8. 互动

- **选中**：每帧在人物 16 像素内、按朝向前方最近的一个物体（`updateFocus`）。选中的东西描灯芯色轮廓。
- **能做什么**：`sim/interact.ts` 的 `interactInfo(state, obj)` 返回按键提示文字、能不能做、做不了的原因。界面不自己判断。
- **校验**：`dispatch` 里 `positionError()` 检查命令需要的物体在不在旁边（`objectFor()` 登记命令 → 物体种类）。测试和脚本玩家用 `approach()` 瞬移过去。
- **动作**：采集类先播放动画（`ANIM.actionSeconds`），时间到了才 `dispatch`；Esc 中断不结算。建筑类直接打开面板。
- **提示的位置**：按键提示在人物头顶；选中的东西在人物上方时放到脚下。初见介绍卡在物体上方；物体比人物低时放到物体旁边。**提示和卡片不能挡住人物和它要互动的东西。**

## 9. 采集点（树、草药）

`sim/forage.ts`：

- 开局 `initForage()` 按 `BALANCE.forage.<kind>.start` 长出；每天早上（`advance` 的整点钩子，06:00）`dailyForage()` 清掉采完的，再长 `perDay` 个，不超过 `max`。
- 位置从 `forageSpots()` 里用存档的随机数（`sim/rng.ts`）挑，彼此间隔 `BALANCE.forage.spacing`，不长在人物脚下。
- 采集命令采的是人物身边那一个（`nearNode()`），`left` 减到 0 就变成树桩 / 空草丛。
- 只影响玩家手动采集；岛上设施的生产在 `sim/economy.ts`，不读这些。

## 10. 背包和仓库

`sim/inventory.ts`：背包 `BALANCE.inventory.packCap` 格、货舱 `player.holdCap` 格；每格一种东西，堆叠上限 `stackOf()`（能吃喝用的 10，其他 20）；零件不占格。`roomIn()` 算还能放多少，`slotView()` 把容器排成格子给界面画。岛上仓库不按格子：每种物品上限 `stockCap()`。

## 11. 引导

- HUD 元素逐步出现：`sim/tutorial.ts` 的 `FEATURES`，界面用 `has(state, id)`。
- 第一天脚本：`sim/guide.ts` 的 `GUIDE`（目标对象、说明、完成条件），`currentGuide()` 给 HUD 和画面层用；18:00 以后插入 `NIGHT_STEP`。
- 画面层：目标物体头顶跳动的箭头，不在屏幕里时屏幕边缘显示方向和格数。

## 12. 界面

- 所有尺寸 = 游戏内像素 × `--k`（画面放大倍数）。字体 Fusion Pixel 12px。
- 颜色只用 `global.css` 的 `--c0`–`--c11` 和随时段变化的 `--w*`。
- 面板同一时间只开一个（`view.s.panel`），Esc 关闭。面板组件在 `ui/panels/Panels.tsx`，外框 `Panel.tsx`。
- 物品显示用 `<ItemName>`、`<Slot>`（`ui/components/Item.tsx`），快捷栏格子标数字键。

## 13. 输入

`game/input/keys.ts`：窗口级监听。移动键记按住状态（`moveDir()`），其他键发一次性动作（`onAction()`）。按钮也可以 `fire(action)` 触发同样的动作（以后的手机按键用这个）。

## 14. 测试与调试

- `npm test`：规则、地图可达性、采集点、引导、存档迁移、MOD 注册、i18n、自动通关。
- `npm run test:smoke`：Playwright 打开打包后的页面玩一段并截白天 / 黄昏 / 夜晚三张图。改了画面要跑。
- 截图检查要看的：人物被不被盖住、提示挡不挡东西、颜色和背景分不分得清、夜里有没有网格感。
- 控制台：`foghaul.state`（改完 `foghaul.bump()`）、`foghaulView.set({ debugMinute })`、`foghaulGame`。

## 15. 常见改动怎么做

| 想做 | 步骤 |
| --- | --- |
| 加一种可互动的物体 | `OBJ_DEFS` 登记种类和范围 → `sprites.ts` 画精灵、`allSprites()` 登记 → `interact.ts` 的 `interactInfo` 写按 E 做什么，需要校验位置就在 `objectFor` 登记 → 场景 `interact()` 里打开面板或开始动作 → 词典加 `thing.<种类>`、`intro2d.<种类>`、按键提示文字 → 测试 |
| 加一座岛的地图 | `config/maps.ts` 加模板 → `tests/island2d.test.ts` 加进可达性检查 |
| 改昼夜颜色 | `config/visual.ts` 的 `PHASES`；不要改着色器的做法 |
| 加一种可采集物 | `ForageKind`、`BALANCE.forage`、模板的 `forage` 区域、`OBJ_DEFS`、`gather` 命令 |
| 改存档结构 | 提升 `SAVE_VERSION`，`migrate()` 写迁移，加读旧档测试，更新本文第 3 节 |
