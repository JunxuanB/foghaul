# 雾屿航线 Foghaul

单人网页文字经营探索游戏：从坠机幸存者起步，救回同伴、培训原住民、开通运输线，把散落的岛屿连成自动运转的网络，最后修好直升机，抵达进出口局。支持中文和英文。

线上试玩：https://foghaul.junxuan-bao.workers.dev

设计方案见 `design/`。开发文档见 [AGENTS.md](AGENTS.md) 和 `docs/`（[架构](docs/architecture.md)、[玩法系统](docs/game-systems.md)、[开发指南](docs/development.md)）。

## 运行

```bash
npm install
npm run dev      # 开发服务器，带调试面板
npm test         # 单元测试 + 自动通关测试
npm run build    # 产出 dist/，纯静态，可直接部署
npm run deploy   # 打包并发布到 Cloudflare Workers（需先 npx wrangler login）
```

## 调数值

所有数值集中在 `src/config/`：

| 文件 | 内容 |
| --- | --- |
| `balance.ts` | 时间比例、地图、生存消耗、行动耗时、建设成本、产能、升级、经验表、海上事件、运输、终局 |
| `items.ts` | 物品的恢复量、食物档次、进出口局单价 |
| `recipes.ts` | 配方的原料、产物、手动耗时、设施产能 |
| `world.ts` | 岛屿发现顺序、救援/招募需求、村落请求与奖励、武器 |

文字都在 `src/i18n/zh.ts` 和 `src/i18n/en.ts`，两个词典的键必须一致（有测试检查）。

## 调试

- `npm run dev` 或网址带 `?debug` 时，右下角有 **DEV** 面板（也可按 `` ` `` 开关）：时间倍率、加物品、传送、揭开地图、跳到各里程碑的预设存档、重置。
- 浏览器控制台里可以用 `foghaul`（游戏状态与命令）和 `foghaulDev.preset('M3 first route')`。

## 结构

- `src/sim/`：模拟逻辑，纯 TypeScript，不依赖 React。状态可 JSON 序列化；所有玩家操作都走 `dispatch(state, command)`，时间推进走 `advance(state, minutes)`。模拟层只产出“词典键 + 参数”的消息，由界面按当前语言渲染。
- `src/sim/bot.ts`：脚本玩家，只用正式命令推进主线（会补足物资和保命）。调试预设和自动通关测试都用它。
- `src/store/`：实时循环（页面隐藏时暂停）、自动存档到 localStorage。
- `src/ui/`：React 界面，样式 token 取自美术 Demo，深色和浅色两套主题。
