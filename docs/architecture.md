# 架构

本文说明代码分层、数据流、状态模型和几个贯穿全局的机制（时间、命令、消息与多语言、存档）。具体玩法规则见 [game-systems.md](game-systems.md)。

## 分层

```
src/
  config/   纯数据：数值、物品、配方、岛屿与村落内容。不含逻辑，不含显示文字。
  i18n/     词典（zh.ts / en.ts）与渲染函数 t()、tm()、segments()。
  sim/      模拟层：纯 TypeScript，不依赖 React 和 DOM。所有规则都在这里。
  store/    GameStore：实时循环、自动存档、订阅；React 通过它读写 sim。
  ui/       React 界面：场景、面板、弹窗、调试面板、样式。
  main.tsx  入口：创建 GameStore，挂到 window.foghaul，渲染 <App/>。
tests/      Vitest：地图生成、开局、i18n 完整性、自动通关。
design/     原始设计方案和美术 Demo（未纳入版本控制）。
```

依赖方向只允许向下：`ui → store → sim → config`，`ui → i18n`，`sim → i18n` 只用于类型（`Msg`）。**sim 永远不调用 `t()`**，也不产出任何可读文字。

## 数据流

```
用户点击 / 按键
   │  store.dispatch({ t: 'move', dx: 1, dy: 0 })
   ▼
sim/actions.ts  dispatch(state, cmd)
   │  校验 → 修改 state → advance(state, 分钟) → say(state, 日志键)
   ▼
GameStore.bump()  version++ 并通知订阅者
   ▼
useGame()（useSyncExternalStore）→ 整棵 React 树重渲染，读 store.state
```

实时流逝走另一条路：`GameStore.tick()` 每 200ms 把现实时间换算成游戏分钟，调用 `advance(state, minutes)`，然后 `bump()`。

`state` 是**原地修改**的可变对象。React 不依赖引用变化，而是依赖 `version`。组件不做 memo，每次 bump 都整树重渲染（每秒约 5 次，规模很小，没有性能问题）。

## 状态模型（sim/types.ts）

`GameState` 是一个可直接 `JSON.stringify` 的普通对象，存档就是它本身。主要字段：

| 字段 | 说明 |
| --- | --- |
| `seed` / `rng` | 地图种子；`rng` 是随机数生成器的当前状态，随存档保存，保证可复现 |
| `time` | 从第 1 天 00:00 起的游戏分钟（浮点） |
| `islands[]` | 按 `config/world.ts` 的 `ISLANDS` 顺序排列；`id` 稳定，`islands[0]` 是主岛。`revealed`（已放上地图，之前坐标为 -1）、`opened`（迷雾已为它打开）、`discovered`（玩家看到过） |
| `people[]` | 乘客（`p_<role>`）和原住民（`n<序号>`）；`loc` 表示在岛上、在玩家木筏上或在运输线上 |
| `seen[]` | 60×36 的 0/1 数组，已探索的海面 |
| `lit[]` | 60×36 的 0/1 数组，可探索海域（迷雾以外）。由剧情解锁、灯塔、试飞逐步打开，见 `sim/reveal.ts` |
| `unlocks[]` | 已经出现的界面功能（新手引导逐步展示），见 `sim/tutorial.ts` |
| `tips[]` | 玩家已关闭的情境提示 |
| `player` | 位置、`at`（靠岸的岛 id，null 表示在海上）、生命/水/食物、背包、货舱、随船人员、经验、武器、已会的配方、航行目标 |
| `villages` | 每个村落的好感、当前请求进度、待学配方 |
| `flags` | 主线进度标记：主岛草药余量、农田、第一次培训、争水源事件、已装零件、飞机修好、试飞完成、已汇报 |
| `hints` | NPC 给出的方向提示（`Msg`），按目标岛 id 存 |
| `transport` | 运输木筏数量、路线列表 |
| `bureau` | 贸易额、订单、永久升级 |
| `log[]` | 最近 300 条日志（`LogLine`：时间、`Msg`、整行语气） |
| `cutscene` | 正在播放的过场（试飞 / 结局），播放期间时间停止、命令被拒 |

注意：**派生数据不入状态**。岛屿状态、产能、目标进度都由函数现算（`map.lightSources`、`ui/selectors.islandStatus`、`economy.islandRate`、`objectives.objectives`）。

