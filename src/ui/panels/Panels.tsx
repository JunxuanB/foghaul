// 每个面板对应一个建筑或一个全局键（docs/2d-design.md 第 9 节“面板清单”）。
import { BALANCE } from '../../config/balance';
import { ITEMS, ITEM_ORDER, PART_IDS, type ItemId } from '../../config/items';
import { RECIPES, RECIPE_ORDER, type RecipeId } from '../../config/recipes';
import { LANGS, t, tm } from '../../i18n';
import { buildCost, canUseStock, craftBlock, here } from '../../sim/actions';
import { canPay, costAvailable, slotsUsed, slotView, stockCap } from '../../sim/inventory';
import type { Stock } from '../../sim/types';
import { useGame, useStore, useView, useViewStore } from '../../store/hooks';
import { ItemIcon, ItemName, Slot } from '../components/Item';
import { Rich } from '../components/Text';
import { useUi } from '../ui';
import { Panel } from './Panel';
import { LighthousePanel, MapPanel, TalkPanel } from './SeaPanels';

const list = (s: Partial<Record<ItemId, number>>) => ITEM_ORDER.filter((id) => (s[id] ?? 0) > 0);

/** 按格子画一个背包 / 货舱：每格一种东西，超过堆叠上限的拆成几格；零件另列一行 */
function SlotGrid({ stock, slots, onPick, title }: { stock: Stock; slots: number; onPick?: (id: ItemId) => void; title?: (id: ItemId) => string }) {
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

/** 背包（Tab）：点可以吃喝的东西直接用 */
export function InventoryPanel() {
  const g = useGame();
  const store = useStore();
  const p = g.player;
  const cap = BALANCE.inventory.packCap;
  const use = (id: ItemId) => {
    if (ITEMS[id].eat) store.dispatch({ t: 'consume', from: 'pack', item: id });
  };
  return (
    <Panel title={t('ui.pack')} sub={t('ui.slotsUsed', { n: slotsUsed(p.pack), cap })}>
      <SlotGrid stock={p.pack} slots={cap} onPick={use} title={(id) => t('item.' + id) + (ITEMS[id].eat ? ' · ' + t('ui.clickToUse') : '')} />
      <p className="u-dim">{list(p.pack).length === 0 ? t('ui.packEmpty') : t('ui.packHint')}</p>
      <p className="u-dim">{t('ui.stackRule', { a: BALANCE.inventory.stack.material, b: BALANCE.inventory.stack.consumable })}</p>
    </Panel>
  );
}

function knownRecipes(g: ReturnType<typeof useGame>): RecipeId[] {
  return RECIPE_ORDER.filter((r) => g.player.recipes.includes(r) && !RECIPES[r].noFacility && !(r === 'raft' && g.player.hasRaft));
}

/** 制作（工作台） */
export function CraftPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const src = canUseStock(isl) ? isl : undefined;
  const rs = knownRecipes(g);
  return (
    <Panel title={t('thing.workbench')} sub={t('ui.craftFrom')}>
      {rs.length === 0 && <p>{t('ui.noRecipes')}</p>}
      <div>
        {rs.map((r) => {
          const def = RECIPES[r];
          const block = craftBlock(g, r);
          const ins = Object.entries(def.inputs) as [ItemId, number][];
          const outs = Object.entries(def.outputs) as [ItemId, number][];
          return (
            <div key={r} className="recipe">
              <span className="big">{outs[0] ? <ItemIcon id={outs[0][0]} /> : null}</span>
              <div>
                <div>
                  {t('recipe.' + r)} <span className="u-dim">· {t('ui.minutes', { n: def.manualMinutes })}</span>
                </div>
                <div className="ins">
                  {ins.length === 0 && <span>{t('ui.seawater')}</span>}
                  {ins.map(([id, n]) => {
                    const have = costAvailable(g, src, id);
                    return (
                      <span key={id} className={have >= n ? '' : 'lack'}>
                        <ItemName id={id} /> {Math.min(have, 99)}/{n}
                      </span>
                    );
                  })}
                  {def.special !== 'raft' && (
                    <span>
                      → {outs.map(([id, n]) => t('qty', { item: { k: 'item.' + id }, n })).join(' ')}
                    </span>
                  )}
                </div>
                {block && <div className="ins"><span className="lack">{tm(block)}</span></div>}
              </div>
              <button className="u-btn" disabled={!!block} onClick={() => store.dispatch({ t: 'craft', recipe: r })}>
                {t('ui.make')}
              </button>
            </div>
          );
        })}
      </div>
      {g.player.hasRaft && <HoldUpgrade />}
    </Panel>
  );
}

/** 工作台上加固货舱：木头够了就能做，每次多几格 */
function HoldUpgrade() {
  const g = useGame();
  const store = useStore();
  const cost = buildCost(g, 'holdUpgrade');
  if (!cost) return null;
  const isl = here(g);
  const src = canUseStock(isl) ? isl : undefined;
  const ok = canPay(g, src, cost);
  return (
    <div className="recipe">
      <span className="big">
        <ItemIcon id="wood" />
      </span>
      <div>
        <div>{t('ui.holdUpgrade', { from: g.player.holdCap, to: g.player.holdCap + BALANCE.home.holdUpgrade.step })}</div>
        <div className="ins">
          {Object.entries(cost).map(([id, n]) => (
            <span key={id} className={costAvailable(g, src, id as ItemId) >= (n ?? 0) ? '' : 'lack'}>
              <ItemName id={id as ItemId} /> {Math.min(costAvailable(g, src, id as ItemId), 99)}/{n}
            </span>
          ))}
        </div>
      </div>
      <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'build', what: 'holdUpgrade' })}>
        {t('ui.make')}
      </button>
    </div>
  );
}

