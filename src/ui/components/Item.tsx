import { iconURL } from '../../art/draw';
import type { ItemId } from '../../config/items';
import { t } from '../../i18n';

/** 物品图标 + 名字；鼠标停留显示用途 */
export function ItemName({ id, n }: { id: ItemId; n?: number }) {
  const desc = t('itemdesc.' + id);
  return (
    <span className="item" title={desc.startsWith('itemdesc.') ? undefined : desc}>
      <img src={iconURL(id)} alt="" />
      {t('item.' + id)}
      {n != null && <span>×{n}</span>}
    </span>
  );
}

export function ItemIcon({ id }: { id: ItemId }) {
  return <img src={iconURL(id)} alt={t('item.' + id)} />;
}

/** 一个物品格 */
export function Slot({ id, n, sel, onClick, title, hotkey }: { id?: ItemId; n?: number; sel?: boolean; onClick?: () => void; title?: string; hotkey?: string }) {
  const cls = 'u-slot' + (sel ? ' sel' : '') + (id ? '' : ' empty');
  const body = (
    <>
      {hotkey && <i className="hk">{hotkey}</i>}
      {id && <img src={iconURL(id)} alt={t('item.' + id)} />}
      {id && n != null && n > 1 && <em>{n}</em>}
    </>
  );
  const tip = title ?? (id ? t('item.' + id) : undefined);
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={tip} aria-label={tip}>
      {body}
    </button>
  ) : (
    <span className={cls} title={tip}>
      {body}
    </span>
  );
}
