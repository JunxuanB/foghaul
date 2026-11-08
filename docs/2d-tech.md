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

## 2. 场景和一帧里发生什么

两个场景：`IslandScene`（岛上走路）和 `SeaScene`（海上划木筏），都继承 `game/scenes/WorldScene.ts`。共用的事情只在 `WorldScene` 里写一次：镜头（`placeCameraOn`、`snap`）、特效画布（`fxCanvas`、`fxOrigin`）、灯光遮罩（`paintLights`）、换色着色器、点阵过渡（`fadeThrough`，进场景时自动从黑亮起）、昼夜（`this.phase`）、全局按键（`panelAction`：Tab / J / H / M / Esc / 1–5）、引导的边缘箭头（`pointAt`）、**切换场景**。

切换场景的规则只有一条：`state.player.at` 和场景对不上就换（`at` 为 null 是海上，否则是那座岛）。所以靠岸、出海、死后在床边醒来都不需要专门写切换：先 `fadeThrough(() => dispatch(...))`，下一帧 `tickWorld` 发现对不上就 `scene.start`。新场景开始时清掉上一个场景的临时界面（介绍卡、按键提示、岛名）。

`IslandScene.update(time, delta)`（`SeaScene` 一样，先调 `tickWorld`）：

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
| `raft` | 木筏在海面上的像素位置（`player.x / y` 仍是它所在的格子） |
| `lastFight` | 最近一次海上战斗（界面显示一张小卡片） |
| `pendingCrate.x / y` | 漂流物在海面上的位置 |

存档：`sim/save.ts`，`SAVE_VERSION = 6`（v6：自动入库机、`joined`、`lastDeath`，A 段四座岛按新地图重新长树和草药），键 `foghaul2d.save.v1`（v4：每座岛都长树和草药；v5：设施暂存箱 `isl.output`、`state.today`、`state.report`。旧档里超出新格子的东西保留，只是放不进新的）。读旧档的测试在 `tests/storage2d.test.ts`。改结构就提升版本并在 `migrate()` 里写迁移，同时加一条读旧档的测试（见 `tests/guide2d.test.ts`）。

界面临时状态（不存档）在 `store/view.ts` 的 `ViewState`：开着的面板、选中的物体、按键提示、初见介绍、正在做的动作、快捷栏选中格、“+1”、调试用的画面时刻。

## 4. 地图与物体

- **模板**：`config/maps.ts`。岛的椭圆、小路、农田、码头、浅滩方向、出生点、固定物体、采集点区域、外圈雾、**槽位**（`slots`：岛上的人、灯塔、加入网络后的工作台和储物箱、请求板放在哪）。
- **哪座岛用哪个模板**：`world/templates.ts` 的 `templateFor(id)`。有专门模板（`MAPS[id]`）就用它，否则按岛的种类用 `GENERIC_MAPS` 里的通用模板（乘客岛和原住民岛 `small`、村落和进出口局 `village`、礁石 `islet`），再按群系补装饰。**每座岛都有地图**；不要再写“没有地图就沿用文字版”的分支。
- **生成**：`world/island.ts`
  - `layout(id, seed)`：固定物体（带碰撞底座 `foot` 和互动范围 `hit`）、码头、木筏停靠点。便宜，规则层也用。
  - `raster(id, seed)`：每像素的地形类别、高度、离小路距离、可走遮罩、外圈雾浓度，另存一份 16 像素格的可走记录。只给画面层用（生成一次约 0.1 秒，按种子缓存）。
  - `forageSpots(id, seed, kind)`：树 / 草药可以长在哪些位置。
  - `fenceRects(t)`：农田围栏挡路的范围。
