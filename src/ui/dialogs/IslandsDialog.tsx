import { useState } from 'react';
import { t, tm } from '../../i18n';
import { islandRate, peopleCap } from '../../sim/economy';
import { facilityMsg, headcountOf, residentsOf } from '../../sim/people';
import { ITEM_ORDER } from '../../config/items';
import { useGame, useStore } from '../../store/hooks';
import { M } from '../components/Text';
import { islandStatus } from '../selectors';
import { useUi } from '../ui';
import { Dialog } from './Dialog';

export function IslandsDialog() {
  const g = useGame();
  const store = useStore();
  const ui = useUi();
  const list = g.islands.filter((i) => i.discovered);
  const [picked, setPicked] = useState(Math.max(0, list.findIndex((i) => i.id === ui.dialogArg)));
  const sel = list[picked] ?? list[0];
  const st = islandStatus(g, sel);
  const rate = islandRate(g, sel);
  const stockText = ITEM_ORDER.filter((id) => (sel.stock[id] ?? 0) > 0)
    .map((id) => `${t('item.' + id)} ${sel.stock[id]}`)
    .join(t('ui.sep'));
  return (
    <Dialog kind="islands">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0, fontSize: 15 }}>
          {list.map((i, idx) => {
            const s = islandStatus(g, i);
            return (
              <button key={i.id} className={'pick' + (idx === picked ? ' on' : '')} onClick={() => setPicked(idx)} aria-pressed={idx === picked}>
                <span className={'sw ' + s.cls} aria-hidden="true" style={{ width: 14, height: 14 }} />
                <span>
                  {t('island.' + i.id)}
                  {i.owned && i.facility ? ' / ' + tm(facilityMsg(i.facility)) : ''}
                </span>
                <span className={s.cls === 'stop' ? 'tone-st' : s.cls === 'warn' ? 'tone-al' : 'tone-ok'}>
                  {s.note ? <M m={s.note} /> : i.owned ? t('work.ok') : t('ui.kind.' + i.kind)}
                </span>
              </button>
            );
          })}
        </div>
        {sel && (
          <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 26 }}>{t('island.' + sel.id)}</h3>
            <dl className="dl">
              <dt>{t('ui.kindLabel')}</dt>
              <dd>
                {t('ui.kind.' + sel.kind)}
                {sel.biome ? ' / ' + t('biome.' + sel.biome) : ''}
                {sel.owned && sel.kind !== 'home' ? ' / ' + t('ui.level', { n: sel.level }) : ''}
              </dd>
              {sel.owned && (
                <>
                  <dt>{t('ui.facility')}</dt>
                  <dd>
                    <M m={facilityMsg(sel.facility)} /> {rate.rate > 0 ? `(${Math.round(rate.rate * 10) / 10}/h)` : ''}
                  </dd>
                  <dt>{t('ui.peopleHere')}</dt>
                  <dd>
                    {residentsOf(g, sel).map((p) => tm(p.name)).join(t('ui.sep')) || t('none')} ({headcountOf(g, sel)}/{peopleCap(sel) >= 99 ? '∞' : peopleCap(sel)})
                  </dd>
                  <dt>{t('ui.stock')}</dt>
                  <dd>{stockText || t('none')}</dd>
                  {sel.kind !== 'home' && (
                    <>
                      <dt>{t('ui.demand')}</dt>
                      <dd>{t('ui.demand' + Math.min(3, sel.level))}</dd>
                    </>
                  )}
                  <dt>{t('ui.buildingsLabel')}</dt>
                  <dd>
                    {(['lighthouse', 'bed', 'depot', 'helipad'] as const)
                      .filter((b) => sel.buildings[b])
                      .map((b) => t('ui.b.' + b))
                      .join(t('ui.sep')) || t('none')}
                  </dd>
                </>
              )}
            </dl>
            <p className={st.cls === 'stop' ? 'tone-st' : st.cls === 'warn' ? 'tone-al' : 'tone-ok'} style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>
              {st.cls === 'stop' ? t('ui.todo.stop') : st.cls === 'warn' ? t('ui.todo.warn') : t('ui.todo.ok')}
              {st.note && <> (<M m={st.note} />)</>}
            </p>
            <button
              className="cmd"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                store.dispatch({ t: 'setTarget', islandId: sel.id });
                ui.close();
              }}
            >
              {t('ui.setAsTarget')}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
