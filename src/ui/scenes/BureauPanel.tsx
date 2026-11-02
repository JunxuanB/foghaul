import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { upgradeCost } from '../../sim/endgame';
import { useGame, useStore } from '../../store/hooks';

export function BureauPanel() {
  const g = useGame();
  const store = useStore();
  const b = g.bureau;
  if (!g.flags.reported) {
    return (
      <div className="box box-alert" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span>{t('ui.reportPrompt')}</span>
        <button className="cmd lead" style={{ alignSelf: 'flex-start' }} onClick={() => store.dispatch({ t: 'report' })}>
          {t('ui.report')}
        </button>
      </div>
    );
  }
  const o = b.order;
  return (
    <div className="grid2" style={{ fontSize: 15 }}>
      <section>
        <h3 className="h3">{t('ui.trade', { n: b.trade, total: b.totalTrade })}</h3>
        {o ? (
          <div className="box box-alert" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>{t('ui.order', { item: t('item.' + o.item), have: o.progress, n: o.n })}</strong>
            <span className="small">
              {t('ui.orderMeta', { reward: o.reward, h: Math.max(0, Math.ceil((o.deadline - g.time) / 60)) })}
            </span>
          </div>
        ) : (
          <p className="empty">{t('obj.endless.wait')}</p>
        )}
        <p className="small">{t('ui.exportHint')}</p>
      </section>
      <section>
        <h3 className="h3">{t('ui.upgrades')}</h3>
        <ul className="list">
          {(['speed', 'storage', 'output'] as const).map((k) => {
            const cost = upgradeCost(g, k);
            const lv = b.upgrades[k];
            const per = Math.round(BALANCE.endgame.upgrades[k].per * 100);
            return (
              <li key={k} className="row">
                <span className="nm">
                  {t('upgrade.' + k)} Lv.{lv}
                  <span className="small" style={{ display: 'block' }}>{t('ui.upgradeEach', { p: per })}</span>
                </span>
                <span className="acts">
                  <button className="cmd mini" disabled={cost === null || b.trade < cost} onClick={() => store.dispatch({ t: 'buyUpgrade', kind: k })}>
                    {cost === null ? t('ui.maxed') : t('ui.buy', { cost })}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
