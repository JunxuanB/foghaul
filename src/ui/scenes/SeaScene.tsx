import { t } from '../../i18n';
import { islandAt } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { Inventory } from '../components/Inventory';
import { LogView } from '../components/LogView';
import { MapPanel } from '../components/MapPanel';
import { ObjectiveCard } from '../components/Objective';

export function SeaScene() {
  const g = useGame();
  const store = useStore();
  const isl = islandAt(g, g.player.x, g.player.y);
  const onIsle = isl && isl.discovered;
  return (
    <main style={{ display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'flex-start' }}>
      <section aria-label={t('ui.events')} style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <LogView />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 44 }}>
            {g.pendingCrate && (
              <button className="cmd lead" onClick={() => store.dispatch({ t: 'takeCrate' })}>{t('ui.takeCrate')}</button>
            )}
            {onIsle && (
              <button className="cmd lead" onClick={() => store.dispatch({ t: 'dock' })}>
                {t('ui.dock', { isl: t('island.' + isl.id) })}
              </button>
            )}
            {!g.pendingCrate && !onIsle && <span style={{ fontSize: 15, color: 'var(--dim)' }}>{t('ui.calm')}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="cmd" onClick={() => store.dispatch({ t: 'drinkSea' })}>{t('ui.drinkSea')}</button>
            <button className="cmd" onClick={() => store.dispatch({ t: 'fishSea' })}>{t('ui.fishSea')}</button>
          </div>
        </div>
        <ObjectiveCard />
      </section>
      <MapPanel />
      <Inventory />
    </main>
  );
}
