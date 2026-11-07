# AGENTS.md

给接手本项目的 AI 和开发者的入口说明。先读这里，再按需读 `docs/`。

## 现在的方向：2D 版（先读这里）

项目正在从文字版改成 2D 游戏。**接手 2D 工作前先完整读 [docs/2d-design.md](docs/2d-design.md)**：原则（一个建筑一个功能、引导充足、不乱）、操作、建筑功能表、规则改动、美术规格、技术架构、里程碑和任务清单都在里面。美术样张在 `design/2d-美术设计稿-B.html`。

- 文字版冻结在 `text-version` 分支：只修 bug，不加功能。
- 下面的内容描述的是文字版。2D 版继续遵守其中的通用规则（`Msg` 和词典、数值只写在 `src/config/`、随机只用 `sim/rng.ts`、状态可序列化、改动后跑测试和构建），其余以 `docs/2d-design.md` 为准。

## 项目是什么

《雾屿航线》（Foghaul）：单人网页文字经营探索游戏。React + TypeScript + Vite，纯前端，无后端，存档在 localStorage，中英双语。线上地址：https://foghaul.junxuan-bao.workers.dev

## 先读哪些

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 分层、数据流、状态模型、命令、时间推进、多语言消息、存档、UI 结构 |
| [docs/game-systems.md](docs/game-systems.md) | 每个玩法系统的实际规则、对应文件和数值键 |
| [docs/development.md](docs/development.md) | 命令、测试、调试、代码约定、常见改动步骤、部署 |
| `design/雾屿航线 MVP 游戏方案.md` | 原始设计方案（实现时补全的部分见 game-systems.md 中的“补全”） |

## 命令

```bash
npm run dev        # 开发服务器 + 调试面板
npm test           # 全部测试（含自动通关）
npm run build      # 类型检查 + 打包
npm run deploy     # 打包并发布到 Cloudflare（需要 wrangler 已登录）
```

完成任何改动后都要跑 `npm test` 和 `npm run build`。

## 必须遵守的规则

1. **模拟层（`src/sim/`）不依赖 React/DOM，不产出可读文字。** 日志、错误、提示都用 `Msg`（`m()`、`say()`、`fail()`），文字放在 `src/i18n/zh.ts` 和 `src/i18n/en.ts`。
2. **两个词典的键必须一致。** `en.ts` 的类型约束会让缺键无法编译；动态拼接的键（`'island.' + id` 之类）要手动核对。
3. **玩家的一切操作都通过 `dispatch(state, command)`。** 新行为 = 在 `types.ts` 加 `Command` + 在 `actions.ts` 写处理函数。UI 的按钮禁用不能替代 `dispatch` 内的校验。
4. **数值只写在 `src/config/`。** 不要在逻辑里写魔法数字。
5. **`GameState` 必须可 JSON 序列化。** 改结构时提升 `sim/save.ts` 的 `SAVE_VERSION` 并写迁移。
6. **随机只用 `sim/rng.ts`**（`rand(state)` 等），保证同一存档可复现。
7. **改动主线**（岛屿、请求、解锁条件）时同步更新 `src/sim/bot.ts` 的 `STEPS`，自动通关测试会验证。岛屿不是开局生成的：剧情条件满足、并且锚点岛修好灯塔后，才按 `REVEALS` 在那座灯塔新照亮的海域里生成。
8. 颜色只用 `ui/styles/global.css` 里的 CSS 变量，深浅两套主题都要正确。`.isle/.warn/.stop/.fog/.open/.seen/.neutral` 是纯色块背景类，不要另作他用。
9. **界面功能的显示与否用 `has(state, id)`**（`sim/tutorial.ts`），物品名用 `<ItemName>`；手机布局（≤760px）也要检查。
10. **界面文字用中性的书面语**（“无人工作”“仓库已满”），口语和幽默只用在剧情、日志和对白里。

## 代码地图（最常改的地方）

| 想改 | 去哪里 |
| --- | --- |
| 数值、时间、成本、产能 | `src/config/balance.ts` |
| 物品、配方 | `src/config/items.ts`、`src/config/recipes.ts` |
| 岛屿顺序、救援条件、村落请求与奖励 | `src/config/world.ts` |
| 所有文字 | `src/i18n/zh.ts`、`src/i18n/en.ts` |
| 玩家命令的规则 | `src/sim/actions.ts` |
| 时间推进、生存、死亡 | `src/sim/advance.ts` |
| 生产、吃饭、升级、犯困 | `src/sim/economy.ts` |
| 运输线 | `src/sim/transport.ts` |
| 岛屿什么时候出现、在哪 | `src/config/world.ts` 的 `REVEALS`、`src/sim/reveal.ts`、`src/sim/worldgen.ts` |
| 迷雾、视野、寻路 | `src/sim/map.ts` |
| 新手引导（功能逐步出现、提示） | `src/sim/tutorial.ts`、`src/ui/components/Tip.tsx` |
| 聚焦引导（调暗四周、高亮一个按钮） | `src/ui/components/Coach.tsx`（`COACH` 步骤 + 元素上的 `data-coach`） |
| 新配方全屏弹窗 | `src/ui/components/RecipePopup.tsx` |
| 欢迎页、开场剧情、帮助 | `src/ui/screens/`、`src/ui/dialogs/HelpDialog.tsx` |
| 目标指引 | `src/sim/objectives.ts` |
| 界面 | `src/ui/`（场景在 `scenes/`，弹窗在 `dialogs/`） |

## 已知局限与待办

- 数值未经真人试玩，只保证流程可通关（脚本玩家会补物资、保命）。
- 只有一档存档。
- 地图标签在缩放到边缘时可能被裁切。
- `SAVE_VERSION = 4`（v3 存档可迁移，更早的不兼容）。
- 离线：页面加载后断网可以继续玩（游戏没有任何网络请求，存档在 localStorage），但断网时刷新或重新打开页面会打不开，因为还没有 Service Worker 缓存。字体来自 Google Fonts，断网时退回系统字体。
- 没有音效和美术资源，界面完全是文字和方格。
