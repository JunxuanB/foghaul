// M2 的面板：灯塔（修建 / 查看）、和岛上的人说话（交付救援、招募物资）、海图（M）。
import { useEffect, useRef } from 'react';
import { BR } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ISLANDS } from '../../config/world';
import { t } from '../../i18n';
import { buildCost, canUseStock, here } from '../../sim/actions';
import { canPay, carriedForNeed, needItems } from '../../sim/inventory';
import { charOf } from '../../sim/interact';
import { isLit } from '../../sim/map';
import { useGame, useStore, useView } from '../../store/hooks';
import { Card, Cell, label, Chip, CostGrid, Picture, Portrait } from '../components/Kit';
import { Rich } from '../components/Text';
import { Panel } from './Panel';

/** 灯塔：建筑详情模板。修好的显示照亮范围；没修的显示修好后照多远、要什么材料，主按钮“修灯塔” */
export function LighthousePanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  if (!isl) return null;
  const built = isl.buildings.lighthouse;
  const lv = Math.max(0, isl.level - 1);
  const r = isl.kind === 'home' ? BALANCE.map.homeLightRadius : BALANCE.map.lighthouseRadius[lv];
  const cost = buildCost(g, 'lighthouse') ?? {};
  const src = canUseStock(isl) ? isl : undefined;
  const ok = canPay(g, src, cost);
  return (
    <Panel
      title={t(built ? 'thing.lighthouse' : 'ui.lighthouseBase')}
      icon="ui_eye"
      status={built ? <Chip icon="ui_check" tone="ok">{t('ui.lightRadius', { r })}</Chip> : !ok ? <span className="tone-b">{t('ui.lack')}</span> : null}
      actions={
        !built && (
          <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'build', what: 'lighthouse' })}>
            {t('ui.buildLighthouse')}
          </button>
        )
      }
    >
      <div className="v-building">
        <Picture sprite={built ? 'light' : 'lhBase'} scale={3} />
        <div className="v-stack">
          <Card cls="main" title={built ? t('thing.lighthouse') : t('ui.afterBuild')} icon="ui_eye">
            <div className="v-output">
              <LightRings r={built ? r : BALANCE.map.lighthouseRadius[lv]} />
              <b className="v-rate">{t('ui.lightRadius', { r: built ? r : BALANCE.map.lighthouseRadius[lv] })}</b>
            </div>
          </Card>
          {!built && (
            <Card title={t('ui.condCost')} icon="wood">
              <CostGrid g={g} cost={cost} src={src} />
            </Card>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** 照亮范围的小示意：一个像素一格，亮的是灯塔照到的海，中间是灯塔 */
function LightRings({ r }: { r: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const n = r * 2 + 3;
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = BR[1];
    c.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx = x - (n >> 1);
        const dy = y - (n >> 1);
        if (dx * dx + dy * dy <= r * r) {
          c.fillStyle = BR[(x + y) % 2 ? 4 : 3];
          c.fillRect(x, y, 1, 1);
        }
      }
    c.fillStyle = BR[11];
    c.fillRect(n >> 1, n >> 1, 1, 1);
  }, [n, r]);
  return <canvas ref={ref} className="v-rings" width={n} height={n} style={{ ['--s' as string]: BALANCE.ui.lightDiagram }} />;
}

/** 对话：左边头像和名字，右边一句话（对白可以有强调色），下面是需要的东西（图标 + 已交 / 要多少 + 身上有多少），主按钮“交付” */
export function TalkPanel() {
  const g = useGame();
  const store = useStore();
  const v = useView();
  const isl = here(g);
  if (!isl) return null;
  const who = v.talkTo ? g.people.find((p) => p.id === v.talkTo) : undefined;
  const def = ISLANDS.find((x) => x.id === isl.id);
  const need = def?.rescueNeed ?? def?.recruitNeed;
  const title = who ? label(who.name) : t('ui.villager');
  const face = (
    <div className="v-who">
      <Portrait char={who ? charOf(who) : 'islander'} name={title} big />
      {who?.role && t('role.' + who.role) !== title && <span className="u-dim">{t('role.' + who.role)}</span>}
    </div>
  );
  // 村落、进出口局：请求在请求板上（下一阶段开放）
  if (!need || isl.kind === 'recipeVillage' || isl.kind === 'laborVillage' || isl.kind === 'bureau') {
    return (
      <Panel title={title} icon="ui_person" status={<span className="u-dim">{t('ui.villageSoon')}</span>}>
        <div className="v-talk">
          {face}
          <p className="v-say">
            <Rich s={t('island.' + isl.id + '.intro')} />
          </p>
        </div>
      </Panel>
    );
  }
  const done = need.every((n, i) => (isl.needProgress[i] ?? 0) >= n.n);
  const canGive = !done && need.some((n, i) => (isl.needProgress[i] ?? 0) < n.n && carriedForNeed(g, n) > 0);
  return (
    <Panel
      title={title}
      icon="ui_person"
      status={done ? <Chip icon="ui_check" tone="ok">{t('ui.talkDoneShort')}</Chip> : !canGive ? <span className="tone-b">{t('ui.nothingToGive')}</span> : null}
      actions={
        !done && (
          <button className="u-btn" disabled={!canGive} onClick={() => store.dispatch({ t: 'deliver' })}>
            {t('ui.give')}
          </button>
        )
      }
    >
      <div className="v-talk">
        {face}
        <p className="v-say">
          <Rich s={done ? t(who?.active ? 'ui.talkThanks' : 'ui.talkDone') : t(isl.kind === 'native' ? 'ui.talkNative' : 'ui.talkPassenger')} />
        </p>
      </div>
      {!done && (
        <Card title={t('ui.needs')} icon="ui_warn">
          <span className="k-cells">
            {need.map((n, i) => {
              const have = isl.needProgress[i] ?? 0;
              const carry = carriedForNeed(g, n);
              return (
                <span key={i} className="v-need">
                  <Cell id={needItems(n)[0]} have={have} need={n.n} />
                  <span className={'u-dim' + (carry > 0 && have < n.n ? ' tone-g' : '')}>{t('ui.carry', { n: carry })}</span>
                </span>
              );
            })}
          </span>
        </Card>
      )}
    </Panel>
  );
}