## 命令（Command）

`types.ts` 里的 `Command` 是一个判别联合，`t` 字段是命令名。所有玩家行为（包括 UI 和脚本玩家）都必须通过 `dispatch(state, cmd)`：

- 返回 `Result { ok, msg? }`。失败时 `dispatch` 会自动把 `msg` 以 `warn` 语气写进日志，UI 不需要另做提示。
- 过场期间除 `endCutscene` 外一律拒绝。
- 需要耗时的命令在内部调用 `advance()`，所以“做一件事”会让全网（生产、运输、玩家消耗）一起前进。
- 处理函数用 `fail('err.xxx', params)` 返回错误，用 `OK` 返回成功。
- 每条命令处理完后，`dispatch` 统一调用 `checkReveals`（剧情解锁新岛）和 `updateUnlocks`（新手引导展示新功能）。所以新增的解锁条件只要写进配置，不需要在各个命令里手动触发。

UI 用来判断按钮是否可点的辅助函数也从 `actions.ts` 导出：`here`、`canUseStock`、`craftable`、`plotReady`、`buildCost`、`trainCost`。按钮被禁用只是体验优化，真正的校验永远在 `dispatch` 里。

## 时间推进（sim/advance.ts）

`advance(state, minutes, { sleeping? })` 按整点切片：

1. 每片 = min(剩余, 到下一个整点)。
2. 每片依次执行：`survive`（玩家水/食物消耗、缺水缺食和夜间掉血）→ `produce`（各岛产出/加工）→ `tickTransport`（运输木筏移动、装卸）。
3. 跨过整点时执行 `hourly`：到饭点（06/14/22）调用 `meal`；06:00 调用 `births`；然后 `sleepyCheck`、`bureauHourly`。
4. 每片都检查学习是否完成（`finishLearning`），有人学完就调用 `checkReveals`；每过一个整点调用 `updateUnlocks`。
5. 生命归零时调用 `die()`，并把死亡耗时（4 小时）追加到剩余时间里继续推进。
6. 有过场时立即停止推进。

睡觉就是 `advance(到 06:00, { sleeping: true })`，因此“结算一整晚的全网产能”是自然得到的。

## 消息与多语言

模拟层产出的所有文字都是 `Msg`（`sim/msg.ts`）：

```ts
interface Msg { k: string; p?: Record<string, Param> }
type Param = string | number | Msg | { stock: Stock } | { list: Msg[] };
```

- `k` 是词典键，`p` 是模板参数。参数可以嵌套 `Msg`（例如岛名 `islandM(id)`），可以是物品清单 `stockP(stock)`（渲染为“木头×3、鱼×2”或“Wood ×3, Fish ×2”），也可以是 `Msg` 列表。
- 词典模板里用 `{name}` 插值，用 `<g>…</g>`（获得）、`<b>…</b>`（损失）、`<h>…</h>`（线索）、`<w>…</w>`（警告）标注高亮。`segments()` 把字符串拆成带语气的片段，`<Rich>` 组件渲染成带 class 的 span。
- 日志行还可以带整行语气 `c`（`got`/`bad`/`hint`/`warn`）。
- 因为日志里存的是键，切换语言后旧日志也会跟着变。
- `en.ts` 的类型是 `Record<keyof typeof zh, string>`，**少一个键就无法通过类型检查**。`tests/i18n.test.ts` 另外检查两种语言的占位符一致，以及源码里出现的字面量键都存在。
- 当前语言是 `i18n/index.ts` 里的模块级变量。`App` 把 `lang` 作为根元素的 `key`，切换语言时整树重建。

动态拼出的键（例如 `'island.' + id`、`'log.built.' + what`、`'mealui.' + note`）不在静态检查范围内，新增这类键时要手动核对两个词典。

## 随机数

`sim/rng.ts` 用 mulberry32。游戏内的随机都走 `rand(state)`，它会推进 `state.rng`，所以同一存档加同样的命令序列，结果完全相同。地图生成用独立的 `makeRng(seed)`。

## 存档（sim/save.ts）