- **物体定义**：`config/buildings.ts` 的 `OBJ_DEFS`（精灵名 → 种类、底座、互动范围）。新物体先在这里登记。
- **一座岛上的全部物体**：`sim/interact.ts` 的 `objectsOn(state, island)` = 模板里固定的 + 今天的采集点（`nodeObject`）+ 跟着存档变的（`stateObjects`：站在岛上的人 `npc@<人的 id>`、灯塔或地基、加入网络后的工作台和储物箱、请求板）。规则层和画面层都只用这一个函数。
- 画面层里，模板固定物体的底座在 Raster 的可走遮罩里；其余物体的底座每帧作为 `blockers` 单独挡路。
- 灯光、火苗、设施状态这些“画在物体上的东西”遍历 `this.objs`（全部物体），**不要只遍历 `this.L.objects`**（只有模板里固定的），否则跟着存档出现的东西（石头岛修好的灯塔）不会亮。
- 采集点：每座岛按模板的 `forage` 区域和 `forageCounts`（通用模板按群系，见 `config/maps.ts` 的 `BIOME_FORAGE`）长树和草药；渔场群系的通用模板有浅滩钓点（`GENERIC_SHOAL`）。

## 5. 碰撞

人物脚下是一个 8×3 的框（`world/island.ts` 的 `FEET`）。能不能站：

1. `canStand(raster, x, y)`：地形（沙滩以上、码头）+ 固定物体的底座 + 围栏；
2. 场景里的 `canWalk()` 再加上今天采集点的底座（它们每天变，不进缓存的 raster）。

**规则：看起来挡路的东西就必须挡路，四条边都要对齐画面。** 新加会挡路的东西时，同时检查碰撞和遮挡（见第 7 节）。

## 6. 走路和镜头

- **画面大小按窗口算**：`game/index.ts` 的 `fitView(W, H)` 选整数倍 k，让一屏大约 `VIEW_FIT.targetW` 游戏像素宽（游戏整体放大），逻辑大小 `VIEW.w × VIEW.h` 跟着窗口比例变、铺满窗口（有上下限，面板 320 × 200 要放得下；窗口太小才用小数倍）。`VIEW` 是可变的：一律读 `VIEW.w` / `VIEW.h` 的当前值，不要在模块加载时缓存。窗口变化导致逻辑大小变了，重开当前场景；按画面大小建的画布用 `WorldScene.canvasTex()`（大小不对就重建）。界面层用 `view.vw` / `view.vh`，CSS 里是 `--vw` / `--vh`（HUD 左下角的宽度按它算，不伸到快捷栏底下）。
- **画布按屏幕分辨率渲染**：画布 (VIEW.w·k) × (VIEW.h·k)，镜头 `setZoom(k)`。像素块大小不变，但人物和镜头可以移动 1/k 游戏像素，所以走路顺滑。不要回到“480 × 270 画布再用 CSS 放大”，那样只能整像素移动，斜着走必然一顿一顿。
- `IslandScene.walk()`：连续坐标，方向归一化，任何方向都是 `BALANCE.interact.walkSpeed` 像素/秒（斜着走不会更快）。分两个方向分别检查碰撞，撞墙时沿墙滑。斜着走的朝向取左右。
- `placeCamera()`：镜头左上角 `camX`、`camY`（游戏像素，对齐到 1/k），在地图边缘停住，用 `centerOn` 摆镜头。需要“镜头在哪”时一律用 `camX`、`camY`，不要读 `cam.scrollX`（缩放后两者不一样）。
- **会动的精灵绘制位置要对齐到屏幕像素**：`snap(v, cam)` = 镜头左上角 + 整数个屏幕像素。人物停在半个屏幕像素上时像素块宽窄不齐、会糊会闪。新加会动的东西（木筏、NPC）也用它。
- 所有纹理在场景创建后统一设成最近邻采样；换色着色器的渲染目标也是最近邻。
- 行走帧按走过的距离换（每 `ANIM.walkStride` 像素一帧），不按时间：帧率掉了脚步也和移动对得上，不会像在跑。

## 6.5 海上

