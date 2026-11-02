import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { clockParts, dayBarPos, hmParts, isNight, untilNight } from '../../sim/clock';
import { has } from '../../sim/tutorial';
import { useGame, useStore } from '../../store/hooks';
import { useNarrow } from '../hooks';
import { bar } from '../selectors';
import { useUi, type DialogKind } from '../ui';

const T = BALANCE.time;

function DayBar() {
  const g = useGame();
  const dayLen = (T.duskStart - T.dayStart) / 60;
  const duskLen = (T.nightStart - T.duskStart) / 60;
  const nightLen = 24 - dayLen - duskLen;
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
      <div style={{ display: 'flex', height: 8 }}>
        <span style={{ flex: `${dayLen} 1 0`, background: 'var(--soft)' }} />
        <span style={{ flex: `${duskLen} 1 0`, background: 'var(--warn)' }} />
        <span style={{ flex: `${nightLen} 1 0`, background: 'var(--fog)', boxShadow: 'inset 0 0 0 1px var(--edge)' }} />
      </div>
      <span style={{ position: 'absolute', left: dayBarPos(g.time) + '%', top: -3, width: 2, height: 14, background: 'var(--ink)', boxShadow: '0 0 0 1px var(--bg)' }} />
      <div style={{ display: 'flex', marginTop: 3, fontSize: 12, color: 'var(--soft)' }}>
        <span style={{ flex: `${dayLen} 1 0` }}>{t('ui.day')}</span>
        <span style={{ flex: `${duskLen + nightLen} 1 0`, display: 'flex', gap: 6 }}>
          <span>{t('ui.dusk')}</span>
          <span style={{ marginLeft: 'auto' }}>{t('ui.night')}</span>
        </span>
      </div>
    </div>
  );
}

function useNav(): [DialogKind, string][] {
  const g = useGame();
  const out: [DialogKind, string][] = [];
  if (has(g, 'people')) out.push(['people', t('ui.people')]);
  if (has(g, 'islands')) out.push(['islands', t('ui.islands')]);
  if (has(g, 'routes')) out.push(['routes', t('ui.routes')]);
  if (has(g, 'clock')) out.push(['journal', t('ui.journal')]);
  out.push(['help', t('ui.help')]);
  out.push(['settings', t('ui.settings')]);
  return out;
}

/** 随时随地的求生动作：喝海水、跳海捕鱼 */
function Survival() {
  const store = useStore();
  const g = useGame();
  if (!has(g, 'seawater') && !has(g, 'dive')) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {has(g, 'seawater') && (
        <button className="cmd mini" onClick={() => store.dispatch({ t: 'drinkSea' })} title={t('ui.drinkSeaHint')}>
          {t('ui.drinkSea')}
        </button>
      )}
      {has(g, 'dive') && (
        <button className="cmd mini" onClick={() => store.dispatch({ t: 'fishSea' })} title={t('ui.fishSeaHint')}>
          {t('ui.fishSea')}
        </button>
      )}
    </span>
  );
}

function Stats({ compact }: { compact: boolean }) {
  const g = useGame();
  const p = g.player;
  const S = BALANCE.survival;
  const low = (v: number) => (v < 25 ? 'tone-st' : v < 45 ? 'tone-al' : '');
  const items: [string, number, number][] = [
    [t('ui.hp'), p.hp, S.maxHp],
    [t('ui.water'), p.water, S.maxWater],
    [t('ui.food'), p.food, S.maxFood],
  ];
  return (
    <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: compact ? '4px 14px' : '4px 28px', fontSize: compact ? 14 : 15 }}>
      {items.map(([label, v, max]) => (
        <span key={label} className={low(v)}>
          {label} <span aria-hidden="true">{bar(v, max, compact ? 5 : 10)}</span> {Math.round(v)}
        </span>
      ))}
    </p>
  );
}

export function Header() {
  const g = useGame();
  const store = useStore();
  const ui = useUi();
  const narrow = useNarrow();
  const [menu, setMenu] = useState(false);
  const c = clockParts(g.time);
  const left = untilNight(g.time);
  const nav = useNav();
  const nightText = isNight(g.time) ? t('ui.nightNow') : t('ui.untilNight', { t: t('ui.hm', hmParts(left)) });
  const clock = has(g, 'clock');
  const pauseBtn = !clock ? null : (
    <button className="cmd" onClick={() => store.setPaused(!store.paused)} aria-pressed={store.paused}>
      {store.paused ? t('ui.resume') : t('ui.pause')}
    </button>
  );
  if (narrow) {
    return (
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10, borderBottom: '1px dashed var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {clock ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14 }}>
              <strong>{t('ui.clock', { day: c.day, hh: c.hh, mm: c.mm })}</strong>
              <span style={{ color: 'var(--alert)', fontSize: 13 }}>
                {nightText}
                {!store.running && !g.cutscene && <span className="tone-st"> · {t('ui.paused')}</span>}
              </span>
            </div>
          ) : (
            <strong style={{ letterSpacing: '0.2em' }}>{t('ui.title')}</strong>
          )}
          <button className="cmd" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            {menu ? t('ui.close') : t('ui.menu')}
          </button>
        </div>
        {menu && (
          <nav aria-label={t('ui.panels')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {nav.map(([k, label]) => (
              <button key={k} className="cmd" onClick={() => { setMenu(false); ui.open(k); }}>{label}</button>
            ))}
            {pauseBtn}
          </nav>
        )}
        {clock && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Stats compact />
            <Survival />
          </div>
        )}
      </header>
    );
  }
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 14, borderBottom: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: ui.lang === 'zh' ? '0.3em' : '0.08em' }}>{t('ui.title')}</h1>
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', fontSize: 15 }}>
          {clock && (
            <>
              <span style={{ fontWeight: 700 }}>{t('ui.clock', { day: c.day, hh: c.hh, mm: c.mm })}</span>
              <DayBar />
              <span style={{ color: 'var(--alert)' }}>{nightText}</span>
              {!store.running && !g.cutscene && <span className="tone-st">{t('ui.paused')}</span>}
            </>
          )}
        </div>
        <nav aria-label={t('ui.panels')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {nav.map(([k, label]) => (
            <button key={k} className="cmd" onClick={() => ui.open(k)}>{label}</button>
          ))}
          {pauseBtn}
        </nav>
      </div>
      {clock && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 28px' }}>
          <Stats compact={false} />
          <Survival />
        </div>
      )}
    </header>
  );
}
