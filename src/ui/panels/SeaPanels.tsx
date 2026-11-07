// M2 的面板：灯塔（修建 / 查看）、和岛上的人说话（交付救援、招募物资）、海图（M）。
import { useEffect, useRef } from 'react';
import { BR } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ISLANDS } from '../../config/world';
import { t, tm } from '../../i18n';
import { buildCost, canUseStock, here } from '../../sim/actions';
import { canPay, carriedForNeed, missingCost, needMsg } from '../../sim/inventory';
import { isLit } from '../../sim/map';
import { stockP } from '../../sim/msg';
import { useGame, useStore, useView, useViewStore } from '../../store/hooks';
import { Rich } from '../components/Text';
import { Panel } from './Panel';

/** 灯塔：主岛和修好的岛显示照亮半径；没修的显示成本，可以修 */
export function LighthousePanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  if (!isl) return null;
  const built = isl.buildings.lighthouse;
  const lv = Math.max(0, isl.level - 1);
  const r = isl.kind === 'home' ? BALANCE.map.homeLightRadius : BALANCE.map.lighthouseRadius[lv];
  if (built)
    return (
      <Panel title={t('thing.lighthouse')}>
        <p>{t('ui.lighthouseOn', { r })}</p>
        <p className="u-dim">{t('ui.lighthouseHint')}</p>
      </Panel>
    );
  const cost = buildCost(g, 'lighthouse') ?? {};
  const src = canUseStock(isl) ? isl : undefined;
  const ok = canPay(g, src, cost);
  return (
    <Panel title={t('ui.lighthouseBase')}>
      <p>{t('ui.lighthouseBuildHint', { r: BALANCE.map.lighthouseRadius[lv] })}</p>
      <div className="rows">
        <div>
          <span>{t('ui.cost')}</span>
          <span>
            {t('ui.stockList', { list: stockP(cost) })}
          </span>
        </div>
        {!ok && (
          <div>
            <span className="u-dim">{t('ui.missingLabel')}</span>
            <span className="tone-b">{t('ui.stockList', { list: stockP(missingCost(g, src, cost)) })}</span>
          </div>
        )}
      </div>
      <div className="seg">
        <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'build', what: 'lighthouse' })}>
          {t('ui.buildLighthouse')}
        </button>
      </div>
    </Panel>
  );
}

/** 和岛上的人说话：救援 / 招募要的东西、进度、交付 */
export function TalkPanel() {
  const g = useGame();
  const store = useStore();
  const v = useView();
  const isl = here(g);
  if (!isl) return null;
  const who = v.talkTo ? g.people.find((p) => p.id === v.talkTo) : undefined;
  const def = ISLANDS.find((x) => x.id === isl.id);
  const need = def?.rescueNeed ?? def?.recruitNeed;
  const title = who ? tm(who.name) : t('ui.villager');
  // 村落、进出口局：请求在请求板上（下一阶段开放）
  if (!need || isl.kind === 'recipeVillage' || isl.kind === 'laborVillage' || isl.kind === 'bureau') {
    return (
      <Panel title={title}>
        <p>
          <Rich s={t('island.' + isl.id + '.intro')} />
        </p>
        <p className="u-dim">{t('ui.villageSoon')}</p>
      </Panel>
    );
  }
  const done = need.every((n, i) => (isl.needProgress[i] ?? 0) >= n.n);
  const canGive = !done && need.some((n, i) => (isl.needProgress[i] ?? 0) < n.n && carriedForNeed(g, n) > 0);
  return (
    <Panel title={title}>
      <p>
        <Rich s={done ? t(who?.active ? 'ui.talkThanks' : 'ui.talkDone') : t(isl.kind === 'native' ? 'ui.talkNative' : 'ui.talkPassenger')} />
      </p>
      {!done && (
        <div className="rows">
          {need.map((n, i) => (
            <div key={i}>
              <span>{tm(needMsg(n))}</span>
              <span>
                {t('ui.needProgress', { have: isl.needProgress[i] ?? 0, n: n.n })}
                <span className="u-dim"> · {t('ui.youCarry', { n: carriedForNeed(g, n) })}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {!done && (
        <div className="seg">
          <button className="u-btn" disabled={!canGive} onClick={() => store.dispatch({ t: 'deliver' })}>
            {t('ui.give')}
          </button>
          {!canGive && <span className="u-dim">{t('ui.nothingToGive')}</span>}
        </div>
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
  const vs = useViewStore();
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
  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    const isl = g.islands.find((i) => i.revealed && i.discovered && Math.max(Math.abs(i.x - x), Math.abs(i.y - y)) <= 1);
    if (!isl) return;
    store.dispatch({ t: 'setTarget', islandId: g.player.target === isl.id ? null : isl.id });
  };
  return (
    <Panel title={t('ui.seaChart')} sub={t('ui.seaChartHint')} wide>
      <div className="chart">
        <canvas ref={ref} width={W * CELL} height={H * CELL} style={{ width: W * CELL * k * 1.2, height: H * CELL * k * 1.2 }} onClick={click} />
        {g.islands
          .filter((i) => i.revealed && i.discovered)
          .map((i) => (
            <span key={i.id} className={'chart-name' + (i.owned ? ' own' : '')} style={{ left: ((i.x + 0.5) / W) * 100 + '%', top: ((i.y + 1.4) / H) * 100 + '%' }}>
              {t('island.' + i.id)}
            </span>
          ))}
      </div>
      <div className="seg">
        <span className="legend-sw" style={{ background: BR[0] }} /> {t('ui.legendFog')}
        <span className="legend-sw" style={{ background: BR[2] }} /> {t('ui.legendOpen')}
        <span className="legend-sw" style={{ background: BR[3] }} /> {t('ui.legendSeen')}
        <span className="legend-sw" style={{ background: BR[7] }} /> {t('ui.legendYou')}
        <button className="u-btn sec" onClick={() => vs.set({ panel: null })}>
          {t('ui.close')}
        </button>
      </div>
    </Panel>
  );
}
