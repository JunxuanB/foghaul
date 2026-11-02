import { tm } from '../../i18n';
import { useGame } from '../../store/hooks';
import { Rich } from './Text';

/** 事件日志：最新一条最大，越旧越淡 */
export function LogView({ count = 5, big = true }: { count?: number; big?: boolean }) {
  const g = useGame();
  const lines = g.log.slice(-count);
  return (
    <ol aria-live="polite" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: big ? 12 : 8, fontSize: big ? 17 : 15, lineHeight: 1.7 }}>
      {lines.map((l, i) => {
        const back = lines.length - 1 - i;
        const style =
          back === 0
            ? { fontSize: big ? 21 : 16, lineHeight: 1.6 }
            : back === 1
              ? { color: 'var(--soft)' }
              : { color: 'var(--dim)' };
        const cls = l.c === 'bad' ? 'tone-b' : l.c === 'hint' ? 'tone-h' : l.c === 'warn' ? 'tone-w' : '';
        return (
          <li key={g.log.length - lines.length + i} style={style} className={cls}>
            <Rich s={tm(l.m)} />
            {back === 0 && <span className="cursor" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
