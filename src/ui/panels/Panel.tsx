import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { useViewStore } from '../../store/hooks';
import { Icon } from '../components/Kit';

export interface Tab {
  id: string;
  label: string;
  /** 还没开放：灰着，点开显示“下一阶段开放” */
  soon?: boolean;
}

/**
 * 所有面板共用的外框（docs/2d-tech.md “面板框架”）：大小固定，不随内容变。
 * 上：图标 + 名字 + 副标题（等级之类）+ 分页 + 关闭；中：内容（多了在里面滚动）；
 * 下：左边一行状态（为什么不行 / 选中的东西），右边主按钮。三块的位置在所有面板里一样。
 */
export function Panel({
  title,
  icon,
  sub,
  tabs,
  tab,
  onTab,
  status,
  actions,
  onClose,
  children,
}: {
  title: string;
  icon?: string;
  sub?: ReactNode;
  tabs?: Tab[];
  tab?: string;
  onTab?: (id: string) => void;
  status?: ReactNode;
  actions?: ReactNode;
  /** 关闭时做什么（默认关掉当前面板；弹窗用它来“知道了”） */
  onClose?: () => void;
  children: ReactNode;
}) {
  const vs = useViewStore();
  return (
    <div className="panel-wrap">
      <section className="u-panel panel" role="dialog" aria-label={title}>
        <header className="panel-head">
          <div className="panel-name">
            {icon && <Icon id={icon} size={12} />}
            <h2 className="u-title">{title}</h2>
            {sub && <span className="panel-sub">{sub}</span>}
          </div>
          {tabs && (
            <nav className="panel-tabs">
              {tabs.map((x) => (
                <button key={x.id} type="button" className={'tab' + (x.id === tab ? ' on' : '') + (x.soon ? ' soon' : '')} aria-pressed={x.id === tab} onClick={() => onTab?.(x.id)}>
                  {x.label}
                </button>
              ))}
            </nav>
          )}
          <button className="x" onClick={onClose ?? (() => vs.set({ panel: null }))} aria-label={t('ui.close')}>
            <span className="u-key">Esc</span>
          </button>
        </header>
        <div className="panel-body">{children}</div>
        <footer className="panel-foot">
          <div className="panel-status">{status}</div>
          <div className="panel-actions">{actions}</div>
        </footer>
      </section>
    </div>
  );
}

/** 还没开放的分页内容 */
export function Soon() {
  return (
    <div className="soon-page">
      <span className="u-title">{t('ui.nextStage')}</span>
    </div>
  );
}
