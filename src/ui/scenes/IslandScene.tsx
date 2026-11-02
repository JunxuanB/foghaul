import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { RECIPES } from '../../config/recipes';
import { ISLANDS } from '../../config/world';
import { t, tm } from '../../i18n';
import { buildCost, canUseStock, here, trainCost } from '../../sim/actions';
import { canSleepNow, isNight } from '../../sim/clock';
import { islandRate, peopleCap } from '../../sim/economy';
import { canPay, stockCap } from '../../sim/inventory';
import { stockP } from '../../sim/msg';
import { everyoneOn, facilityMsg, headcountOf, isHungry, jobMsg, presentPeople, sameJob, teachableJobs } from '../../sim/people';
import { personLevel } from '../../sim/progression';
import type { Island, Job, Person } from '../../sim/types';
import { villageOf } from '../../sim/villages';
import { useGame, useStore } from '../../store/hooks';
import { Inventory, ItemRows, useItemActs } from '../components/Inventory';
import { LogView } from '../components/LogView';
import { ObjectiveCard } from '../components/Objective';
import { M, T } from '../components/Text';
import { useUi } from '../ui';
import { useNarrow } from '../hooks';
import { Tabs } from '../components/Tabs';
import { TipBox } from '../components/Tip';
import { has } from '../../sim/tutorial';
import { BureauPanel } from './BureauPanel';
import { CraftPanel } from './CraftPanel';
import { HomePanel } from './HomePanel';
import { NeedList } from './NeedPanel';
import { VillagePanel } from './VillagePanel';

export function IslandScene() {
  const g = useGame();
  const store = useStore();
  const narrow = useNarrow();
  const isl = here(g)!;
  const owned = canUseStock(isl);
  const vid = villageOf(isl);
  const tpl = ISLANDS.find((x) => x.id === isl.id)!;
  const need = tpl.rescueNeed ?? tpl.recruitNeed;
  const waiting =
    need &&
    !isl.owned &&
    (isl.kind !== 'islet' || g.people.some((p) => p.loc.kind === 'island' && p.loc.id === isl.id && !p.active));
  const home = isl.kind === 'home';
  const sub: string[] = [];
  if (isl.biome) sub.push(t('biome.' + isl.biome));
  if (owned && !home) sub.push(t('ui.level', { n: isl.level }));
  if ((owned && (!home || has(g, 'people'))) || vid) sub.push(t('ui.pop', { n: headcountOf(g, isl), cap: peopleCap(isl) >= 99 ? '∞' : peopleCap(isl) }));
  const showStock = owned && (!home || has(g, 'build') || Object.keys(isl.stock).length > 0);
  const showBuild = owned && (!home || has(g, 'build'));

  const main = (
    <>
      <Alerts isl={isl} />
      {home && <HomePanel />}
      {waiting && need && (
        <NeedList
          need={need}
          progress={isl.needProgress}
          title={isl.kind === 'native' ? t('ui.recruitTitle') : t('ui.rescueTitle', { who: t('role.' + tpl.passenger) })}
        />
      )}
      {vid && <VillagePanel vid={vid} />}
      {isl.kind === 'bureau' && <BureauPanel />}
      <div className="grid2" style={{ fontSize: 15 }}>
        {owned && !home && <FacilitySection isl={isl} />}
        <PeopleSection isl={isl} />
        {showStock && <StockSection isl={isl} />}
        {showBuild && <BuildSection isl={isl} />}
        {has(g, 'craft') && <CraftPanel />}
        <DockSection isl={isl} />
      </div>
    </>
  );

  const head = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <h2 id="isle-name" style={{ margin: 0, fontSize: narrow ? 28 : 36, fontWeight: 700, lineHeight: 1.2 }}>{t('island.' + isl.id)}</h2>
        {sub.length > 0 && <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--soft)' }}>{sub.join(' / ')}</p>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {isl.buildings.bed && has(g, 'sleep') && (
          <button className={'cmd' + (canSleepNow(g.time) && isNight(g.time) ? ' lead' : '')} disabled={!canSleepNow(g.time)} onClick={() => store.dispatch({ t: 'sleep' })} title={t('ui.sleepHint')}>
            {t('ui.sleep')}
          </button>
        )}
        {has(g, 'sea') && <button className="cmd" onClick={() => store.dispatch({ t: 'wait', minutes: 60 })}>{t('ui.wait1h')}</button>}
        <FlyButton isl={isl} />
        {g.player.hasRaft && (
          <button className="cmd lead" onClick={() => store.dispatch({ t: 'leave' })}>{t('ui.setSail')}</button>
        )}
      </div>
    </div>
  );

  const seaside = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 15 }}>
      <span className="small">{t('ui.seaside')}</span>
      <button className="cmd mini" onClick={() => store.dispatch({ t: 'drinkSea' })}>{t('ui.drinkSea')}</button>
      <button className="cmd mini" onClick={() => store.dispatch({ t: 'fishSea' })}>{t('ui.fishSea')}</button>
    </div>
  );

  if (narrow) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {head}
        <TipBox />
        <LogView count={2} big={false} />
        <ObjectiveCard />
        <Tabs
          tabs={[
            { id: 'isle', label: t('ui.tab.island'), node: <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{main}{seaside}</div> },
            { id: 'items', label: t('ui.tab.items'), node: <Inventory /> },
            { id: 'log', label: t('ui.tab.log'), node: <LogView count={8} big={false} /> },
          ]}
        />
      </main>
    );
  }

  return (
    <main style={{ display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'flex-start' }}>
      <section aria-labelledby="isle-name" style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {head}
        <TipBox />
        {main}
        {seaside}
        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
          <LogView count={4} big={false} />
        </div>
      </section>
      <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <ObjectiveCard />
        <Inventory />
      </div>
    </main>
  );
}