- **海面**：`world/sea.ts` 的 `seaRaster(islands, seed, w, h)`：只画已经出现的岛，每座岛是一块小陆地加一圈浅水（大小 `SEA_ART.island`）。岛的集合变了才重算（按岛 id 和位置做缓存键）。
- **格子状态的画法**：同一张海面按两种调色板各画一次（正常 / `pal('day_u')` 降一档），`syncTiles` 按每格的 `seen` / `lit` 把对应的那一格拼到 `sea_terrain` 上；已探索的格子左上角一个小点。只有变了的格子才重拼。
- **雾**：没照亮的格子浓度 1，照亮的 0，两次 3×3 模糊后双线性放大到每像素，交给 `paintFog`。照亮的格子变了（修好灯塔）就算出新的目标浓度，`SEA_ART.fogRecede` 秒内从旧的平滑变过去——“雾当场退开”。
- **木筏**：`SeaScene.sailRaft`。加速度、最高速度（航行等级、船速升级）、阻力、反弹都在 `BALANCE.sail`。碰撞：陆地（`isLand`）、浓雾（`canEnter` 的格子）、地图外。每航行 `stepPixels` 像素发一次 `{ t: 'sail', x, y }`：规则层校验这一步合理（离上一格不超过 2 格、不在雾里），然后推进 7 分钟、标记视野、发现岛、检定海上事件（`sim/actions.ts` 的 `afterStep`，和文字版的格子移动共用）。
- **靠岸**：画面层判断木筏离哪座岛的陆地 `dockPixels` 以内（`nearLandOf`），发 `{ t: 'dock', island }`；规则层校验离岛中心不超过 `dockTiles` 格（`dockableIsland`）。出海：`leave` 用 `world/sea.ts` 的 `launchPoint` 把木筏放在岛的南边（不行就换方向），规则层和画面层算出来一样。
- **漂流物**：海上事件给的漂流物带位置（木筏旁边），F 捞；离开 `crateRange` 像素就漂走了。
- **按键**：E 靠岸、F 捞、X 跳海捕鱼（一小段动作后结算）、Z 喝海水（岛上要站在水边：`nearWater`）。
- **小号素材**：岛上的小屋、灯塔（修好才有）、树、石头按岛的种类和群系摆（`syncIslands`，岛或灯塔变了才重摆）；海上的灯塔晚上有光束。
- **岛名**：已发现的岛在画面里显示名字（`view.labels` + `anchors.labels`）。

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
- **校验**：`dispatch` 里 `positionError()` 检查命令需要的物体在不在旁边（`objectFor()` 登记命令 → 物体种类：采集、制作、存取、睡觉、种地、修飞机、交付 → 人、修灯塔 → 灯塔地基、加固货舱 → 工作台）。岛上根本没有这种物体时（比如还没有“建设地基”的床）不校验；制作例外，没有工作台就不能做。测试和脚本玩家用 `approach()` 瞬移过去（岛上喝海水会走到码头上）。
- **和人说话**：E → `talk` 面板（`view.talkTo` 是人的 id），显示要的东西、进度、身上有多少，“交付”发 `deliver`。
- **动作**：采集类先播放动画（`ANIM.actionSeconds`），时间到了才 `dispatch`；Esc 中断不结算。建筑类直接打开面板。
- **提示的位置**：按键提示在人物头顶；选中的东西在人物上方时放到脚下。初见介绍卡在物体上方；物体比人物低时放到物体旁边。**提示和卡片不能挡住人物和它要互动的东西。**

## 9. 采集点（树、草药）

`sim/forage.ts`：

- 开局 `initForage()` 按 `BALANCE.forage.<kind>.start` 长出；每天早上（`advance` 的整点钩子，06:00）`dailyForage()` 清掉采完的，再长 `perDay` 个，不超过 `max`。
- 位置从 `forageSpots()` 里用存档的随机数（`sim/rng.ts`）挑，彼此间隔 `BALANCE.forage.spacing`，不长在人物脚下。
- 采集命令采的是人物身边那一个（`nearNode()`），`left` 减到 0 就变成树桩 / 空草丛。
- 只影响玩家手动采集；岛上设施的生产在 `sim/economy.ts`，不读这些。

