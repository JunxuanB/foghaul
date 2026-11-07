import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { useViewStore } from '../../store/hooks';

/** 面板外框：同一时间只开一个，Esc 或右上角关闭 */
export function Panel({ title, sub, wide, children }: { title: string; sub?: ReactNode; wide?: boolean; children: ReactNode }) {
  const vs = useViewStore();
  return (
    <div className="panel-wrap">
      <section className={'u-panel panel' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="panel-head">
          <h2 className="u-title">{title}</h2>
          <button className="x" onClick={() => vs.set({ panel: null })} aria-label={t('ui.close')}>
            Esc {t('ui.close')}
          </button>
        </div>
        {sub && <div className="u-sub">{sub}</div>}
        <div className="panel-body">{children}</div>
      </section>
    </div>
  );
}