const CELL = 4;

/** 海图（M）：迷雾 / 可探索 / 已探索、岛、木筏、航行目标。点岛可以设为目标 */
export function MapPanel() {
  const g = useGame();
  const store = useStore();
  const v = useView();
  const ref = useRef<HTMLCanvasElement>(null);
  const W = g.width;
  const H = g.height;
  useEffect(() => {
    const cv = ref.current;
    const c = cv?.getContext('2d');
    if (!c) return;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        c.fillStyle = !isLit(g, x, y) ? BR[0] : g.seen[i] ? BR[3] : BR[2];
        c.fillRect(x * CELL, y * CELL, CELL, CELL);
        if (g.seen[i] && isLit(g, x, y)) {
          c.fillStyle = BR[4];
          c.fillRect(x * CELL, y * CELL, 1, 1);
        }
      }
    for (const isl of g.islands) {
      if (!isl.revealed || !isl.discovered) continue;
      c.fillStyle = isl.owned ? BR[11] : BR[10];
      c.fillRect(isl.x * CELL - 1, isl.y * CELL - 1, CELL + 2, CELL + 2);
      if (g.player.target === isl.id) {
        c.strokeStyle = BR[7];
        c.lineWidth = 1;
        c.strokeRect(isl.x * CELL - 3.5, isl.y * CELL - 3.5, CELL + 7, CELL + 7);
      }
    }
    c.fillStyle = BR[7];
    c.fillRect(g.player.x * CELL, g.player.y * CELL, CELL, CELL);
  }, [g, g.time, W, H]);
  const k = v.k;
  // 海图放大到正好填满面板内容区（面板大小固定，见 BALANCE.ui.panel）
  const f = Math.min(BALANCE.ui.panel.bodyW / (W * CELL), BALANCE.ui.panel.bodyH / (H * CELL));
  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    const isl = g.islands.find((i) => i.revealed && i.discovered && Math.max(Math.abs(i.x - x), Math.abs(i.y - y)) <= 1);
    if (!isl) return;
    store.dispatch({ t: 'setTarget', islandId: g.player.target === isl.id ? null : isl.id });
  };
  return (
    <Panel
      title={t('ui.seaChart')}
      icon="ui_eye"
      status={
        <span className="v-legend">
          <span className="legend-sw" style={{ background: BR[0] }} /> {t('ui.legendFog')}
          <span className="legend-sw" style={{ background: BR[2] }} /> {t('ui.legendOpen')}
          <span className="legend-sw" style={{ background: BR[3] }} /> {t('ui.legendSeen')}
          <span className="legend-sw" style={{ background: BR[7] }} /> {t('ui.legendYou')}
        </span>
      }
      actions={<span className="u-dim">{t('ui.seaChartHint')}</span>}
    >
      <div className="chart">
        <canvas ref={ref} width={W * CELL} height={H * CELL} style={{ width: W * CELL * k * f, height: H * CELL * k * f }} onClick={click} />
        {g.islands
          .filter((i) => i.revealed && i.discovered)
          .map((i) => (
            <span key={i.id} className={'chart-name' + (i.owned ? ' own' : '')} style={{ left: ((i.x + 0.5) / W) * 100 + '%', top: ((i.y + 1.4) / H) * 100 + '%' }}>
              {t('island.' + i.id)}
            </span>
          ))}
      </div>
    </Panel>
  );
}
