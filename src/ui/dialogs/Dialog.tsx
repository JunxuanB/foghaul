import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../../i18n';
import { useGame } from '../../store/hooks';
import { useUi, type DialogKind } from '../ui';

/** 原生 dialog 外壳，顶部是面板切换 */
export function Dialog({ kind, children, tabs = true }: { kind: Exclude<DialogKind, null>; children: ReactNode; tabs?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const ui = useUi();
  const g = useGame();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const transport = g.people.some((x) => x.role === 'pilot' && x.active);
  const list: [Exclude<DialogKind, null>, string][] = [
    ['people', t('ui.people')],
    ['islands', t('ui.islands')],
    ...(transport ? ([['routes', t('ui.routes')]] as [Exclude<DialogKind, null>, string][]) : []),
    ['journal', t('ui.journal')],
  ];
  return (
    <dialog
      ref={ref}
      className="panel"
      onCancel={(e) => {
        e.preventDefault();
        ui.close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ui.close();
      }}
    >
      <div className="panel-in">
        <div className="panel-top">
          {tabs ? (
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {list.map(([k, label]) => (
                <button key={k} className={'tab' + (k === kind ? ' tab-on' : '')} aria-current={k === kind ? 'page' : undefined} onClick={() => ui.open(k)}>
                  {label}
                </button>
              ))}
            </nav>
          ) : (
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{t('ui.' + kind)}</h2>
          )}
          <button className="cmd" style={{ marginBottom: 6 }} onClick={ui.close}>
            {t('ui.close')}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
