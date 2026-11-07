// 昨日收成：每天早上 06:00 结算一次（sim/economy.ts 的 closeDay），弹一张卡片，时间暂停。
// 每座网络里的岛一行：岛名、等级星、产出的图标格、三顿饭（吃饱 / 凑合 / 断供的碗）；最后一行是合计。
import { useEffect } from 'react';
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER, type ItemId } from '../../config/items';
import { t } from '../../i18n';
import type { MealState, Stock } from '../../sim/types';
import { useGame, useStore } from '../../store/hooks';
import { Icon, Stars, Yield } from '../components/Kit';
import { Panel } from '../panels/Panel';

const BOWL: Record<MealState, string> = { full: 'ui_bowl', partial: 'ui_bowlHalf', none: 'ui_bowlEmpty' };

const cells = (s: Stock): [string, number][] => ITEM_ORDER.filter((id) => (s[id] ?? 0) > 0).map((id) => [id, Math.floor(s[id] ?? 0)]);

export function ReportPopup() {
  const g = useGame();
  const store = useStore();
  const r = g.report;
  const show = !!r && !r.seen && !g.recipePopup.length && !g.cutscene;
  useEffect(() => {
    store.hold('report', show);
    if (!show) return;
    // 弹窗开着时 Esc / Enter / E 都是“知道了”，不让按键漏到游戏里
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'Enter' && e.code !== 'KeyE') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      store.dispatch({ t: 'ackReport' });
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [show, store]);
  if (!show || !r) return null;
  const total: Stock = {};
  for (const row of r.rows) for (const [k, v] of Object.entries(row.made)) total[k as ItemId] = (total[k as ItemId] ?? 0) + (v ?? 0);
  const ack = () => store.dispatch({ t: 'ackReport' });
  return (
    <>
      <div className="shade" />
      <Panel
        title={t('ui.reportTitle', { day: r.day })}
        icon="ui_clock"
        onClose={ack}
        status={
          <span className="v-focus">
            <span className="u-label">{t('ui.reportTotal')}</span>
            <Yield items={cells(total)} />
          </span>
        }
        actions={
          <button className="u-btn" autoFocus onClick={ack}>
            {t('ui.gotIt')}
          </button>
        }
      >
        <div className="v-report">
          {r.rows.map((row) => {
            const made = cells(row.made);
            return (
              <div key={row.id} className="v-report-row">
                <span className="v-report-name">
                  <b>{t('island.' + row.id)}</b>
                  <Stars lv={row.level} max={BALANCE.economy.levels.length} />
                </span>
                <span>{made.length ? <Yield items={made} /> : <span className="u-dim">{t('ui.reportNone')}</span>}</span>
                <span className="k-row tight" title={t('ui.reportMeals')}>
                  {row.meals.map((m, i) => (
                    <Icon key={i} id={BOWL[m]} size={12} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
