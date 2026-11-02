import { useEffect } from 'react';
import type { ItemId } from '../../config/items';
import { RECIPES } from '../../config/recipes';
import { t } from '../../i18n';
import { useGame, useStore } from '../../store/hooks';
import { useUi } from '../ui';
import { ItemName } from './Tip';
import { Rich } from './Text';

/** 学会新配方时的全屏弹窗；打开期间时间暂停 */
export function RecipePopup() {
  const g = useGame();
  const store = useStore();
  const ui = useUi();
  const list = g.recipePopup;
  const open = list.length > 0 && !g.cutscene;
  useEffect(() => {
    store.hold('recipe', open);
  }, [open, store]);
  if (!open) return null;
  const close = (toCraft: boolean) => {
    store.dispatch({ t: 'ackRecipes' });
    if (toCraft) {
      ui.close();
      ui.setSideTab('craft');
      store.dispatch({ t: 'seenRecipes' });
    }
  };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--alert)', padding: '24px clamp(16px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p className="small" style={{ margin: 0, letterSpacing: '0.2em' }}>{t('popup.recipe.label')}</p>
        {list.map((r) => {
          const d = RECIPES[r];
          const ins = Object.entries(d.inputs) as [ItemId, number][];
          const outs = Object.entries(d.outputs) as [ItemId, number][];
          return (
            <div key={r} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 24 }}>{t('recipe.' + r)}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: 16 }}>
                {ins.length === 0 && <span>{t('ui.seawater')}</span>}
                {ins.map(([id, n]) => (
                  <span key={id}>
                    <ItemName id={id} /> ×{n}
                  </span>
                ))}
                <span>→</span>
                {outs.map(([id, n]) => (
                  <span key={id} className="tone-g">
                    <ItemName id={id} /> ×{n}
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, color: 'var(--soft)', lineHeight: 1.7 }}>{t('recipedesc.' + r)}</p>
            </div>
          );
        })}
        <p className="small" style={{ margin: 0 }}>
          <Rich s={t('popup.recipe.note')} />
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="cmd" onClick={() => close(false)}>{t('ui.gotIt')}</button>
          <button className="cmd lead" autoFocus onClick={() => close(true)}>{t('ui.openCraft')}</button>
        </div>
      </div>
    </div>
  );
}
