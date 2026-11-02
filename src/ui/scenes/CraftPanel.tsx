import { ITEMS, type ItemId } from '../../config/items';
import { RECIPES, RECIPE_ORDER, type RecipeId } from '../../config/recipes';
import { t, tm } from '../../i18n';
import { canUseStock, craftBlock, here } from '../../sim/actions';
import { costAvailable } from '../../sim/inventory';
import { useGame, useStore } from '../../store/hooks';
import { ItemName } from '../components/Tip';

export function knownRecipes(g: ReturnType<typeof useGame>): RecipeId[] {
  return RECIPE_ORDER.filter((r) => g.player.recipes.includes(r) && !RECIPES[r].noFacility && !(r === 'raft' && g.player.hasRaft));
}

/** 能做的配方数量（标签上的小数字） */
export function craftableCount(g: ReturnType<typeof useGame>): number {
  return knownRecipes(g).filter((r) => craftBlock(g, r) === null).length;
}

/** 制作面板：随时随地都能打开。原料从身上和所在的网络岛仓库一起扣。 */
export function CraftPanel() {
  const g = useGame();
  const store = useStore();
  const list = knownRecipes(g);
  const isl = here(g);
  const src = canUseStock(isl) ? isl : undefined;
  return (
    <section style={{ fontSize: 15 }}>
      {list.length === 0 && <p className="empty">{t('ui.noRecipes')}</p>}
      <ul className="list">
        {list.map((r) => {
          const def = RECIPES[r];
          const block = craftBlock(g, r);
          const ins = Object.entries(def.inputs) as [ItemId, number][];
          const outs = Object.entries(def.outputs) as [ItemId, number][];
          return (
            <li key={r} className="row" style={{ alignItems: 'flex-start', padding: '10px 0', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', width: '100%', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <strong>
                  {t('recipe.' + r)}
                  {g.newRecipes.includes(r) && <span className="tone-g" style={{ marginLeft: 8, fontSize: 13 }}>{t('ui.newTag')}</span>}
                </strong>
                <span className="small">{t('ui.minutes', { n: def.manualMinutes })}</span>
              </div>
              <div className="small" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', color: 'var(--ink)' }}>
                {ins.length === 0 && <span>{t('ui.seawater')}</span>}
                {ins.map(([id, n]) => {
                  const have = costAvailable(g, src, id);
                  return (
                    <span key={id} className={have >= n ? '' : 'tone-al'}>
                      <ItemName id={id} /> {Math.min(have, 99)}/{n}
                    </span>
                  );
                })}
                <span>→</span>
                {def.special === 'raft' ? (
                  <span className="tone-g">{t('recipe.raft')}</span>
                ) : (
                  outs.map(([id, n]) => (
                    <span key={id}>
                      <ItemName id={id} /> ×{n}
                      {!ITEMS[id].portable && <span className="small"> ({t('ui.toStorage')})</span>}
                    </span>
                  ))
                )}
              </div>
              {block && <span className="small tone-al">{tm(block)}</span>}
              <div className="acts" style={{ justifyContent: 'flex-start' }}>
                <button data-coach={'craft-' + r} className={'cmd mini' + (!block ? ' lead' : '')} disabled={!!block} onClick={() => store.dispatch({ t: 'craft', recipe: r, times: 1 })}>
                  {def.special ? t('ui.make') : t('ui.make1')}
                </button>
                {!def.special && (
                  <button className="cmd mini" disabled={!!block} onClick={() => store.dispatch({ t: 'craft', recipe: r, times: 5 })}>
                    {t('ui.make5')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="small">{t('ui.moreRecipes')}</p>
    </section>
  );
}
