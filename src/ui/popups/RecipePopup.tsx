// 新配方全屏弹窗：暂停时间，一次一个。
import { useEffect } from 'react';
import { RECIPES } from '../../config/recipes';
import { t } from '../../i18n';
import { useGame, useStore } from '../../store/hooks';
import { ItemIcon } from '../components/Item';
import { Cell, Icon } from '../components/Kit';
import type { ItemId } from '../../config/items';

export function RecipePopup() {
  const g = useGame();
  const store = useStore();
  const r = g.recipePopup[0];
  useEffect(() => {
    store.hold('recipePopup', !!r);
  }, [r, store]);
  if (!r) return null;
  const def = RECIPES[r];
  const outs = Object.keys(def.outputs) as ItemId[];
  const ins = Object.entries(def.inputs) as [ItemId, number][];
  return (
    <>
      <div className="shade" />
      <div className="u-panel pop" role="dialog" aria-label={t('ui.newRecipe')}>
        <div className="u-label">{t('ui.newRecipe')}</div>
        <h2 className="u-title">{t('recipe.' + r)}</h2>
        {outs[0] && (
          <span className="big">
            <ItemIcon id={outs[0]} />
          </span>
        )}
        <div className="eq">
          {ins.length === 0 ? <Cell id="water" label={t('ui.seawater')} /> : <span className="k-cells">{ins.map(([id, n]) => <Cell key={id} id={id} need={n} />)}</span>}
          <Icon id="ui_arrow" size={8} />
          <span className="k-cells">
            {outs.map((id) => (
              <Cell key={id} id={id} need={def.outputs[id]} />
            ))}
          </span>
        </div>
        <p>{t('ui.newRecipeWhere')}</p>
        <button className="u-btn" autoFocus onClick={() => store.dispatch({ t: 'ackRecipes' })}>
          {t('ui.gotIt')}
        </button>
      </div>
    </>
  );
}