## 10. 背包和仓库

- **东西放到哪**：`giveToPlayer` 默认先放背包，满了放货舱，再满了放这座岛的仓库（网络里的岛）。只有“运货”的补给才点名放货舱。
- **货舱**：海上按 Tab 打开背包和货舱两栏（`Views.tsx` 的 `PackHoldBody`），可以互相搬；在岛上货舱能看不能搬，要走到码头边的**木筏**（`raft@<岛>`，人在哪座岛就停在哪座岛的码头边）旁按 E，在木筏面板里装卸、全部卸到岛上仓库、加固货舱。规则层：涉及货舱的 `transfer` 和 `build holdUpgrade` 都要在木筏旁（`objectFor`）。
- **储物箱**：右栏是储物箱的格子（`SlotGrid`，内容是 `dryStock(isl.stock)`：去掉淡水），格数 `stockSlots()`，下面一条水缸（`TankStrip`：水位条、“喝”=`consume from: 'stock', item: 'water'`、“装杯”=`fillCup`）。鼠标停过的格子在底栏显示名字和数量，能吃喝的有“吃 / 喝”按钮（要在储物箱旁）。

`sim/inventory.ts`：背包 `BALANCE.inventory.packCap` 格、货舱 `player.holdCap` 格；每格一种东西，堆叠上限 `stackOf()`（能吃喝用的 10，其他 20）；零件不占格。`roomIn()` 算还能放多少，`slotView()` 把容器排成格子给界面画。

岛上（`BALANCE.inventory.island`）：
- **储物箱**和背包同一套格子 + 堆叠：`stockSlots(state, isl)`（主岛 / 网络岛按等级，加建仓库多几格，进出口局升级按倍数）。`stockRoom(state, isl, item)` 按格子算还能放多少。
- **水缸**：散装的东西（`isBulk(item)` = 不能带走，目前只有淡水）不占格子，存在 `isl.stock` 里但上限是 `tankCap(state, isl)`。
- **设施暂存箱** `isl.output`：设施的产物先放这里，每种上限 `outputCap(isl, item)` = 等级对应的格数 × 一组。满了停工（`work.outputFull`；淡水进水缸，满了 `work.tankFull`）。命令 `collect { to: 'pack' | 'stock', item? }` 在设施旁把东西拿到背包或放进储物箱，放得下多少拿多少。
- 岛民吃饭用 `takeFromIsland()`：先储物箱、后暂存箱。加工设施的原料、运输线只用储物箱。

## 10.5 设施和岛的升级

- 加入网络、有了工作（`island.facility`）的岛，在模板的 `slots.facility` 位置出现设施建筑（`facility@<岛>`）。精灵按产物或配方选（`config/buildings.ts` 的 `FACILITY_SPRITE`）。
- 产物去哪：`economy.ts` 的 `produce`：淡水进水缸，其他进暂存箱；每产一个记进 `dayLog(state, isl).made`。
- 头顶：进度条 = `island.prodAcc` 的小数部分；停工（`islandRate` 为 0 或犯困）时换成一个慢慢浮动的气泡，里面是停工原因的图标（`config/visual.ts` 的 `WORK_ICON`：缺人、缺饭、满仓、犯困……，设施面板用同一张表）。等级画在建筑上：2 级起屋顶插一面小旗，3 级两面（`IslandScene.drawFacilityStatus`）。有火的设施（蒸馏棚、烤炉）夜里发光。
- 设施面板（`ui/panels/IslandPanels.tsx`，“建筑详情”模板）：左边设施的图和等级星；右边三张卡按主次排——①产出（产物大图标、每小时多少、运转 / 停工原因；下面是暂存箱的格子和“拿到背包”“全部放进仓库”，产淡水的设施换成水缸的水位条）②工人（头像格，空位是虚线人形）③升级卡（连续吃饱画成碗、材料格、升级后“现在 → 以后”的产量 / 上限 / 人数）。底栏左边是还差什么，右边“升到 N 级”按钮，两个条件都满足才亮。三个分页：生产、改造（自动入库机）、培训。
- **升级**：`economy.ts` 吃饭时只累计 `mealStreak`，够了写一条日志；玩家在设施旁发 `{ t: 'upgradeIsland' }`，规则层检查连续吃饱、扣 `BALANCE.economy.upgradeCost` 的材料，再 `levelUp`（灯塔照得更远）。不要再在吃饭里自动升级。

