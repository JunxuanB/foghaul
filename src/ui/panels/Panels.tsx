// 每个面板对应一个建筑或一个全局键（docs/2d-design.md 第 9 节“面板清单”）。
import { BALANCE } from '../../config/balance';
import { ITEMS, ITEM_ORDER, PART_IDS, type ItemId } from '../../config/items';
import { RECIPES, RECIPE_ORDER, type RecipeId } from '../../config/recipes';
import { LANGS, t, tm } from '../../i18n';
import { canUseStock, craftBlock, here } from '../../sim/actions';
import { costAvailable } from '../../sim/inventory';
import { stockLoad } from '../../sim/util';
import { useGame, useStore, useView, useViewStore } from '../../store/hooks';
import { ItemIcon, ItemName, Slot } from '../components/Item';
import { Rich } from '../components/Text';
import { useUi } from '../ui';
import { Panel } from './Panel';

const list = (s: Partial<Record<ItemId, number>>) => ITEM_ORDER.filter((id) => (s[id] ?? 0) > 0);

function Grid({ stock, cap, onPick, title }: { stock: Partial<Record<ItemId, number>>; cap: number; onPick?: (id: ItemId) => void; title?: (id: ItemId) => string }) {
  const ids = list(stock);
  const slots = Math.max(ids.length, Math.min(cap, 16));
  return (
    <div className="grid-slots">
      {Array.from({ length: slots }, (_, i) => {
        const id = ids[i];
        return <Slot key={i} id={id} n={id ? stock[id] : undefined} onClick={id && onPick ? () => onPick(id) : undefined} title={id && title ? title(id) : undefined} />;
      })}
    </div>
  );
}

/** 背包（Tab）：点可以吃喝的东西直接用 */
export function InventoryPanel() {
  const g = useGame();
  const store = useStore();
  const p = g.player;
  const use = (id: ItemId) => {
    if (ITEMS[id].eat) store.dispatch({ t: 'consume', from: 'pack', item: id });
  };
  return (
    <Panel title={t('ui.pack')} sub={t('ui.packLoad', { n: stockLoad(p.pack), cap: BALANCE.inventory.packCap })}>
      <Grid stock={p.pack} cap={BALANCE.inventory.packCap} onPick={use} title={(id) => t('item.' + id) + (ITEMS[id].eat ? ' · ' + t('ui.clickToUse') : '')} />
      {list(p.pack).length === 0 && <p className="u-dim">{t('ui.packEmpty')}</p>}
      {list(p.pack).length > 0 && <p className="u-dim">{t('ui.packHint')}</p>}
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
    </Panel>
  );
}

/** 仓库（储物箱）：左边背包、右边仓库，点一下放进 / 取出 */
export function ChestPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  if (!isl || !canUseStock(isl)) return null;
  const move = (id: ItemId, from: 'pack' | 'stock') => {
    const src = from === 'pack' ? g.player.pack : isl.stock;
    store.dispatch({ t: 'transfer', item: id, from, to: from === 'pack' ? 'stock' : 'pack', n: src[id] ?? 0 });
  };
  return (
    <Panel title={t('thing.chest')} sub={t('ui.chestHint')} wide>
      <div className="cols">
        <div>
          <h3>{t('ui.pack')}</h3>
          <Grid stock={g.player.pack} cap={BALANCE.inventory.packCap} onPick={(id) => move(id, 'pack')} title={(id) => t('ui.putIn', { item: { k: 'item.' + id } })} />
        </div>
        <div>
          <h3>{t('ui.stock')}</h3>
          <Grid stock={isl.stock} cap={16} onPick={(id) => ITEMS[id].portable && move(id, 'stock')} title={(id) => (ITEMS[id].portable ? t('ui.takeOut', { item: { k: 'item.' + id } }) : t('ui.notPortable'))} />
          {list(isl.stock).length === 0 && <p className="u-dim">{t('ui.stockEmpty')}</p>}
        </div>
      </div>
    </Panel>
  );
}

/** 灯塔：主岛自带，显示照亮半径 */
export function LighthousePanel() {
  const g = useGame();
  const isl = here(g);
  const r = isl?.kind === 'home' ? BALANCE.map.homeLightRadius : BALANCE.map.lighthouseRadius[Math.max(0, (isl?.level ?? 1) - 1)];
  return (
    <Panel title={t('thing.lighthouse')}>
      <p>{t('ui.lighthouseOn', { r })}</p>
      <p className="u-dim">{t('ui.lighthouseHint')}</p>
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
    case 'help':
      return <HelpPanel />;
    case 'menu':
      return <MenuPanel />;
    default:
      return null;
  }
}
