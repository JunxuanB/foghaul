import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { clockParts, dayBarPos, hmParts, isNight, untilNight } from '../../sim/clock';
import { useGame, useStore } from '../../store/hooks';
import { bar } from '../selectors';
import { useUi } from '../ui';

const T = BALANCE.time;

export function Header() {
  const g = useGame();
  const store = useStore();
  const ui = useUi();
  const p = g.player;
  const c = clockParts(g.time);
  const left = untilNight(g.time);
  const S = BALANCE.survival;
  const low = (v: number) => (v < 25 ? 'tone-st' : v < 45 ? 'tone-al' : '');
  const dayLen = (T.duskStart - T.dayStart) / 60;
  const duskLen = (T.nightStart - T.duskStart) / 60;
  const nightLen = 24 - dayLen - duskLen;
  const transport = g.people.some((x) => x.role === 'pilot' && x.active);
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 14, borderBottom: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: ui.lang === 'zh' ? '0.3em' : '0.08em' }}>
          {t('ui.title')}
        </h1>
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', fontSize: 15 }}>
          <span style={{ fontWeight: 700 }}>{t('ui.clock', { day: c.day, hh: c.hh, mm: c.mm })}</span>
          <div aria-hidden="true" style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
            <div style={{ display: 'flex', height: 8 }}>
              <span style={{ flex: `${dayLen} 1 0`, background: 'var(--soft)' }} />
              <span style={{ flex: `${duskLen} 1 0`, background: 'var(--warn)' }} />
              <span style={{ flex: `${nightLen} 1 0`, background: 'var(--fog)', boxShadow: 'inset 0 0 0 1px var(--edge)' }} />
            </div>
            <span style={{ position: 'absolute', left: dayBarPos(g.time) + '%', top: -3, width: 2, height: 14, background: 'var(--ink)', boxShadow: '0 0 0 1px var(--bg)' }} />
            <div style={{ display: 'flex', marginTop: 3, fontSize: 12, color: 'var(--soft)' }}>
              <span style={{ flex: `${dayLen} 1 0` }}>{t('ui.day')}</span>
              <span style={{ flex: `${duskLen} 1 0` }}>{t('ui.dusk')}</span>
              <span style={{ flex: `${nightLen} 1 0` }}>{t('ui.night')}</span>
            </div>
          </div>
          <span style={{ color: 'var(--alert)' }}>
            {isNight(g.time) ? t('ui.nightNow') : t('ui.untilNight', { t: t('ui.hm', hmParts(left)) })}
          </span>
          {!store.running && !g.cutscene && <span className="tone-st">{t('ui.paused')}</span>}
        </div>
        <nav aria-label={t('ui.panels')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button className="cmd" onClick={() => ui.open('people')}>{t('ui.people')}</button>
          <button className="cmd" onClick={() => ui.open('islands')}>{t('ui.islands')}</button>
          {transport && <button className="cmd" onClick={() => ui.open('routes')}>{t('ui.routes')}</button>}
          <button className="cmd" onClick={() => ui.open('journal')}>{t('ui.journal')}</button>
          <button className="cmd" onClick={() => store.setPaused(!store.paused)} aria-pressed={store.paused}>
            {store.paused ? t('ui.resume') : t('ui.pause')}
          </button>
          <button className="cmd" onClick={() => ui.open('settings')}>{t('ui.settings')}</button>
        </nav>
      </div>
      <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 28px', fontSize: 15 }}>
        <span className={low(p.hp)}>{t('ui.hp')} <span aria-hidden="true">{bar(p.hp, S.maxHp)}</span> {Math.round(p.hp)}</span>
        <span className={low(p.water)}>{t('ui.water')} <span aria-hidden="true">{bar(p.water, S.maxWater)}</span> {Math.round(p.water)}</span>
        <span className={low(p.food)}>{t('ui.food')} <span aria-hidden="true">{bar(p.food, S.maxFood)}</span> {Math.round(p.food)}</span>
      </p>
    </header>
  );
}