- **自动入库机**：`buildings.autoStore`，命令 `build { what: 'autoStore' }`（在设施旁，`BALANCE.buildings.autoStore` 的材料）。装好后 `produce` 每产一个就 `flushOutput()`：暂存箱的东西放进储物箱，放不下的留在暂存箱。
- **运输线取货**（`transport.ts` 的 `load`）：先拿暂存箱里的，再拿储物箱里的（储物箱要给岛民留口粮）。

## 10.7 同伴、原住民、培训（M3）

- **对话**：`SeaPanels.tsx` 的 `TalkPanel`。对白按句推进：`linesOf(isl, who)` 给出词典键（没救出来 `talk.<身份>.plea`、`plea2`，救出来 `talk.<身份>.idle`，原住民 `talk.native.*`），E / Enter / “下一句”往下说（面板开着时在 window 上抢先处理 E，不会误按“交付”）。说完最后一句才显示“需要”格和“交付”；救出来的同伴显示“跟我上船”。
- **加入了**：`rescue()` / `recruit()` 把人的 id 放进 `state.joined`，`ui/popups/JoinedPopup.tsx` 逐个弹（暂停时间，比新配方弹窗优先），`ackJoined` 出队。弹窗的 Esc / Enter / E 用 `useAckKeys`。
- **随船人员**：`player.aboard`（最多 `BALANCE.inventory.seats`）。`pickUp` 要在那个人旁边（`objectFor` → `npc`），`dropOff` 在木筏旁（→ `raft`，木筏面板的“乘客”分页）。画面：海上的小木筏按人数换图（`mraft`、`mraft1`–`3`），码头边的木筏上站着同伴的精灵（`IslandScene.updateObjects`）。木筏停在码头旁刚过浪花的水里（`world/island.ts` 的 `raftAt`，按高度找，不放到外圈的雾里）。
- **培训**：设施面板的“培训”分页（`IslandPanels.tsx` 的 `useTraining`）：学生 = 这座岛的原住民，老师 = 在场（岛上 + 船上）且 `teachableJobs` 不为空的同伴，工作 = 老师能教的。命令 `train` 要在设施旁（`objectFor` → `facility`）。网络里还没有设施的原住民岛，设施槽位上是**设施地基**（精灵 `facilityBase`，种类还是 `facility`，有自己的初见介绍 `intro2d.facilityBase`），培训后变成设施。
- **人物面板**（P）：`Panels.tsx` 的 `PeoplePanel`，一人一张卡。
- **倒下**：`advance.ts` 的 `die()` 记 `state.lastDeath`，`DeathPopup` 弹卡片，`ackDeath`。
- **专门地图**：`config/maps.ts` 的 `MAPS` 里有 `stoneIsle`、`forestIsle`、`nativeA`、`fisherIsle`；其他岛还用通用模板。

## 10.6 昨日收成

