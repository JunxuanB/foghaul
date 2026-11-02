import type { Need } from '../../config/world';
import { t, tm } from '../../i18n';
import { carriedForNeed, needMsg } from '../../sim/inventory';
import { useGame, useStore } from '../../store/hooks';

/** 需求清单 + 交付按钮（救援、招募、村落请求共用） */
export function NeedList({ need, progress, title, reward, blocked }: { need: Need[]; progress: number[]; title: string; reward?: string; blocked?: string }) {
  const g = useGame();
  const store = useStore();
  const can = need.some((n, i) => (progress[i] ?? 0) < n.n && carriedForNeed(g, n) > 0);
  return (
    <div className="box box-alert" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
      <strong>{title}</strong>
      <ul className="list">
        {need.map((n, i) => {
          const have = progress[i] ?? 0;
          const carry = carriedForNeed(g, n);
          const done = have >= n.n;
          return (
            <li key={i} className="row" style={{ minHeight: 40 }}>
              <span className="nm">{tm(needMsg(n))}</span>
              <span className={done ? 'meta' : 'meta tone-al'}>
                {have}/{n.n}
              </span>
              <span className="meta">{done ? '✓' : t('ui.carrying', { n: carry })}</span>
            </li>
          );
        })}
      </ul>
      {reward && <span className="small">{reward}</span>}
      {blocked && <span className="tone-al">{blocked}</span>}
      <button className="cmd lead" style={{ alignSelf: 'flex-start' }} disabled={!can || !!blocked} onClick={() => store.dispatch({ t: 'deliver' })}>
        {t('ui.deliver')}
      </button>
    </div>
  );
}
