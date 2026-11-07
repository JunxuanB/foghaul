// 同类面板共用的布局模板（docs/2d-tech.md “面板框架”）：
// 两栏搬运（背包 ↔ 货舱 / 仓库）、格子、仓库格、选中物品的状态行。
import { useState, type ReactNode } from 'react';
import { ITEMS, ITEM_ORDER, type ItemId } from '../../config/items';
import { t } from '../../i18n';
import { BALANCE } from '../../config/balance';
import { here } from '../../sim/actions';
import { slotsUsed, slotView, stockCap } from '../../sim/inventory';
import { useGame, useStore } from '../../store/hooks';
import type { GameState, Island, Stock } from '../../sim/types';
import { ItemName, Slot } from '../components/Item';
import { Chip, Icon } from '../components/Kit';

export type Where = 'pack' | 'hold' | 'stock';
export interface Focus {
  where: Where;
  id: ItemId;
}

/** 鼠标停过的格子（离开后保留，这样能去点状态行里的按钮） */
export function useFocus() {
  return useState<Focus | null>(null);
}

/** 一栏：小图标 + 名字 + 右边的数量 / 说明，下面是格子 */
export function Column({ icon, title, right, children, dim }: { icon: string; title: string; right?: ReactNode; children: ReactNode; dim?: boolean }) {
  return (
    <div className={'v-col' + (dim ? ' dim' : '')}>
      <div className="v-col-head">
        <span className="v-col-title">
          <Icon id={icon} size={8} />
          {title}
        </span>
        <span className="v-col-right">{right}</span>
      </div>
      {children}
    </div>
  );
}

/** 背包 / 货舱的格子：每格一种东西，超过堆叠上限拆开；零件不占格，放在最后单独一排 */
export function SlotGrid({
  stock,
  slots,
  cols,
  where,
  focus,
  onFocus,
  onPick,
}: {
  stock: Stock;
  slots: number;
  cols: number;
  where: Where;
  focus?: Focus | null;
  onFocus?: (f: Focus) => void;
  onPick?: (id: ItemId) => void;
}) {
  const v = slotView(stock);
  const cells = Array.from({ length: Math.max(slots, v.slots.length) }, (_, i) => v.slots[i]);
  return (
    <div className="v-grid" style={{ ['--cols' as string]: cols }}>
      {cells.map((c, i) => (
        <span key={i} onMouseEnter={c ? () => onFocus?.({ where, id: c.id }) : undefined}>
          <Slot id={c?.id} n={c?.n} sel={!!c && focus?.where === where && focus.id === c.id} onClick={c && onPick ? () => onPick(c.id) : undefined} />
        </span>
      ))}
      {v.keys.map((k) => (
        <span key={'k' + k.id} onMouseEnter={() => onFocus?.({ where, id: k.id })}>
          <Slot id={k.id} n={k.n} sel={focus?.where === where && focus.id === k.id} />
        </span>
      ))}
    </div>
  );
}

/** 岛上仓库：每种物品一格，格子下沿的条是“数量 / 上限” */
export function StockGrid({
  g,
  isl,
  cols,
  focus,
  onFocus,
  onPick,
}: {
  g: GameState;
  isl: Island;
  cols: number;
  focus?: Focus | null;
  onFocus?: (f: Focus) => void;
  onPick?: (id: ItemId) => void;
}) {
  const ids = ITEM_ORDER.filter((id) => (isl.stock[id] ?? 0) > 0);
  const min = cols * 2;
  return (
    <div className="v-grid" style={{ ['--cols' as string]: cols }}>
      {ids.map((id) => {
        const n = isl.stock[id] ?? 0;
        const cap = stockCap(g, isl, id);
        return (
          <span key={id} className="v-stock" onMouseEnter={() => onFocus?.({ where: 'stock', id })}>
            <Slot id={id} n={n} sel={focus?.where === 'stock' && focus.id === id} onClick={onPick && ITEMS[id].portable ? () => onPick(id) : undefined} />
            <i className={n >= cap ? 'full' : ''} style={{ ['--v' as string]: Math.min(1, n / Math.max(1, cap)) }} />
          </span>
        );
      })}
      {Array.from({ length: Math.max(0, min - ids.length) }, (_, i) => (
        <span key={'e' + i}>
          <Slot />
        </span>
      ))}
    </div>
  );
}

