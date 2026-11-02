import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import type { ItemId } from '../../config/items';
import { t, tm } from '../../i18n';
import { freeRafts, idleCrew, portableCargo, priorityUnlocked, reserveUnlocked, routeEndpoints, targetUnlocked } from '../../sim/transport';
import { pilotLevel } from '../../sim/progression';
import type { Route } from '../../sim/types';
import { island, manhattan } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { M } from '../components/Text';
import { useUi } from '../ui';
import { Dialog } from './Dialog';

const P = BALANCE.progression;

function CargoSelect({ value, onChange, label }: { value: ItemId | null; onChange: (v: ItemId | null) => void; label: string }) {
  return (
    <select className="sel" aria-label={label} value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as ItemId | null)}>
      <option value="">{t('cargo.empty')}</option>
      {portableCargo().map((id) => (
        <option key={id} value={id}>
          {t('item.' + id)}
        </option>
      ))}
    </select>
  );
}

function NewRoute({ onDone }: { onDone: () => void }) {
  const g = useGame();
  const store = useStore();
  const ends = routeEndpoints(g);
  const crews = idleCrew(g);
  const [a, setA] = useState(ends[0]?.id ?? '');
  const [b, setB] = useState(ends[1]?.id ?? '');
  const [ab, setAb] = useState<ItemId | null>(null);
  const [ba, setBa] = useState<ItemId | null>(null);
  const [crew, setCrew] = useState(crews[0]?.id ?? '');
  return (
    <div className="box" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 15 }}>
      <select className="sel" aria-label="A" value={a} onChange={(e) => setA(e.target.value)}>
        {ends.map((i) => <option key={i.id} value={i.id}>{t('island.' + i.id)}</option>)}
      </select>
      <span>⇄</span>
      <select className="sel" aria-label="B" value={b} onChange={(e) => setB(e.target.value)}>
        {ends.map((i) => <option key={i.id} value={i.id}>{t('island.' + i.id)}</option>)}
      </select>
      <span>{t('ui.outbound')}</span>
      <CargoSelect value={ab} onChange={setAb} label={t('ui.outbound')} />
      <span>{t('ui.return')}</span>
      <CargoSelect value={ba} onChange={setBa} label={t('ui.return')} />
      <span>{t('job.crew')}</span>
      <select className="sel" aria-label={t('job.crew')} value={crew} onChange={(e) => setCrew(e.target.value)}>
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {tm(c.name)} ({c.loc.kind === 'island' ? t('island.' + c.loc.id) : ''})
          </option>
        ))}
      </select>
      <button
        className="cmd lead"
        disabled={!a || !b || a === b || !crew}
        onClick={() => {
          const r = store.dispatch({ t: 'createRoute', a, b, cargoAB: ab, cargoBA: ba, crewId: crew });
          if (r.ok) onDone();
        }}
      >
        {t('ui.createRoute')}
      </button>
    </div>
  );
}

function NumSetting({ value, onSet, disabled }: { value: number | undefined; onSet: (n: number | null) => void; disabled: boolean }) {
  const [v, setV] = useState(value === undefined ? '' : String(value));
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input className="num" type="number" min={0} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} />
      <button className="cmd mini" disabled={disabled} onClick={() => onSet(v === '' ? null : Number(v))}>
        {t('ui.change')}
      </button>
    </span>
  );
}