function FlyButton({ isl }: { isl: Island }) {
  const g = useGame();
  const store = useStore();
  const [open, setOpen] = useState(false);
  if (!g.flags.flightDone || !isl.buildings.helipad) return null;
  const dests = g.islands.filter((i) => i.discovered && i.buildings.helipad && i.id !== isl.id);
  return (
    <span style={{ position: 'relative' }}>
      <button className="cmd" onClick={() => setOpen(!open)}>{t('ui.fly')}</button>
      {open && (
        <span className="box" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 5, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          {dests.map((d) => (
            <button key={d.id} className="cmd mini" onClick={() => { setOpen(false); store.dispatch({ t: 'fly', to: d.id }); }}>
              {t('island.' + d.id)}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function Alerts({ isl }: { isl: Island }) {
  const g = useGame();
  const store = useStore();
  const out: JSX.Element[] = [];
  if (isl.sleepy)
    out.push(
      <div key="sleepy" className="box box-stop" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{t('ui.sleepyAlert')}</span>
        <button className="cmd lead" onClick={() => store.dispatch({ t: 'wake' })}>{t('ui.wake')}</button>
      </div>,
    );
  if (isl.owned && isl.lastMeal && isl.lastMeal !== 'full' && isl.lastMealNote)
    out.push(
      <div key="meal" className={'box ' + (isl.lastMeal === 'none' ? 'box-stop' : 'box-alert')}>
        <T k={isl.lastMeal === 'none' ? 'ui.mealNone' : 'ui.mealPartial'} p={{ note: { k: 'mealui.' + isl.lastMealNote } }} />
      </div>,
    );
  if (isl.owned && (isl.workNote === 'work.full' || isl.workNote === 'work.noInput'))
    out.push(
      <div key="work" className="box box-alert">
        {t(isl.workNote === 'work.full' ? 'ui.fullAlert' : 'ui.noInputAlert')}
      </div>,
    );
  void g;
  return <>{out}</>;
}

function demandKey(isl: Island): string {
  return 'ui.demand' + Math.min(3, isl.level);
}

function FacilitySection({ isl }: { isl: Island }) {
  const g = useGame();
  const r = islandRate(g, isl);
  const fac = isl.facility;
  let rateText = '';
  if (fac && r.rate > 0) {
    if (fac.kind === 'produce') rateText = t('ui.ratePerHour', { n: Math.round(r.rate * 10) / 10, item: t('item.' + fac.item) });
    else rateText = t('ui.batchPerHour', { n: Math.round(r.rate * 100) / 100 });
  }
  const fac2 = fac?.kind === 'process' ? RECIPES[fac.recipe] : null;
  return (
    <section>
      <h3 className="h3">{t('ui.facility')}</h3>
      <ul className="list">
        <li className="row">
          <span className="nm"><M m={facilityMsg(fac)} /></span>
          <span className={r.rate > 0 ? 'meta' : 'meta tone-al'}>{t(isl.workNote || r.note)}</span>
        </li>
        {fac2 && (
          <li className="row">
            <span className="nm small"><T k="ui.recipeIO" p={{ ins: stockP(fac2.inputs), outs: stockP(fac2.outputs) }} /></span>
          </li>
        )}
        {rateText && (
          <li className="row">
            <span className="nm">{t('ui.output')}</span>
            <span className="meta">{rateText}</span>
          </li>
        )}
        <li className="row">
          <span className="nm">{t('ui.demand')}</span>
          <span className="meta">{t(demandKey(isl))}</span>
        </li>
        {isl.level < 3 && (
          <li className="row">
            <span className="nm">{t('ui.toNextLevel')}</span>
            <span className="meta">{t('ui.mealStreak', { n: isl.mealStreak, total: BALANCE.economy.mealsToUpgrade })}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function personMeta(g: ReturnType<typeof useGame>, p: Person, isl: Island): { text: string; cls: string } {
  if (!p.active) return { text: p.type === 'native' ? t('ui.notRecruited') : t('ui.awaitingRescue'), cls: 'meta tone-al' };
  if (p.learning) return { text: t('ui.learningShort', { recipe: t('recipe.' + p.learning.recipe) }), cls: 'meta' };
  const parts: string[] = [];
  if (p.type === 'passenger') parts.push('Lv.' + personLevel(p));
  else parts.push(tm(jobMsg(p.job)));
  if (isHungry(g, p)) return { text: parts.concat(t('mealui.' + isl.lastMealNote)).join(' · '), cls: 'meta tone-al' };
  if (isl.facility && p.type === 'native' && p.job && p.job.kind !== 'crew' && !sameJob(p.job, isl.facility))
    parts.push(t('ui.idleWrongJob'));
  return { text: parts.join(' · '), cls: 'meta' };
}

function PeopleSection({ isl }: { isl: Island }) {
  const g = useGame();
  const store = useStore();
  const [training, setTraining] = useState<string | null>(null);
  const people = everyoneOn(g, isl);
  const owned = canUseStock(isl);
  const trainers = presentPeople(g).filter((p) => p.type === 'passenger' && !p.learning);
  if (!people.length && (!owned || (isl.kind === 'home' && !has(g, 'people')))) return null;
  return (
    <section>
      <h3 className="h3">{t('ui.peopleHere')}</h3>
      {!people.length && <p className="empty">{t('ui.nobodyHere')}</p>}
      <ul className="list">
        {people.map((p) => {
          const meta = personMeta(g, p, isl);
          const canTrain = owned && p.type === 'native' && p.active;
          const options: { trainer: Person; job: Job }[] = [];
          if (canTrain) for (const tr of trainers) for (const j of teachableJobs(tr, isl)) if (!sameJob(j, p.job)) options.push({ trainer: tr, job: j });
          return (
            <li key={p.id} className="row" style={{ flexWrap: 'wrap' }}>
              <span className="nm">{tm(p.name)}</span>
              <span className={meta.cls}>{meta.text}</span>
              <span className="acts">
                {canTrain && (
                  <button className="cmd mini" onClick={() => setTraining(training === p.id ? null : p.id)} aria-expanded={training === p.id}>
                    {p.job ? t('ui.retrain') : t('ui.train')}
                  </button>
                )}
                {p.active && !p.learning && g.player.hasRaft && (
                  <button className="cmd mini" onClick={() => store.dispatch({ t: 'pickUp', personId: p.id })}>{t('ui.pickUp')}</button>
                )}
              </span>
              {training === p.id && (
                <div style={{ flexBasis: '100%', padding: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {!options.length && <span className="small">{t('ui.noTrainer')}</span>}
                  {options.map((o, i) => {
                    const cost = trainCost(o.job);
                    const ok = canPay(g, isl, cost) && !isHungry(g, o.trainer);
                    return (
                      <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span className="small">
                          <M m={jobMsg(o.job)} /> · {tm(o.trainer.name)} · <T k="ui.costShort" p={{ cost: stockP(cost) }} />
                          {isHungry(g, o.trainer) && <span className="tone-al"> · {t('ui.trainerHungry')}</span>}
                        </span>
                        <button
                          className="cmd mini lead"
                          disabled={!ok}
                          onClick={() => {
                            store.dispatch({ t: 'train', personId: p.id, trainerId: o.trainer.id, job: o.job });
                            setTraining(null);
                          }}
                        >
                          {t('ui.confirmTrain')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StockSection({ isl }: { isl: Island }) {
  const g = useGame();
  const acts = useItemActs();
  return (
    <section>
      <h3 className="h3">{t('ui.stock')}</h3>
      <p className="note">{t('ui.stockNote')}</p>
      <ItemRows stock={isl.stock} acts={acts('stock')} cap={(id) => stockCap(g, isl, id)} empty={t('ui.stockEmpty')} />
    </section>
  );
}

function BuildSection({ isl }: { isl: Island }) {
  const g = useGame();
  const store = useStore();
  const rows: { key: string; name: string; done: boolean; cost: ReturnType<typeof buildCost>; onClick: () => void; extra?: string }[] = [];
  if (isl.kind !== 'bureau') {
    if (isl.kind !== 'home')
      rows.push({ key: 'lighthouse', name: t('ui.b.lighthouse'), done: isl.buildings.lighthouse, cost: buildCost(g, 'lighthouse'), onClick: () => store.dispatch({ t: 'build', what: 'lighthouse' }) });
    rows.push({ key: 'bed', name: t('ui.b.bed'), done: isl.buildings.bed, cost: buildCost(g, 'bed'), onClick: () => store.dispatch({ t: 'build', what: 'bed' }) });
    if (isl.kind !== 'home')
      rows.push({ key: 'depot', name: t('ui.b.depot'), done: isl.buildings.depot, cost: buildCost(g, 'depot'), onClick: () => store.dispatch({ t: 'build', what: 'depot' }) });
    if (g.flags.planeRepaired)
      rows.push({ key: 'helipad', name: t('ui.b.helipad'), done: isl.buildings.helipad, cost: buildCost(g, 'helipad'), onClick: () => store.dispatch({ t: 'build', what: 'helipad' }) });
    if (isl.kind === 'home' && g.player.hasRaft) {
      const c = buildCost(g, 'holdUpgrade');
      rows.push({ key: 'hold', name: t('ui.b.hold', { cap: g.player.holdCap }), done: c === null, cost: c, onClick: () => store.dispatch({ t: 'build', what: 'holdUpgrade' }) });
    }
  }
  const eng = presentPeople(g).find((p) => p.role === 'engineer');
  const canRaft = eng?.recipes.includes('transportRaft');
  return (
    <section>
      <h3 className="h3">{t('ui.build')}</h3>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.key} className="row">
            <span className="nm">
              {r.name}
              {!r.done && r.cost && (
                <span className="small" style={{ display: 'block' }}>
                  <T k="ui.costShort" p={{ cost: stockP(r.cost) }} />
                </span>
              )}
            </span>
            <span className="meta">{r.done ? t('ui.built') : ''}</span>
            <span className="acts">
              {!r.done && r.cost && (
                <button className="cmd mini" disabled={!canPay(g, isl, r.cost)} onClick={r.onClick}>{t('ui.doBuild')}</button>
              )}
            </span>
          </li>
        ))}
        {canRaft && (
          <li className="row">
            <span className="nm">
              {t('ui.b.transportRaft', { n: g.transport.rafts })}
              <span className="small" style={{ display: 'block' }}>
                <T k="ui.costShort" p={{ cost: stockP(RECIPES.transportRaft.inputs) }} />
              </span>
            </span>
            <span className="acts">
              <button className="cmd mini" disabled={!canPay(g, isl, RECIPES.transportRaft.inputs)} onClick={() => store.dispatch({ t: 'buildTransportRaft' })}>
                {t('ui.doBuild')}
              </button>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}

function DockSection({ isl }: { isl: Island }) {
  const g = useGame();
  const ui = useUi();
  const routes = g.transport.routes.filter((r) => r.a === isl.id || r.b === isl.id);
  if (!routes.length) return null;
  return (
    <section style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h3 className="h3" style={{ margin: 0 }}>{t('ui.dockRoutes')}</h3>
        <button className="cmd mini" onClick={() => ui.open('routes')}>{t('ui.allRoutes')}</button>
      </div>
      <ul className="list">
        {routes.map((r) => (
          <li key={r.id} className="row">
            <span className="nm" style={{ flex: '1 1 170px' }}>
              {t('island.' + r.a)} ⇄ {t('island.' + r.b)}
            </span>
            <span className="meta" style={{ flex: '1 1 180px' }}>
              {t('ui.cargoLine', { ab: r.cargoAB ? t('item.' + r.cargoAB) : t('cargo.empty'), ba: r.cargoBA ? t('item.' + r.cargoBA) : t('cargo.empty') })}
            </span>
            <span className="meta" style={{ flex: '1 1 130px' }}><M m={r.note} /></span>
            <button className="cmd mini" onClick={() => ui.open('routes', r.id)}>{t('ui.configure')}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