/** 仓库（储物箱）：左边背包（格子），右边岛上仓库（每种物品各有上限）。点一下放进 / 取出 */
export function ChestPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  if (!isl || !canUseStock(isl)) return null;
  const move = (id: ItemId, from: 'pack' | 'stock') => {
    const src = from === 'pack' ? g.player.pack : isl.stock;
    store.dispatch({ t: 'transfer', item: id, from, to: from === 'pack' ? 'stock' : 'pack', n: src[id] ?? 0 });
  };
  const ids = list(isl.stock);
  return (
    <Panel title={t('thing.chest')} sub={t('ui.chestHint')} wide>
      <div className="cols">
        <div>
          <h3>
            {t('ui.pack')} <span className="u-dim">{t('ui.slotsUsed', { n: slotsUsed(g.player.pack), cap: BALANCE.inventory.packCap })}</span>
          </h3>
          <SlotGrid stock={g.player.pack} slots={BALANCE.inventory.packCap} onPick={(id) => move(id, 'pack')} title={(id) => t('ui.putIn', { item: { k: 'item.' + id } })} />
        </div>
        <div>
          <h3>{t('ui.stock')}</h3>
          {ids.length === 0 && <p className="u-dim">{t('ui.stockEmpty')}</p>}
          <div className="stock-list">
            {ids.map((id) => {
              const n = isl.stock[id] ?? 0;
              const cap = stockCap(g, isl, id);
              const portable = ITEMS[id].portable;
              return (
                <button
                  key={id}
                  type="button"
                  className="stock-row"
                  disabled={!portable}
                  onClick={() => move(id, 'stock')}
                  title={portable ? t('ui.takeOut', { item: { k: 'item.' + id } }) : t('ui.notPortable')}
                >
                  <ItemName id={id} />
                  <i style={{ ['--v' as string]: Math.min(1, n / Math.max(1, cap)) }} />
                  <span className={n >= cap ? 'full' : ''}>
                    {n}/{cap}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="u-dim">{t('ui.stockRule')}</p>
        </div>
      </div>
    </Panel>
  );
}

/** 维修（直升机残骸）：M1 只看零件 */
export function WreckPanel() {
  const g = useGame();
  return (
    <Panel title={t('thing.wreck')}>
      <p>{t('ui.wreckHint')}</p>
      <div className="rows">
        {PART_IDS.map((id) => (
          <div key={id}>
            <ItemName id={id} />
            <span className="u-dim">{g.flags.partsInstalled.includes(id) ? t('ui.installed') : (g.player.pack[id] ?? 0) > 0 ? t('ui.inPack') : t('ui.partMissing')}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** 目标与日志（J） */
export function JournalPanel() {
  const g = useGame();
  const lines = g.log.slice(-60).reverse();
  return (
    <Panel title={t('ui.journal')} wide>
      <div className="logfull">
        {lines.map((l, i) => (
          <div key={i}>
            <Rich s={tm(l.m)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

const HELP = ['goal', 'controls', 'time', 'craft', 'bags'];

/** 帮助（H） */
export function HelpPanel() {
  return (
    <Panel title={t('ui.help')} wide>
      {HELP.map((k) => (
        <div key={k}>
          <h3>{t('help.' + k + '.title')}</h3>
          <p>
            <Rich s={t('help2d.' + k)} />
          </p>
        </div>
      ))}
    </Panel>
  );
}

/** 菜单（Esc）：继续、设置、存档、回到欢迎页 */
export function MenuPanel() {
  const store = useStore();
  const vs = useViewStore();
  const ui = useUi();
  return (
    <Panel title={t('ui.menu')}>
      <div className="menu">
        <button className="u-btn" autoFocus onClick={() => vs.set({ panel: null })}>
          {t('ui.resume')}
        </button>
        <button
          className="u-btn sec"
          onClick={() => {
            store.save();
            vs.set({ panel: null });
          }}
        >
          {t('ui.saveNow')}
        </button>
        <button className="u-btn sec" onClick={() => vs.set({ panel: 'help' })}>
          {t('ui.help')}
        </button>
        <div className="seg">
          <span className="u-label">{t('ui.language')}</span>
          {LANGS.map((l) => (
            <button key={l} className={'u-btn' + (ui.lang === l ? '' : ' sec')} aria-pressed={ui.lang === l} onClick={() => ui.setLang(l)}>
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
        <button
          className="u-btn sec"
          onClick={() => {
            store.save();
            vs.set({ panel: null });
            ui.toWelcome();
          }}
        >
          {t('ui.toWelcome')}
        </button>
        <p className="u-dim">{t('ui.paused')}</p>
      </div>
    </Panel>
  );
}

export function PanelHost() {
  const v = useView();
  switch (v.panel) {
    case 'inventory':
      return <InventoryPanel />;
    case 'craft':
      return <CraftPanel />;
    case 'chest':
      return <ChestPanel />;
    case 'lighthouse':
      return <LighthousePanel />;
    case 'wreck':
      return <WreckPanel />;
    case 'journal':
      return <JournalPanel />;
    case 'talk':
      return <TalkPanel />;
    case 'map':
      return <MapPanel />;
    case 'help':
      return <HelpPanel />;
    case 'menu':
      return <MenuPanel />;
    default:
      return null;
  }
}
