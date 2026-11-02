import { BALANCE } from '../../config/balance';
import { ITEMS, ITEM_ORDER, type ItemId } from '../../config/items';
import { t, tm } from '../../i18n';
import { canUseStock, here } from '../../sim/actions';
import { jobMsg } from '../../sim/people';
import type { Stock, Where } from '../../sim/types';
import { stockLoad } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';

export interface Act {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  lead?: boolean;
  title?: string;
}

export function ItemRows({ stock, acts, cap, empty }: { stock: Stock; acts: (id: ItemId, n: number) => Act[]; cap?: (id: ItemId) => number; empty?: string }) {
  const ids = ITEM_ORDER.filter((id) => (stock[id] ?? 0) > 0);
  if (!ids.length) return <p className="empty">{empty ?? t('ui.empty')}</p>;
  return (
    <ul className="list" style={{ fontSize: 15 }}>
      {ids.map((id) => {
        const n = stock[id] ?? 0;
        return (
          <li key={id} className="row">
            <span className="nm">{t('item.' + id)}</span>
            <span className="meta">{cap ? `${n}/${cap(id)}` : `×${n}`}</span>
            <span className="acts">
              {acts(id, n).map((a, i) => (
                <button key={i} className={'cmd mini' + (a.lead ? ' lead' : '')} disabled={a.disabled} onClick={a.onClick} title={a.title}>
                  {a.label}
                </button>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function useItemActs() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const owned = canUseStock(isl);
  const bureau = isl?.kind === 'bureau';
  return (from: Where) =>
    (id: ItemId, n: number): Act[] => {
      const def = ITEMS[id];
      const out: Act[] = [];
      if (def.eat && (from !== 'stock' || owned)) {
        out.push({ label: t('verb.' + (def.verb ?? 'eat')), onClick: () => store.dispatch({ t: 'consume', from, item: id }) });
      }
      if (from === 'pack' && g.player.hasRaft && !def.key)
        out.push({ label: t('ui.toHold'), onClick: () => store.dispatch({ t: 'transfer', item: id, from, to: 'hold', n }) });
      if (from === 'hold')
        out.push({ label: t('ui.toPack'), onClick: () => store.dispatch({ t: 'transfer', item: id, from, to: 'pack', n }) });
      if ((from === 'pack' || from === 'hold') && owned && !def.key)
        out.push({ label: t('ui.unload'), onClick: () => store.dispatch({ t: 'transfer', item: id, from, to: 'stock', n }) });
      if ((from === 'pack' || from === 'hold') && bureau && def.trade > 0)
        out.push({ label: t('ui.export'), lead: true, onClick: () => store.dispatch({ t: 'export', item: id, from, n }) });
      if (from === 'stock' && def.portable) {
        if (g.player.hasRaft) {
          out.push({ label: t('ui.load1'), onClick: () => store.dispatch({ t: 'transfer', item: id, from, to: 'hold', n: 1 }) });
          out.push({ label: t('ui.loadAll'), onClick: () => store.dispatch({ t: 'transfer', item: id, from, to: 'hold', n }) });
        }
        out.push({ label: t('ui.take'), onClick: () => store.dispatch({ t: 'transfer', item: id, from, to: 'pack', n: 1 }) });
      }
      return out;
    };
}

export function Inventory() {
  const g = useGame();
  const store = useStore();
  const acts = useItemActs();
  const p = g.player;
  const isl = here(g);
  const aboard = p.aboard.map((id) => g.people.find((x) => x.id === id)!).filter(Boolean);
  return (
    <aside style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h2 className="h3">
          {t('ui.pack')} {stockLoad(p.pack)}/{BALANCE.inventory.packCap}
        </h2>
        <ItemRows stock={p.pack} acts={acts('pack')} />
      </section>
      <section>
        <h2 className="h3">{p.hasRaft ? t('ui.holdCap', { n: stockLoad(p.hold), cap: p.holdCap }) : t('ui.noRaftYet')}</h2>
        {p.hasRaft && <ItemRows stock={p.hold} acts={acts('hold')} />}
      </section>
      {p.hasRaft && (
        <section>
          <h2 className="h3">
            {t('ui.aboard')} {aboard.length}/{BALANCE.inventory.seats}
          </h2>
          {!aboard.length ? (
            <p className="empty">{t('ui.nobodyAboard')}</p>
          ) : (
            <ul className="list" style={{ fontSize: 15 }}>
              {aboard.map((a) => (
                <li key={a.id} className="row">
                  <span className="nm">{tm(a.name)}</span>
                  <span className="meta">{a.type === 'native' ? tm(jobMsg(a.job)) : t('ui.passenger')}</span>
                  <span className="acts">
                    <button className="cmd mini" disabled={!isl} onClick={() => store.dispatch({ t: 'dropOff', personId: a.id })}>
                      {t('ui.dropOff')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </aside>
  );
}
