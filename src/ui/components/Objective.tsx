import { t } from '../../i18n';
import { currentObjective } from '../../sim/objectives';
import { useGame } from '../../store/hooks';
import { has } from '../../sim/tutorial';
import { useUi } from '../ui';
import { M } from './Text';

export function ObjectiveCard() {
  const g = useGame();
  const ui = useUi();
  if (!has(g, 'goal')) return null;
  const o = currentObjective(g);
  return (
    <div className="box" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span className="small">{t('ui.objective')}</span>
        <button className="cmd mini" onClick={() => ui.open('journal')}>{t('ui.allGoals')}</button>
      </div>
      <strong><M m={o.title} /></strong>
      <span style={{ color: 'var(--soft)', lineHeight: 1.6 }}><M m={o.detail} /></span>
    </div>
  );
}
