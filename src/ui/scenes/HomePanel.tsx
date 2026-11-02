import { BALANCE } from '../../config/balance';
import { PART_IDS } from '../../config/items';
import { t } from '../../i18n';
import { plotReady } from '../../sim/actions';
import { hmParts } from '../../sim/clock';
import { canPay } from '../../sim/inventory';
import { stockP } from '../../sim/msg';
import { presentPeople } from '../../sim/people';
import type { Stock } from '../../sim/types';
import { island } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { T } from '../components/Text';

const H = BALANCE.home;

export function HomePanel() {
  const g = useGame();
  const store = useStore();
  const home = island(g, 'home');
  const lumber = g.people.find((p) => p.role === 'lumberjack')?.active;
  const farmer = g.people.find((p) => p.role === 'farmer')?.active;
  const raftCost = { wood: H.raft.wood };
  const pilotHere = presentPeople(g).some((p) => p.role === 'pilot');
  const installed = g.flags.partsInstalled;
  const repairCost = BALANCE.endgame.repairCost as Stock;
  return (
    <div className="grid2" style={{ fontSize: 15 }}>
      <section>
        <h3 className="h3">{t('ui.gather')}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {lumber ? (
            <button className="cmd" onClick={() => store.dispatch({ t: 'gather', what: 'chop' })}>
              {t('ui.chop', { n: H.chop.wood, min: H.chop.minutes })}
            </button>
          ) : (
            <button className="cmd" onClick={() => store.dispatch({ t: 'gather', what: 'branch' })}>
              {t('ui.branch', { min: H.branch.minutes })}
            </button>
          )}
          <button className="cmd" onClick={() => store.dispatch({ t: 'gather', what: 'shoreFish' })}>
            {t('ui.shoreFish', { min: H.shoreFish.minutes })}
          </button>
          <button className="cmd" disabled={g.flags.herbsLeft <= 0} onClick={() => store.dispatch({ t: 'gather', what: 'herb' })}>
            {t('ui.pickHerb', { n: g.flags.herbsLeft })}
          </button>
        </div>
        {!g.player.hasRaft && (
          <div className="box box-alert" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <span><T k="ui.raftNeed" p={{ cost: stockP(raftCost), have: home.stock.wood ?? 0 }} /></span>
            <button className="cmd lead" disabled={!canPay(g, home, raftCost)} onClick={() => store.dispatch({ t: 'buildRaft' })}>
              {t('ui.buildRaft')}
            </button>
          </div>
        )}
      </section>
      {farmer && (
        <section>
          <h3 className="h3">{t('ui.farm')}</h3>
          <ul className="list">
            {g.flags.farm.map((pt, i) => {
              const ready = plotReady(g, i);
              const left = pt === null ? 0 : H.farm.growMinutes - (g.time - pt);
              return (
                <li key={i} className="row">
                  <span className="nm">{t('ui.plot', { n: i + 1 })}</span>
                  <span className="meta">
                    {pt === null ? t('ui.plotEmpty') : ready ? t('ui.plotReady') : t('ui.plotGrowing', { t: t('ui.hm', hmParts(left)) })}
                  </span>
                  <span className="acts">
                    {pt === null ? (
                      <button className="cmd mini" onClick={() => store.dispatch({ t: 'plant', plot: i })}>{t('ui.sow')}</button>
                    ) : (
                      <button className="cmd mini lead" disabled={!ready} onClick={() => store.dispatch({ t: 'harvest', plot: i })}>
                        {t('ui.reap')}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h3 className="h3">{t('ui.wreck', { n: installed.length, total: PART_IDS.length })}</h3>
        <ul className="list">
          {PART_IDS.map((p) => {
            const has = (g.player.pack[p] ?? 0) > 0;
            const done = installed.includes(p);
            return (
              <li key={p} className="row">
                <span className="nm">{t('item.' + p)}</span>
                <span className={done ? 'meta' : has ? 'meta tone-al' : 'meta'}>
                  {done ? t('ui.installed') : has ? t('ui.inPack') : t('ui.missingPart')}
                </span>
                <span className="acts">
                  {has && !done && (
                    <button className="cmd mini lead" onClick={() => store.dispatch({ t: 'installPart', item: p })}>
                      {t('ui.install')}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {!g.flags.planeRepaired && installed.length === PART_IDS.length && (
          <div className="box box-alert" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span><T k="ui.repairNeed" p={{ cost: stockP(repairCost) }} /></span>
            {!pilotHere && <span className="tone-al">{t('err.needPilot')}</span>}
            <button className="cmd lead" style={{ alignSelf: 'flex-start' }} disabled={!pilotHere || !canPay(g, home, repairCost)} onClick={() => store.dispatch({ t: 'repairPlane' })}>
              {t('ui.repair')}
            </button>
          </div>
        )}
        {g.flags.planeRepaired && <p className="small">{t('ui.planeReady')}</p>}
      </section>
    </div>
  );
}
