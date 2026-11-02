import type { ReactNode } from 'react';
import { ITEMS, type ItemId } from '../../config/items';
import { t } from '../../i18n';
import { activeTip } from '../../sim/tutorial';
import { useGame, useStore } from '../../store/hooks';
import { Rich } from './Text';

/** 情境提示：同一时间最多一条，点“知道了”关闭 */
export function TipBox() {
  const g = useGame();
  const store = useStore();
  const id = activeTip(g);
  if (!id) return null;
  return (
    <div className="box tipbox-card" role="note">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <strong className="tone-h">{t('tip.' + id + '.title')}</strong>
        <button className="cmd mini" onClick={() => store.dispatch({ t: 'dismissTip', id })}>{t('ui.gotIt')}</button>
      </div>
      <p style={{ margin: '6px 0 0', lineHeight: 1.7 }}>
        <Rich s={t('tip.' + id + '.body')} />
      </p>
    </div>
  );
}

function effectText(id: ItemId): string {
  const e = ITEMS[id].eat;
  if (!e) return '';
  const parts: string[] = [];
  if (e.hp) parts.push(`${t('ui.hp')} +${e.hp}`);
  if (e.water) parts.push(`${t('ui.water')} +${e.water}`);
  if (e.food) parts.push(`${t('ui.food')} +${e.food}`);
  return t('ui.effect', { verb: t('verb.' + (ITEMS[id].verb ?? 'eat')), list: parts.join(t('ui.sep')) });
}

/** 物品名：鼠标悬停或点按时显示用途 */
export function ItemName({ id }: { id: ItemId }) {
  const def = ITEMS[id];
  const desc = def.key ? t('itemdesc.part') : t('itemdesc.' + id);
  const eff = effectText(id);
  const extra = !def.portable ? t('ui.bulkNote') : '';
  return (
    <span className="tip" tabIndex={0}>
      {t('item.' + id)}
      <span className="tipbubble" role="tooltip">
        {desc}
        {eff && <span style={{ display: 'block', marginTop: 4 }} className="tone-g">{eff}</span>}
        {extra && <span style={{ display: 'block', marginTop: 4, color: 'var(--soft)' }}>{extra}</span>}
      </span>
    </span>
  );
}

/** 任何名字都可以带说明气泡：建筑、设施、需求等 */
export function Info({ label, text }: { label: ReactNode; text: string }) {
  return (
    <span className="tip" tabIndex={0}>
      {label}
      <span className="tipbubble" role="tooltip">
        <Rich s={text} />
      </span>
    </span>
  );
}