- 键：`foghaul.save.v2`（`BALANCE.save.key`），值是整个 `GameState` 的 JSON。
- `SAVE_VERSION = 2`（v2 改为逐步生成地图，与 v1 不兼容，v1 存档会被忽略）。读档时 `migrate()` 只接受同版本，否则返回 null（视为新游戏）。**修改 `GameState` 结构时要提升版本号并在 `migrate` 里写迁移**，否则玩家的旧存档会被丢弃。
- GameStore 每 10 秒自动存档，页面隐藏和关闭时也存。设置弹窗提供导出 / 导入 JSON 和新游戏。

语言（`foghaul.lang`）和主题（`foghaul.theme`）各自单独存在 localStorage 里，不属于存档。

## 实时循环（store/GameStore.ts）

- 每 200ms 一次 `tick`。现实时间差最多按 1 秒计（`maxRealStepMs`），切回页面不会一下跳过很多时间。
- 换算：`游戏分钟 = 现实秒 / 37.5 × 60 × speed`。`speed` 是调试倍率。
- `running = !paused && !blocked && !document.hidden && !cutscene`。`blocked` 在欢迎页和开场剧情期间为 true。`hadSave` 记录启动时是否有存档，决定欢迎页是否显示“继续”。不在运行时 tick 直接返回，因此“离线不推进”是天然成立的。
- `replace(state)` 用于导入存档和调试预设，`newGame(seed?)` 清档重开。

## UI 结构

```
App（UiContext：当前弹窗、地图缩放、主题、语言、restart；键盘快捷键；screen 状态）
├─ screens/Welcome（选语言、继续 / 新的旅程）
├─ screens/Intro（新游戏的背景故事 + 怎么玩）
└─ 游戏界面（screen === 'game'）
├─ Header（窄屏时收进“菜单”）（时钟、昼夜条、入夜倒计时、面板按钮、暂停、生命/水/食物）
├─ SeaScene（player.at 为 null）
│   ├─ LogView + 情境操作（捞起来、靠岸）+ 喝海水/跳海捕鱼 + ObjectiveCard
│   ├─ MapPanel → MapView（网格、岛屿标记、航线、船、玩家、目标虚线、边缘提示、选目标）
│   └─ Inventory（背包、货舱、随船人员）
├─ IslandScene（player.at 不为 null）
│   ├─ 标题行（睡觉、等 1 小时、乘飞机、出海）+ Alerts
│   ├─ 按岛类型：HomePanel / NeedList（救援、招募）/ VillagePanel / BureauPanel
│   ├─ 设施、人员（培训/转岗/接走）、库存、建设、制作（CraftPanel）、码头
│   └─ ObjectiveCard + Inventory
├─ TipBox（情境提示，场景顶部）
├─ 弹窗（原生 <dialog>）：People / Islands / Routes / Journal / Help / Settings
├─ Cutscene（试飞、结局）
└─ DevPanel（仅开发模式或 ?debug）
```

- 窄屏（≤760px，`ui/hooks.ts` 的 `useNarrow`）时，场景改为单列 + 标签页（`components/Tabs.tsx`），弹窗全屏。
- 物品名统一用 `components/Tip.tsx` 的 `<ItemName id>` 渲染，自带说明气泡。
- 功能是否显示看 `has(state, 'xxx')`（`sim/tutorial.ts`），不要在组件里另写一套“该不该显示”的条件。
- `ui/selectors.ts`：`islandStatus()` 把岛屿归为 运转中 / 需要处理 / 停工 / 其他，地图和总览共用；`bar()` 画字符进度条。
- 样式：`ui/styles/global.css` 放视觉 token（`.t-dark`、`.t-light` 两套 CSS 变量，取自美术 Demo）和通用组件类（`.cmd`、`.lead`、`.mini`、`.row`、`.pick`、`.tab`、`.box`、`.tone-*`）。地图用 CSS Module（`MapView.module.css`）。
- 注意 `.isle/.warn/.stop/.neutral/.fog/.open/.seen` 是**纯色块背景**（地图格子和图例用），不要拿来做其他组件的修饰类；提示框用 `.box-alert`、`.box-stop`。

## 部署

产物是纯静态文件（`dist/`），通过 Cloudflare Workers 静态资源托管，配置见 `wrangler.jsonc`，流程见 [development.md](development.md#部署)。