/** 状态行：选中的物品（图标、名字、数量；仓库里的显示“数量 / 上限”） */
export function FocusStatus({ g, isl, focus, src }: { g: GameState; isl?: Island; focus: Focus | null; src: Record<Where, Stock | undefined> }) {
  if (!focus) return <span className="u-dim">{t('ui.selectedNone')}</span>;
  const s = src[focus.where];
  const n = s?.[focus.id] ?? 0;
  if (!n) return <span className="u-dim">{t('ui.selectedNone')}</span>;
  return (
    <span className="v-focus">
      <ItemName id={focus.id} />
      <span className="u-dim">{focus.where === 'stock' && isl ? `${n}/${stockCap(g, isl, focus.id)}` : '×' + n}</span>
    </span>
  );
}

/** 吃 / 喝 / 用 的按钮文字 */
export function verbKey(id: ItemId): string {
  const v = ITEMS[id].verb;
  return v === 'drink' ? 'ui.drinkIt' : v === 'use' ? 'ui.useIt' : 'ui.eatIt';
}

const P = BALANCE.inventory;

/** 背包 ↔ 货舱两栏（背包面板、木筏面板共用） */
export function PackHoldBody({ canMove, focus, setFocus }: { canMove: boolean; focus: Focus | null; setFocus: (f: Focus) => void }) {
  const g = useGame();
  const store = useStore();
  const p = g.player;
  const move = (id: ItemId, from: 'pack' | 'hold') => {
    const src = from === 'pack' ? p.pack : p.hold;
    store.dispatch({ t: 'transfer', item: id, from, to: from === 'pack' ? 'hold' : 'pack', n: src[id] ?? 0 });
  };
  return (
    <div className="v-cols">
      <Column icon="ui_pack" title={t('ui.pack')} right={t('ui.slotsUsed', { n: slotsUsed(p.pack), cap: P.packCap })}>
        <SlotGrid stock={p.pack} slots={P.packCap} cols={4} where="pack" focus={focus} onFocus={setFocus} onPick={canMove ? (id) => move(id, 'pack') : undefined} />
      </Column>
      <Column icon="ui_hold" title={t('ui.hold')} right={canMove ? t('ui.slotsUsed', { n: slotsUsed(p.hold), cap: p.holdCap }) : <Chip icon="ui_warn" tone="dim">{t('ui.moveAtRaft')}</Chip>} dim={!canMove}>
        <SlotGrid stock={p.hold} slots={p.holdCap} cols={6} where="hold" focus={focus} onFocus={setFocus} onPick={canMove ? (id) => move(id, 'hold') : undefined} />
      </Column>
    </div>
  );
}

/** 选中物品的按钮：搬过去、吃喝 */
export function FocusActions({ focus, canMoveHold, canStock }: { focus: Focus | null; canMoveHold?: boolean; canStock?: boolean }) {
  const g = useGame();
  const store = useStore();
  if (!focus) return null;
  const { where, id } = focus;
  const p = g.player;
  const isl = here(g);
  const src = where === 'pack' ? p.pack : where === 'hold' ? p.hold : isl?.stock;
  const n = src?.[id] ?? 0;
  if (!n) return null;
  const def = ITEMS[id];
  const btns = [];
  const tr = (to: 'pack' | 'hold' | 'stock', key: string) =>
    btns.push(
      <button key={to} className="u-btn sec" onClick={() => store.dispatch({ t: 'transfer', item: id, from: where, to, n })}>
        {t(key)}
      </button>,
    );
  if (where === 'pack' && canMoveHold) tr('hold', 'ui.btnToHold');
  if (where === 'hold' && canMoveHold) tr('pack', 'ui.btnToPack');
  if (where === 'pack' && canStock) tr('stock', 'ui.btnPutIn');
  if (where === 'stock' && def.portable) tr('pack', 'ui.btnTakeOut');
  if (def.eat && where !== 'hold')
    btns.push(
      <button key="eat" className="u-btn" onClick={() => store.dispatch({ t: 'consume', from: where, item: id })}>
        {t(verbKey(id))}
      </button>,
    );
  return <>{btns}</>;
}

