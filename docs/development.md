# 开发指南

日常工作流、测试与调试、常见改动的做法、部署。架构见 [architecture.md](architecture.md)，规则见 [game-systems.md](game-systems.md)。

## 环境与命令

需要 Node 20+（开发时用的是 Node 26）。

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | Vite 开发服务器（默认 http://localhost:5173），带调试面板 |
| `npm test` | Vitest：地图生成、开局、i18n、自动通关，约 3 秒 |
| `npm run typecheck` | `tsc -b`，包含 tests/ |
| `npm run build` | 类型检查 + 打包到 `dist/` |
| `npm run deploy` | 打包并用 Wrangler 发布到 Cloudflare |

提交前至少跑 `npm test` 和 `npm run build`。

## 测试

| 文件 | 覆盖内容 |
| --- | --- |
| `tests/worldgen.test.ts` | 200 个种子生成地图，检查边界和岛间距 |
| `tests/opening.test.ts` | 造木筏、救工程师和伐木工；夜间掉血；死亡丢货和重生；存档往返；日志在两种语言下都能渲染 |
| `tests/i18n.test.ts` | 两个词典键一致、占位符一致；源码里字面量键都存在 |
| `tests/playthrough.test.ts` | 用脚本玩家在 4 个种子上从新游戏打到汇报工作，并检查每步对应的目标已完成、全部日志可渲染 |
| `tests/helpers.ts` | `must`、`sailTo`、`homeGather`、`keepAlive` 等测试工具 |

### 脚本玩家（sim/bot.ts）

`STEPS` 是主线的有序步骤（`raft`、`engineer`、…、`report`），每一步只调用 `dispatch`。它为了不依赖数值做了两种“作弊”：

1. `keepAlive`：每走一步把生命、水、食物补到安全值；
2. `ensure`：交付或建造前，把缺的物资直接放进货舱/背包。

因此自动通关测试证明的是**流程和规则能走通**（顺序、解锁、地图可达、命令校验），**不证明数值平衡**。数值要靠试玩。

改动主线时（新增岛、改请求、改解锁条件），要同步更新 `STEPS`，否则自动通关测试会失败。这正是它的用途。

## 调试

