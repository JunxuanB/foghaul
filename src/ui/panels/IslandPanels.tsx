// 岛上建筑的面板：木筏（停在码头边：货舱装卸、改造）、设施（生产、工人、吃饭、升级）。
// 一个建筑一个功能：货舱和木筏改造在木筏旁，岛的升级在设施旁（docs/2d-design.md “玩法梳理”）。
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER, type ItemId } from '../../config/items';
import { t, tm } from '../../i18n';
import { buildCost, canUseStock, here } from '../../sim/actions';
import { canLevelUp, islandRate, upgradeCostOf } from '../../sim/economy';
import { facilityName } from '../../sim/interact';
import { canPay, costAvailable, slotsUsed, slotView, stockCap } from '../../sim/inventory';
import { stockP } from '../../sim/msg';
import { residentsOf, workersAt } from '../../sim/people';
import type { Stock } from '../../sim/types';
import { useGame, useStore } from '../../store/hooks';
import { ItemIcon, ItemName, Slot } from '../components/Item';
import { Panel } from './Panel';

/** 一个容器按格子画（每格一种东西，超过堆叠上限拆开）；零件另列 */
export function SlotGrid({ stock, slots, onPick, title }: { stock: Stock; slots: number; onPick?: (id: ItemId) => void; title?: (id: ItemId) => string }) {
  const v = slotView(stock);
  return (
    <>
      <div className="grid-slots">
        {Array.from({ length: Math.max(slots, v.slots.length) }, (_, i) => {
          const c = v.slots[i];
          return <Slot key={i} id={c?.id} n={c?.n} onClick={c && onPick ? () => onPick(c.id) : undefined} title={c && title ? title(c.id) : undefined} />;
        })}
      </div>
      {v.keys.length > 0 && (
        <div className="rows">
          <span className="u-label">{t('ui.keyItems')}</span>
          <div className="seg">
            {v.keys.map((k) => (
              <ItemName key={k.id} id={k.id} n={k.n} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** 背包和货舱两栏，点一下在两边之间搬（海上按 Tab、或在码头边的木筏旁） */
export function PackHold({ canMove }: { canMove: boolean }) {
  const g = useGame();
  const store = useStore();
  const p = g.player;
  const move = (id: ItemId, from: 'pack' | 'hold') => {
    const src = from === 'pack' ? p.pack : p.hold;
    store.dispatch({ t: 'transfer', item: id, from, to: from === 'pack' ? 'hold' : 'pack', n: src[id] ?? 0 });
  };
  return (
    <div className="cols">
      <div>
        <h3>
          {t('ui.pack')} <span className="u-dim">{t('ui.slotsUsed', { n: slotsUsed(p.pack), cap: BALANCE.inventory.packCap })}</span>
        </h3>
        <SlotGrid stock={p.pack} slots={BALANCE.inventory.packCap} onPick={canMove ? (id) => move(id, 'pack') : undefined} title={(id) => t('ui.toHold', { item: { k: 'item.' + id } })} />
      </div>
      <div>
        <h3>
          {t('ui.hold')} <span className="u-dim">{t('ui.slotsUsed', { n: slotsUsed(p.hold), cap: p.holdCap })}</span>
        </h3>
        <SlotGrid stock={p.hold} slots={p.holdCap} onPick={canMove ? (id) => move(id, 'hold') : undefined} title={(id) => t('ui.toPack', { item: { k: 'item.' + id } })} />
      </div>
    </div>
  );
}

/** 木筏（停在码头边）：货舱和背包之间搬东西，全部卸到这座岛的仓库，加固货舱 */
export function RaftPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const own = canUseStock(isl) ? isl : undefined;
  const holdIds = ITEM_ORDER.filter((id) => (g.player.hold[id] ?? 0) > 0);
  const unloadAll = () => {
    for (const id of holdIds) store.dispatch({ t: 'transfer', item: id, from: 'hold', to: 'stock', n: g.player.hold[id] ?? 0 });
  };
  const cost = buildCost(g, 'holdUpgrade');
  const ok = !!cost && canPay(g, own, cost);
  return (
    <Panel title={t('thing.raft')} sub={t('ui.raftHint')} wide>
      <PackHold canMove />
      <div className="seg">
        {own && (
          <button className="u-btn sec" disabled={!holdIds.length} onClick={unloadAll}>
            {t('ui.unloadAll')}
          </button>
        )}
        {!own && <span className="u-dim">{t('ui.unloadNeedsNetwork')}</span>}
      </div>
      <h3>{t('ui.raftUpgrade')}</h3>
      {cost ? (
        <div className="recipe">
          <span className="big">
            <ItemIcon id="wood" />
          </span>
          <div>
            <div>{t('ui.holdUpgrade', { from: g.player.holdCap, to: g.player.holdCap + BALANCE.home.holdUpgrade.step })}</div>
            <div className="ins">
              {Object.entries(cost).map(([id, n]) => (
                <span key={id} className={costAvailable(g, own, id as ItemId) >= (n ?? 0) ? '' : 'lack'}>
                  <ItemName id={id as ItemId} /> {Math.min(costAvailable(g, own, id as ItemId), 99)}/{n}
                </span>
              ))}
            </div>
          </div>
          <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'build', what: 'holdUpgrade' })}>
            {t('ui.make')}
          </button>
        </div>
      ) : (
        <p className="u-dim">{t('ui.holdMaxed')}</p>
      )}
    </Panel>
  );
}

/** 设施：在生产 / 加工什么、谁在干活、每小时多少、库存、为什么停了；吃饭和升级；培训（下一阶段） */
export function FacilityPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  if (!isl || !isl.facility) return null;
  const fac = isl.facility;
  const r = islandRate(g, isl);
  const workers = workersAt(g, isl);
  const people = residentsOf(g, isl);
  const product: ItemId | undefined = fac.kind === 'produce' ? fac.item : undefined;
  const need = BALANCE.economy.mealsToUpgrade;
  const cost = upgradeCostOf(isl);
  const ready = isl.mealStreak >= need;
  const canPayUp = !!cost && canPay(g, isl, cost);
  return (
    <Panel title={tm(facilityName(fac))} sub={t('ui.facilityLevel', { lv: isl.level })} wide>
      <div className="rows">
        <div>
          <span>{t('ui.output')}</span>
          <span className={r.rate > 0 ? '' : 'tone-b'}>{r.rate > 0 ? t('ui.perHour', { n: Math.round(r.rate * 10) / 10 }) : t(r.note || isl.workNote || 'work.nobody')}</span>
        </div>
        {product && (
          <div>
            <span>
              <ItemName id={product} />
            </span>
            <span>
              {isl.stock[product] ?? 0}/{stockCap(g, isl, product)}
            </span>
          </div>
        )}
        <div>
          <span>{t('ui.workers')}</span>
          <span>{workers.length ? workers.map((p) => tm(p.name)).join('、') : t('ui.noWorkers')}</span>
        </div>
        {people.length > workers.length && (
          <div>
            <span className="u-dim">{t('ui.idle')}</span>
            <span className="u-dim">
              {people
                .filter((p) => !workers.includes(p))
                .map((p) => tm(p.name))
                .join('、')}
            </span>
          </div>
        )}
        <div>
          <span>{t('ui.meals')}</span>
          <span className={isl.lastMeal === 'full' ? 'tone-g' : isl.lastMeal ? 'tone-b' : ''}>{isl.lastMeal ? t('ui.mealState.' + isl.lastMeal) : t('ui.mealNotYet')}</span>
        </div>
      </div>
      <h3>{t('ui.islandUpgrade')}</h3>
      {canLevelUp(isl) && cost ? (
        <>
          <p>{t('ui.upgradeRule', { n: need })}</p>
          <div className="rows">
            <div>
              <span className={ready ? 'tone-g' : ''}>{t('ui.mealStreak', { n: Math.min(isl.mealStreak, need), total: need })}</span>
              <span />
            </div>
            <div>
              <span>{t('ui.cost')}</span>
              <span className={canPayUp ? '' : 'tone-b'}>{t('ui.stockList', { list: stockP(cost) })}</span>
            </div>
            <div>
              <span className="u-dim">{t('ui.nextLevel', { lv: isl.level + 1 })}</span>
              <span className="u-dim">{t('ui.nextLevelGain', { cap: BALANCE.economy.levels[isl.level].cap, people: BALANCE.economy.levels[isl.level].people, mult: BALANCE.economy.levels[isl.level].mult })}</span>
            </div>
          </div>
          <div className="seg">
            <button className="u-btn" disabled={!ready || !canPayUp} onClick={() => store.dispatch({ t: 'upgradeIsland' })}>
              {t('ui.upgrade')}
            </button>
          </div>
        </>
      ) : (
        <p className="u-dim">{t('ui.maxLevel')}</p>
      )}
      <h3>{t('ui.training')}</h3>
      <p className="u-dim">{t('ui.trainingSoon')}</p>
    </Panel>
  );
}