- 记录：`state.today[岛 id] = { made, meals }`。`produce` 记产出，`mealAt` 记网络岛的每顿（吃饱 / 凑合 / 断供）。
- 每天 06:00（`advance.ts` 的 `hourly`，先于当天第一顿）调 `closeDay(state, 昨天)`：网络岛里有动静的各成一行，存进 `state.report`（`seen: false`），清空 `today`。一整天什么都没产就不出卡片。
- 界面：`ui/popups/ReportPopup.tsx`，用同一个 `Panel` 外框（`onClose` 改成“知道了”），暂停时间（`store.hold('report')`），每行岛名 + 等级星 + 产出格 + 三个碗（`ui_bowl` / `ui_bowlHalf` / `ui_bowlEmpty`），底栏是合计。Esc / Enter / E 都发 `ackReport`；新配方弹窗优先。

## 11. 引导

- HUD 元素逐步出现：`sim/tutorial.ts` 的 `FEATURES`，界面用 `has(state, id)`。
- 第一天脚本：`sim/guide.ts` 的 `GUIDE`（目标对象、说明、完成条件），`currentGuide()` 给 HUD 和画面层用；18:00 以后插入 `NIGHT_STEP`。
- 画面层：目标物体头顶跳动的箭头，不在屏幕里时屏幕边缘显示方向和格数。

## 12. 界面

- 所有尺寸 = 游戏内像素 × `--k`（画面放大倍数）。字体 Fusion Pixel 12px。
- 颜色只用 `global.css` 的 `--c0`–`--c11` 和随时段变化的 `--w*`。
- **画面驱动，不写说明句子**：数量、成本、缺料、需求、进度、条件一律用 `ui/components/Kit.tsx` 的零件画——`Cell`（图标格 + “有 / 要”，够了打勾、不够红框）、`CostGrid`（一份花费）、`Yield`（产出）、`Bowls`（连续吃饱的碗）、`Stars`（等级）、`Portrait`（人物头像，取精灵上半身）、`Picture`（建筑的图，整数倍放大）、`Chip`（图标 + 短词的状态）、`Meter`（数量 / 上限条）、`Card`（分块的小卡）、`Key`（键帽）。界面图标是 `art/icons.ts` 里 `ui_` 开头的那组（碗、星、钟、箭头、警告、对勾、背包、货舱、仓库、人、空位、眼睛）。
- **不显示标记**：词典里的 `<g>…</g>` 只给剧情、日志、对白、帮助用（`<Rich>` 渲染）。界面上的规则层原因用 `reasonText(msg)`（纯文字、去掉句号；缺材料统一写“材料不足”，因为材料格已经画出来了），人名、设施名用 `label(msg)`。`tests/uiText.test.ts` 检查界面用的键（`ui.` `act.` `reason.` `thing.` `work.` `item.` `itemdesc.` `recipe.` `role.` `fac.` `intro2d.`）没有标记，并扫描 `src/ui` 不许把 `tm()` 的结果直接放进界面。
- 物品显示用 `<ItemName>`、`<Slot>`（`ui/components/Item.tsx`），快捷栏格子标数字键。
- **HUD 元素位置和大小固定**：内容变化不能挤动别的元素。目标卡固定高度（标题一行、说明最多两行），提示卡固定高度（正文最多三行），日志区固定三行高、从下往上排。快捷栏选中的物品（名字、数量、“Q 吃”）显示在右下角的固定卡片里（`Hud.tsx` 的 `Selected`）。

### 面板框架

