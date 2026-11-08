// 冒烟测试（docs/2d-design.md 第 11 节）：打开打包后的页面、开新游戏、走几步、按 E 掰树枝、去工作台做木筏，
// 确认没有报错，并在白天、黄昏、夜晚各截一张图。用法：npm run test:smoke（需要 Playwright 和 Chromium）。
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

let chromium;
try {
  // 用 require：项目里没装时也能找到全局安装的 Playwright（NODE_PATH）
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('需要 Playwright：npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const OUT = process.env.SMOKE_OUT ?? 'smoke-shots';
mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'error' });
const url = 'http://localhost:4179/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, locale: 'zh-CN' });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.getByRole('button', { name: '新的旅程' }).click();
  await page.getByRole('button', { name: '跳过' }).click();
  await page.getByRole('button', { name: '醒来' }).click();
  await page.waitForFunction(() => !!window.foghaulGame?.scene.isActive('island'));
  const st = () => page.evaluate(() => window.foghaul.state);
  const y0 = (await st()).walk.y;
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  const s1 = await st();
  if (!(s1.walk.y < y0)) throw new Error('人物没有走动');
  // 树每天随机长：从存档里找一棵还能采的，站到旁边（只改位置，动作走真实按键和规则）
  for (let guard = 0; guard < 20 && ((await st()).player.pack.wood ?? 0) < 8; guard++) {
    const ok = await page.evaluate(() => {
      const s = window.foghaul.state;
      const t = s.forage.home.find((n) => n.kind === 'tree' && n.left > 0);
      if (!t) return false;
      Object.assign(s.walk, { x: t.x, y: t.y + 4, facing: 'up' });
      return true;
    });
    if (!ok) throw new Error('岛上没有能采的树');
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1300);
  }
  const s2 = await st();
  if ((s2.player.pack.wood ?? 0) < 8) throw new Error('掰树枝没有得到木头：' + JSON.stringify(s2.player.pack));
  await page.evaluate(() => Object.assign(window.foghaul.state.walk, { x: 424, y: 226, facing: 'up' }));
  // 等画面层选中工作台再按 E（慢的机器上一帧可能要很久）
  await page.waitForFunction(() => window.foghaulView.s.focus?.kind === 'workbench');
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: '制作' }).first().click();
  await page.keyboard.press('Escape');
  if (!(await st()).player.hasRaft) throw new Error('没有造出木筏');
  // M2：走到码头按 E 出海，按键划一段
  await page.evaluate(() => {
    const s = window.foghaul.state;
    s.tips.push('sea');
    const d = window.foghaulGame.scene.getScene('island').L.dock;
    Object.assign(s.walk, { x: d.x + d.w / 2, y: d.y + 20, facing: 'down' });
  });
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.foghaulGame?.scene.isActive('sea'), null, { timeout: 15000 });
  const r0 = (await st()).raft;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1200);
  const s3 = await st();
  if (s3.player.at !== null) throw new Error('没有出海');
  if (!(s3.stats.moves > 0) || Math.abs(s3.raft.x - r0.x) < 4) throw new Error('木筏没有划动：' + JSON.stringify([r0, s3.raft, s3.stats.moves]));
  await page.screenshot({ path: `${OUT}/sea.png` });
  for (const [m, n] of [[12 * 60, 'day'], [19 * 60 + 40, 'dusk'], [23 * 60, 'night']]) {
    await page.evaluate((m) => window.foghaulView.set({ debugMinute: m }), m);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${n}.png` });
  }
  if (errors.length) throw new Error('页面报错：\n' + errors.join('\n'));
  ok = true;
  console.log('smoke ok, screenshots in ' + OUT);
} catch (e) {
  console.error('smoke failed:', e.message);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(ok ? 0 : 1);
