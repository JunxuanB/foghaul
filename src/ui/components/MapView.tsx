import { t } from '../../i18n';
import { isLit, isSeen } from '../../sim/map';
import { boatPos } from '../../sim/transport';
import { dirOf, island, manhattan } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { islandStatus, ZOOMS } from '../selectors';
import { useUi } from '../ui';
import { M } from './Text';
import s from './MapView.module.css';

const LAND = 'M-3.6 -1 Q-1.5 -3.8 1.6 -3 Q4 -1.6 3.4 1.2 Q1.6 3.8 -1.4 3.2 Q-4 2.2 -3.6 -1 Z';

export function MapView({ picking, setPicking }: { picking: boolean; setPicking: (v: boolean) => void }) {
  const g = useGame();
  const store = useStore();
  const ui = useUi();
  const p = g.player;
  const [cols, rows] = ZOOMS[ui.zoom];
  const cx = Math.max(0, Math.min(g.width - cols, p.x - Math.floor(cols / 2)));
  const cy = Math.max(0, Math.min(g.height - rows, p.y - Math.floor(rows / 2)));
  const cells: string[] = [];
  for (let y = cy; y < cy + rows; y++)
    for (let x = cx; x < cx + cols; x++) {
      if (!isLit(g, x, y)) cells.push('fog');
      else cells.push(isSeen(g, x, y) ? 'seen' : 'open');
    }
  const px = (x: number) => ((x - cx + 0.5) / cols) * 100;
  const py = (y: number) => ((y - cy + 0.5) / rows) * 100;
  const inView = (x: number, y: number) => x >= cx && x < cx + cols && y >= cy && y < cy + rows;
  const tileW = 100 / cols + '%';
  const discovered = g.islands.filter((i) => i.discovered);
  const tgt = p.target ? island(g, p.target) : null;
  const dist = tgt ? manhattan(tgt.x, tgt.y, p.x, p.y) : 0;

  let chip: { left: number; top: number; text: string } | null = null;
  if (tgt && dist > 0 && !inView(tgt.x, tgt.y)) {
    const mx = px(p.x), my = py(p.y), tx = px(tgt.x), ty = py(tgt.y);
    const ddx = tx - mx, ddy = ty - my;
    const tX = ddx > 0 ? (94 - mx) / ddx : ddx < 0 ? (6 - mx) / ddx : Infinity;
    const tY = ddy > 0 ? (92 - my) / ddy : ddy < 0 ? (8 - my) / ddy : Infinity;
    const t0 = Math.min(tX, tY);
    const d = dirOf(tgt.x - p.x, tgt.y - p.y);
    chip = {
      left: Math.max(18, Math.min(82, mx + ddx * t0)),
      top: Math.max(8, Math.min(92, my + ddy * t0)),
      text: `${d.arrow} ${t('island.' + tgt.id)} ${t('ui.tiles', { n: dist })}`,
    };
  }

  const routes = g.transport.routes;

  return (
    <div className={s.frame}>
      <div className={s.grid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cells.map((c, i) => (
          <div key={i} className={`${s.tile} ${c}`} />
        ))}
      </div>
      <div className={s.layer}>
        <svg className={s.svg} aria-hidden="true">
          {routes.map((r) => {
            const a = island(g, r.a), b = island(g, r.b);
            return (
              <g key={r.id}>
                <line className={s.shipLine} x1={px(a.x) + '%'} y1={py(a.y) + '%'} x2={px(b.x) + '%'} y2={py(a.y) + '%'} />
                <line className={s.shipLine} x1={px(b.x) + '%'} y1={py(a.y) + '%'} x2={px(b.x) + '%'} y2={py(b.y) + '%'} />
              </g>
            );
          })}
          {tgt && dist > 0 && <line className={s.route} x1={px(p.x) + '%'} y1={py(p.y) + '%'} x2={px(tgt.x) + '%'} y2={py(tgt.y) + '%'} />}
        </svg>
        {discovered
          .filter((i) => inView(i.x, i.y))
          .map((i) => {
            const st = islandStatus(g, i);
            const note = st.note ? ' · ' : '';
            return (
              <button
                key={i.id}
                className={`${s.mark} ${st.cls} ${i.id === p.target ? s.tgt : ''}`}
                style={{ left: px(i.x) + '%', top: py(i.y) + '%', width: tileW }}
                onClick={() => store.dispatch({ t: 'setTarget', islandId: i.id === p.target ? null : i.id })}
                aria-label={t('ui.setTarget', { isl: t('island.' + i.id) })}
              >
                <svg viewBox="-5 -5 10 10" aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%', transform: `rotate(${i.rot}deg)` }}>
                  <path className={s.land} d={LAND} />
                </svg>
                <span className={s.mlab}>
                  {t('island.' + i.id)}
                  {note}
                  {st.note && <M m={st.note} />}
                </span>
              </button>
            );
          })}
        {routes.map((r) => {
          const b = boatPos(g, r);
          if (!inView(Math.round(b.x), Math.round(b.y))) return null;
          return <span key={r.id} className={s.boat} style={{ left: px(b.x) + '%', top: py(b.y) + '%' }} title={t('ui.routeNo', { no: r.no })} />;
        })}
        <span className={s.me} style={{ left: px(p.x) + '%', top: py(p.y) + '%', width: tileW }}>
          <span className={s.dot} />
        </span>
        {chip && (
          <span className={s.chip} style={{ left: chip.left + '%', top: chip.top + '%' }}>
            {chip.text}
          </span>
        )}
      </div>
      <div className={s.zoom}>
        <button className={s.zbtn} onClick={() => ui.setZoom(ui.zoom - 1)} disabled={ui.zoom === 0} aria-label={t('ui.zoomIn')}>+</button>
        <button className={s.zbtn} onClick={() => ui.setZoom(ui.zoom + 1)} disabled={ui.zoom === ZOOMS.length - 1} aria-label={t('ui.zoomOut')}>-</button>
      </div>
      {picking && (
        <div className={s.picker}>
          {discovered
            .filter((i) => i.id !== 'bureau' || g.flags.flightDone)
            .map((i) => {
              const d = dirOf(i.x - p.x, i.y - p.y);
              return (
                <button
                  key={i.id}
                  className={s.opt}
                  onClick={() => {
                    store.dispatch({ t: 'setTarget', islandId: i.id });
                    setPicking(false);
                  }}
                >
                  <span>{t('island.' + i.id)}</span>
                  <span style={{ color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                    {d.arrow} {t('ui.tiles', { n: manhattan(i.x, i.y, p.x, p.y) })}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

