import { useState, type ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  node: ReactNode;
}

/** 手机布局用的简单标签页 */
export function Tabs({ tabs, initial, value, onChange }: { tabs: TabDef[]; initial?: string; value?: string; onChange?: (id: string) => void }) {
  const [own, setOwn] = useState(initial ?? tabs[0]?.id);
  const cur = value ?? own;
  const setCur = (id: string) => (onChange ? onChange(id) : setOwn(id));
  const sel = tabs.find((x) => x.id === cur) ?? tabs[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <nav role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)' }}>
        {tabs.map((x) => (
          <button key={x.id} data-coach={'tab-' + x.id} role="tab" aria-selected={x.id === sel.id} className={'tab' + (x.id === sel.id ? ' tab-on' : '')} style={{ flex: '1 1 0', justifyContent: 'center', fontSize: 15 }} onClick={() => setCur(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>
      <div role="tabpanel">{sel.node}</div>
    </div>
  );
}
