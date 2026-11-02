import { useState } from 'react';
import { t } from '../../i18n';
import { dirOf, island, manhattan } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { MapView } from './MapView';
import { useNarrow } from '../hooks';

export function MapPanel() {
  const g = useGame();
  const store = useStore();
  const [picking, setPicking] = useState(false);
  const narrow = useNarrow();
  const k = narrow ? 56 : 48;
  const p = g.player;
  const tgt = p.target ? island(g, p.target) : null;
  let guide = t('ui.noTarget');
  if (tgt) {
    const dist = manhattan(tgt.x, tgt.y, p.x, p.y);
    const d = dirOf(tgt.x - p.x, tgt.y - p.y);
    guide =
      dist === 0
        ? t('ui.arrivedAt', { isl: t('island.' + tgt.id) })
        : t('ui.targetGuide', { isl: t('island.' + tgt.id), arrow: d.arrow, dir: t(d.key), n: dist });
  }
  const atSea = !p.at;
  const go = (dx: number, dy: number) => store.dispatch({ t: 'move', dx, dy });
  return (
    <section aria-label={t('ui.chart')} style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MapView picking={picking} setPicking={setPicking} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', fontSize: 15 }}>
        <p data-coach="guide" style={{ flex: '1 1 200px', margin: 0 }}>{guide}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="cmd mini" onClick={() => setPicking(!picking)}>
            {picking ? t('ui.collapse') : tgt ? t('ui.change') : t('ui.pickTarget')}
          </button>
          {tgt && (
            <button className="cmd mini" onClick={() => store.dispatch({ t: 'setTarget', islandId: null })}>
              {t('ui.cancel')}
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 14, color: 'var(--soft)' }}>
        <Legend cls="isle" k="ui.legend.ok" />
        <Legend cls="warn" k="ui.legend.warn" />
        <Legend cls="stop" k="ui.legend.stop" />
        <Legend cls="neutral" k="ui.legend.other" />
        <Legend cls="open" k="ui.legend.open" />
        <Legend cls="fog" k="ui.legend.fog" />
      </div>
      {atSea && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div data-coach="dpad" style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${k}px)`, gridTemplateRows: `repeat(2, ${k}px)`, gap: 4 }}>
            <span />
            <button className="cmd" style={{ padding: 0 }} onClick={() => go(0, -1)} aria-label={t('ui.moveUp')}>{t('ui.up')}</button>
            <span />
            <button className="cmd" style={{ padding: 0 }} onClick={() => go(-1, 0)} aria-label={t('ui.moveLeft')}>{t('ui.left')}</button>
            <button className="cmd" style={{ padding: 0 }} onClick={() => go(0, 1)} aria-label={t('ui.moveDown')}>{t('ui.down')}</button>
            <button className="cmd" style={{ padding: 0 }} onClick={() => go(1, 0)} aria-label={t('ui.moveRight')}>{t('ui.right')}</button>
          </div>
          {!narrow && <p className="small" style={{ margin: 0, maxWidth: 260 }}>{t('ui.keysHint')}</p>}
        </div>
      )}
    </section>
  );
}

function Legend({ cls, k }: { cls: string; k: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={'sw ' + cls} style={cls === 'open' ? { boxShadow: 'inset 0 0 0 1px var(--edge)' } : undefined} />
      {t(k)}
    </span>
  );
}