function RouteDetail({ r }: { r: Route }) {
  const g = useGame();
  const store = useStore();
  const crew = g.people.find((p) => p.id === r.crewId);
  const A = island(g, r.a);
  const B = island(g, r.b);
  const lv = pilotLevel(g);
  const rows: { name: string; node: JSX.Element; locked?: string }[] = [
    { name: t('ui.outboundOf', { isl: t('island.' + r.a) }), node: <CargoSelect value={r.cargoAB} label="AB" onChange={(v) => store.dispatch({ t: 'updateRoute', id: r.id, cargoAB: v })} /> },
    { name: t('ui.outboundOf', { isl: t('island.' + r.b) }), node: <CargoSelect value={r.cargoBA} label="BA" onChange={(v) => store.dispatch({ t: 'updateRoute', id: r.id, cargoBA: v })} /> },
  ];
  for (const [isl, item] of [[A, r.cargoAB], [B, r.cargoBA]] as const) {
    if (!item || isl.kind === 'bureau') continue;
    rows.push({
      name: t('ui.reserveOf', { isl: t('island.' + isl.id), item: t('item.' + item) }),
      node: <NumSetting key={'r' + isl.id + item} value={isl.reserve[item]} disabled={!reserveUnlocked(g)} onSet={(n) => store.dispatch({ t: 'setReserve', island: isl.id, item, n: n ?? 0 })} />,
      locked: reserveUnlocked(g) ? undefined : t('ui.unlockAt', { lv: P.unlockReserveLevel }),
    });
  }
  for (const [isl, item] of [[B, r.cargoAB], [A, r.cargoBA]] as const) {
    if (!item || isl.kind === 'bureau') continue;
    rows.push({
      name: t('ui.targetOf', { isl: t('island.' + isl.id), item: t('item.' + item) }),
      node: <NumSetting key={'t' + isl.id + item} value={isl.target[item]} disabled={!targetUnlocked(g)} onSet={(n) => store.dispatch({ t: 'setTargetStock', island: isl.id, item, n })} />,
      locked: targetUnlocked(g) ? undefined : t('ui.unlockAt', { lv: P.unlockTargetLevel }),
    });
  }
  rows.push({
    name: t('ui.priority'),
    node: (
      <select className="sel" value={r.priority} disabled={!priorityUnlocked(g)} onChange={(e) => store.dispatch({ t: 'updateRoute', id: r.id, priority: e.target.value as Route['priority'] })}>
        <option value="high">{t('ui.prio.high')}</option>
        <option value="mid">{t('ui.prio.mid')}</option>
        <option value="low">{t('ui.prio.low')}</option>
      </select>
    ),
    locked: priorityUnlocked(g) ? undefined : t('ui.unlockAt', { lv: P.unlockPriorityLevel }),
  });
  return (
    <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 24 }}>
        {t('island.' + r.a)} ⇄ {t('island.' + r.b)}
      </h2>
      <p style={{ margin: 0, fontSize: 15, color: 'var(--soft)' }}>
        {t('ui.routeInfo', { no: r.no, crew: crew ? tm(crew.name) : '?', d: manhattan(A.x, A.y, B.x, B.y), w: r.supplies.water, f: r.supplies.food, n: r.delivered })}
      </p>
      <p className={r.note.k === 'route.noSupply' ? 'tone-al' : 'tone-ok'} style={{ margin: 0, fontSize: 15 }}>
        <M m={r.note} />
      </p>
      <ul className="list" style={{ fontSize: 15 }}>
        {rows.map((row, i) => (
          <li key={i} className="row">
            <span className="nm">
              {row.name}
              {row.locked && <span className="small" style={{ display: 'block' }}>{row.locked}</span>}
            </span>
            {row.node}
          </li>
        ))}
      </ul>
      <p className="small" style={{ margin: 0 }}>{t('ui.pilotLevelNote', { lv })}</p>
      <button className="cmd" style={{ alignSelf: 'flex-start' }} onClick={() => store.dispatch({ t: 'deleteRoute', id: r.id })}>
        {t('ui.deleteRoute')}
      </button>
    </div>
  );
}

export function RoutesDialog() {
  const g = useGame();
  const ui = useUi();
  const routes = g.transport.routes;
  const [picked, setPicked] = useState(Math.max(0, routes.findIndex((r) => r.id === ui.dialogArg)));
  const [creating, setCreating] = useState(false);
  const crews = idleCrew(g);
  const free = freeRafts(g);
  const sel = routes[Math.min(picked, routes.length - 1)];
  return (
    <Dialog kind="routes">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px 20px', fontSize: 15 }}>
        <p style={{ flex: '1 1 280px', margin: 0 }}>
          {t('ui.routeSummary', { used: routes.length, total: g.transport.rafts })}{' '}
          <span className={crews.length ? '' : 'tone-al'}>{t('ui.idleCrew', { n: crews.length })}</span>
        </p>
        <button className="cmd" disabled={free <= 0 || !crews.length} onClick={() => setCreating(!creating)}>
          {free <= 0 ? t('ui.newRouteNoRaft') : !crews.length ? t('ui.newRouteNoCrew') : t('ui.newRoute')}
        </button>
      </div>
      {creating && <NewRoute onDone={() => { setCreating(false); setPicked(routes.length); }} />}
      {!routes.length ? (
        <p className="empty">{t('ui.noRoutes')}</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 340px', minWidth: 0, fontSize: 15 }}>
            {routes.map((r, i) => (
              <button key={r.id} className={'pick' + (r === sel ? ' on' : '')} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => setPicked(i)} aria-pressed={r === sel}>
                <span>
                  {r.no}. {t('island.' + r.a)} ⇄ {t('island.' + r.b)}
                  <span className="small" style={{ display: 'block' }}>
                    {t('ui.cargoLine', { ab: r.cargoAB ? t('item.' + r.cargoAB) : t('cargo.empty'), ba: r.cargoBA ? t('item.' + r.cargoBA) : t('cargo.empty') })}
                  </span>
                </span>
                <span className={r.note.k === 'route.noSupply' ? 'tone-al' : 'tone-ok'}>
                  <M m={r.note} />
                </span>
              </button>
            ))}
          </div>
          {sel && <RouteDetail key={sel.id} r={sel} />}
        </div>
      )}
    </Dialog>
  );
}