- 面板同一时间只开一个（`view.s.panel`），Esc 关闭。外框只有一种：`ui/panels/Panel.tsx`，大小固定 `BALANCE.ui.panel`（320 × 200 游戏像素，由 `GameView` 写进 `--pw` / `--ph`；手机上铺满）。内容多了在中间滚动，少了也不缩。
- 三块固定区域：**头**（图标 + 名字 + 分页 + Esc）、**身**（内容）、**底栏**（左边一行状态：为什么不行 / 选中的东西；右边主按钮）。主按钮永远在右下角。
- 分页（`tabs`）：同一个建筑的不同功能，比如木筏的“货舱 / 改造”、设施的“生产 / 培训”、帮助的“按键 / 规则”。还没开放的分页 `soon: true`，灰着，点开是 `<Soon />`（“下一阶段开放”）。
- 同类页面用同一个模板（`ui/panels/Views.tsx`）：
  - **两栏搬运**：左背包（`SlotGrid`，4 列）、右容器（货舱 `SlotGrid` 6 列 / 仓库 `StockGrid` 6 列）。点格子整格搬过去；鼠标停过的格子记在 `useFocus()`，底栏显示它（`FocusStatus`）和能做的事（`FocusActions`：搬过去、放进仓库、取出、吃喝）。背包面板、储物箱、木筏都用它。
  - **配方列表**：左边配方格，右边选中配方的大图、时间、`CostGrid → Yield`，底栏“制作”。工作台用它，以后的厨房、学堂也用它。
  - **建筑详情**：左边 `Picture` + 等级星，右边一列 `Card`（第一张是“它在做什么”，最后是升级 / 修建）。设施、灯塔、木筏改造、残骸用它。
  - **对话**：左边大头像和身份，右边一句对白（可以有强调色），下面“需要”的图标格（已交 / 要多少 + 身上有多少），底栏“交付”。
- 新配方弹窗也用 `Cell`：原料格 → 箭头 → 产物格。

## 13. 输入

`game/input/keys.ts`：窗口级监听。移动键记按住状态（`moveDir()`），其他键发一次性动作（`onAction()`）。按钮也可以 `fire(action)` 触发同样的动作（以后的手机按键用这个）。

## 14. 测试与调试

- `npm test`：规则、每座岛的地图可达性、采集点、引导、自由航行到石头岛救人修灯塔、存档迁移、MOD 注册、i18n、界面文字没有标记、自动通关。
- `npm run test:smoke`：Playwright 打开打包后的页面玩一段（造木筏、出海划一段）并截白天 / 黄昏 / 夜晚 / 海上的图。改了画面要跑。
- 截图检查要看的：人物被不被盖住、提示挡不挡东西、颜色和背景分不分得清、夜里有没有网格感。
- 控制台：`foghaul.state`（改完 `foghaul.bump()`）、`foghaulView.set({ debugMinute })`、`foghaulGame`。

## 15. 常见改动怎么做

| 想做 | 步骤 |
| --- | --- |
| 加一个面板 | 选一个模板（两栏搬运 / 配方列表 / 建筑详情 / 对话），外框用 `Panel`，数量和花费用 `Kit` 的零件，主按钮放 `actions`、原因放 `status` → `view.ts` 的 `PanelId` 加 id → `PanelHost` 登记 → 词典只加短词 |
| 加一种可互动的物体 | `OBJ_DEFS` 登记种类和范围 → `sprites.ts` 画精灵、`allSprites()` 登记 → `interact.ts` 的 `interactInfo` 写按 E 做什么，需要校验位置就在 `objectFor` 登记 → 场景 `interact()` 里打开面板或开始动作 → 词典加 `thing.<种类>`、`intro2d.<种类>`、按键提示文字 → 测试 |
| 给某座岛做专门的地图 | `config/maps.ts` 的 `MAPS` 加一个 id 和那座岛一样的模板（`templateFor` 会优先用它）→ `tests/island2d.test.ts` 会自动检查可达性 |
| 改通用岛的布局 | `config/maps.ts` 的 `GENERIC_MAPS`；群系装饰在 `world/templates.ts` 的 `DECOR` |
| 改木筏手感、靠岸距离 | `BALANCE.sail` |
| 改海上岛的大小、雾退开的速度 | `config/visual.ts` 的 `SEA_ART` |
| 改昼夜颜色 | `config/visual.ts` 的 `PHASES`；不要改着色器的做法 |
| 加一种可采集物 | `ForageKind`、`BALANCE.forage`、模板的 `forage` 区域、`OBJ_DEFS`、`gather` 命令 |
| 改存档结构 | 提升 `SAVE_VERSION`，`migrate()` 写迁移，加读旧档测试，更新本文第 3 节 |
