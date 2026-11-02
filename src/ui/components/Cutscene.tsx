import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { dayOf } from '../../sim/clock';
import { useGame, useStore } from '../../store/hooks';
import { Rich } from './Text';

/** 过场：逐行显示，最后一行后结束 */
export function Cutscene() {
  const g = useGame();
  const store = useStore();
  const c = g.cutscene;
  const [shown, setShown] = useState(1);
  useEffect(() => setShown(1), [c?.kind]);
  if (!c) return null;
  const done = shown >= c.lines.length;
  const s = g.stats;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ maxWidth: 720, width: '100%', background: 'var(--bg)', border: '1px solid var(--edge)', padding: '28px clamp(16px, 4vw, 40px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.2em', color: 'var(--soft)' }}>
          {c.kind === 'flight' ? t('ui.cut.flight') : t('ui.cut.ending')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 18, lineHeight: 1.7 }}>
          {c.lines.slice(0, shown).map((k, i) => (
            <p key={i} style={{ margin: 0, color: i === shown - 1 ? 'var(--ink)' : 'var(--soft)' }}>
              <Rich s={t(k)} />
            </p>
          ))}
        </div>
        {done && c.kind === 'ending' && (
          <dl className="dl" style={{ borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
            <dt>{t('ui.stat.days')}</dt><dd>{dayOf(g.time)}</dd>
            <dt>{t('ui.stat.moves')}</dt><dd>{s.moves}</dd>
            <dt>{t('ui.stat.fights')}</dt><dd>{s.wins}/{s.fights}</dd>
            <dt>{t('ui.stat.deaths')}</dt><dd>{s.deaths}</dd>
            <dt>{t('ui.stat.transported')}</dt><dd>{s.transported}</dd>
            <dt>{t('ui.stat.network')}</dt><dd>{g.islands.filter((i) => i.owned).length}</dd>
          </dl>
        )}
        <button
          className="cmd lead"
          style={{ alignSelf: 'flex-end' }}
          autoFocus
          onClick={() => (done ? store.dispatch({ t: 'endCutscene' }) : setShown(shown + 1))}
        >
          {done ? (c.kind === 'ending' ? t('ui.cut.endless') : t('ui.cut.land')) : t('ui.cut.next')}
        </button>
      </div>
    </div>
  );
}
