import { t } from '../../i18n';
import { islandAt } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { Inventory } from '../components/Inventory';
import { LogView } from '../components/LogView';
import { MapPanel } from '../components/MapPanel';
import { ObjectiveCard } from '../components/Objective';
import { Tabs } from '../components/Tabs';
import { TipBox } from '../components/Tip';
import { useNarrow } from '../hooks';

function SeaActions() {
  const g = useGame();
  const store = useStore();
  const isl = islandAt(g, g.player.x, g.player.y);
  const onIsle = isl && isl.discovered;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  );
}

export function SeaScene() {
  const narrow = useNarrow();
  if (narrow) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TipBox />
        <LogView count={2} big={false} />
        <MapPanel />
        <SeaActions />
        <ObjectiveCard />
        <Tabs
          tabs={[
            { id: 'items', label: t('ui.tab.items'), node: <Inventory /> },
            { id: 'log', label: t('ui.tab.log'), node: <LogView count={8} big={false} /> },
          ]}
        />
      </main>
    );
  }
  return (
    <main style={{ display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'flex-start' }}>
      <section aria-label={t('ui.events')} style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <TipBox />
        <LogView />
        <div style={{ paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
          <SeaActions />
        </div>
        <ObjectiveCard />
      </section>
      <MapPanel />
      <Inventory />
    </main>
  );
}
