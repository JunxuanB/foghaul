import { RECIPES, RECIPE_ORDER } from '../../config/recipes';
import { t } from '../../i18n';
import { craftable } from '../../sim/actions';
import { stockP } from '../../sim/msg';
import type { Stock } from '../../sim/types';
import { useGame, useStore } from '../../store/hooks';
import { T } from '../components/Text';

/** 玩家手动制作：原料从岛上库存和身上一起扣 */
export function CraftPanel() {
  const g = useGame();
  const store = useStore();
  const list = RECIPE_ORDER.filter((r) => g.player.recipes.includes(r) && !RECIPES[r].noFacility);
  if (!list.length) return null;
  return (
    <section>
      <h3 className="h3">{t('ui.craft')}</h3>
      <ul className="list" style={{ fontSize: 15 }}>
        {list.map((r) => {
          const def = RECIPES[r];
          const ok = craftable(g, r);
          const ins = Object.keys(def.inputs).length ? t('ui.recipeIO', { ins: stockP(def.inputs as Stock), outs: stockP(def.outputs as Stock) }) : t('ui.recipeOut', { outs: stockP(def.outputs as Stock) });
          return (
            <li key={r} className="row">
              <span className="nm">
                {t('recipe.' + r)}
                <span className="small" style={{ display: 'block' }}>
                  <T k="ui.recipeLine" p={{ io: ins, min: def.manualMinutes }} />
                </span>
              </span>
              <span className="acts">
                <button className="cmd mini" disabled={!ok} onClick={() => store.dispatch({ t: 'craft', recipe: r, times: 1 })}>
                  {t('ui.make1')}
                </button>
                <button className="cmd mini" disabled={!ok} onClick={() => store.dispatch({ t: 'craft', recipe: r, times: 5 })}>
                  {t('ui.make5')}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