- **DEV 面板**（`npm run dev` 或网址加 `?debug`，`` ` `` 键开关）：时间倍率 ×1/×5/×20/×100、回满状态、点亮所有灯塔、显示所有岛、揭开地图、给木筏、加任意物品、传送到已发现的岛、里程碑预设、重置存档。
- **里程碑预设**（`sim/presets.ts`）：用脚本玩家从同一种子跑到指定步骤，适合直接测中后期界面。
- **控制台**：
  - `foghaul.state`：当前游戏状态（可直接修改，改完调用 `foghaul.bump()` 刷新界面）；
  - `foghaul.dispatch({ t: 'move', dx: 1, dy: 0 })`：执行命令；
  - `foghaul.speed = 20`：时间倍率；
  - `foghaulDev.preset('M3 first route')`：跳到预设（仅开发模式）。
- 模拟层是纯函数加可变状态，大多数问题可以在 Vitest 里用 `createGame(seed)` + `dispatch` 复现，不用开浏览器。

## 代码约定

- **模拟层不写可读文字**。日志、错误、目标说明都用 `Msg`（`m(key, params)`、`say(state, key, params, tone)`、`fail(key, params)`），文字放在 `i18n/zh.ts` 和 `i18n/en.ts`。
- **所有玩家操作都走 `dispatch`**。UI 里的禁用判断只是体验，不能代替 `dispatch` 里的校验。
- **数值只放 `config/`**。逻辑里出现的魔法数字应当移进 `balance.ts`。
- **状态必须可 JSON 序列化**：不放函数、Map、Set、类实例。派生数据现算，不入状态。
- **随机只用 `rand(state)` / `chance` / `randInt` / `pickWeighted`**，不要用 `Math.random()`（唯一例外：`newSeed()` 生成新存档的种子）。
- 注释用中文，和现有代码一致。
- CSS：通用组件类放 `global.css`，局部复杂样式用 CSS Module。颜色一律用 token 变量，保证深浅两套主题都正确。

## 常见改动

### 调一个数值

直接改 `src/config/balance.ts`（或 items / recipes / world）。热更新后，**已有存档**里已经生成的内容（地图、岛上的人）不会变，必要时在设置里开新游戏。

### 新增物品

1. `config/items.ts`：在 `ItemId` 联合里加 id，在 `ITEMS` 里加定义，在 `ITEM_ORDER` 里排好位置。
2. 两个词典各加 `item.<id>`。
3. 如果它是食物，填 `foodTier`；如果要进订单池，在 `sim/endgame.ts` 的 `ORDER_POOL` 里加。

### 新增配方

1. `config/recipes.ts`：`RecipeId`、`RECIPES`、`RECIPE_ORDER`。`role` 决定谁能学、加成群系；`batchesPerHour` 是岛上设施产能；`manualMinutes` 是手动耗时。
2. 词典加 `recipe.<id>`。
3. 让玩家能得到它：作为村落请求的奖励（`world.ts` 的 `reward.recipe`），或在 `actions.ts` 的 `rescue()` 里教。

### 新增岛屿

1. `config/world.ts` 的 `ISLANDS`：放在合适的位置（顺序就是发现顺序），设 `stage`、`kind`、群系、救援或招募需求。
2. 词典加 `island.<id>` 和 `island.<id>.intro`。
3. 乘客岛：需要对应的 `Role`；获救文字 `rescue.<role>.*`；`config/text.ts` 的 `RESCUE_HINT_TARGET` 决定救出后提示谁。
4. 村落：还要在 `VILLAGES` 里定义，并在 `sim/villages.ts` 的 `ISLAND_OF` 里登记岛 id。
5. 跑 `npm test`：地图生成测试会验证新岛能放得下、走得到；如果放不下，考虑调整 `B.map` 的距离参数或阶段。
6. 更新 `sim/bot.ts` 的 `STEPS` 和 `sim/objectives.ts`（如果它属于主线）。

### 新增村落请求或奖励

在 `VILLAGES[vid].requests` 末尾追加（顺序就是好感顺序），并在两个词典里加 `village.<vid>.req<序号>`。奖励类型见 `Reward`（配方、武器、零件、原住民）。

### 新增命令

1. `sim/types.ts`：在 `Command` 联合里加一项。
2. `sim/actions.ts`：写处理函数（校验 → 修改 → `advance` → `say`），在 `run()` 的 switch 里接上。TypeScript 会提示 switch 是否穷尽。
3. 错误和日志的键加进两个词典。
4. UI 调用 `store.dispatch(...)`。

### 新增界面文字

在 `zh.ts` 加键，`en.ts` 必须加同名键（否则类型检查失败）。界面里用 `t('ui.xxx', params)`；带高亮的用 `<T k="..." p={...} />` 或 `<M m={msg} />`。

### 修改状态结构

如果改动了 `GameState` 的形状（加字段、改字段含义），在 `sim/save.ts` 提升 `SAVE_VERSION` 并在 `migrate()` 里把旧存档转换过来；否则玩家的存档会被当作无效而丢弃。只加有默认值的可选字段时，也可以在 `migrate` 里补默认值。

## 部署

站点是纯静态文件，部署为 Cloudflare Workers 的静态资源（没有 Worker 脚本）。

- 配置：根目录 `wrangler.jsonc`。`assets.directory` 指向 `./dist`，`not_found_handling` 为 `single-page-application`。
- Wrangler 作为开发依赖安装在项目里（`npx wrangler ...`）。
- 首次需要登录：`npx wrangler login`；`npx wrangler whoami` 查看当前账号。
- 发布：`npm run deploy`（即 `npm run build && wrangler deploy`）。
- 预演：`npx wrangler deploy --dry-run`。
- 回滚：`npx wrangler versions list` 查看版本，`npx wrangler rollback <VERSION_ID>`。
- 当前线上地址：https://foghaul.junxuan-bao.workers.dev

生产包里不显示调试面板，但网址加 `?debug` 仍可打开（方便线上排查）。如果不希望线上可用，把 `ui/App.tsx` 里的 `SHOW_DEV` 改成只认 `import.meta.env.DEV`。
