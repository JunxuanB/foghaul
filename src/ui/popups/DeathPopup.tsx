// 倒下了：在最近的床醒来，丢了一部分东西。弹一张卡片，丢的东西画成图标格。
import { useCallback, useEffect } from 'react';
import { useAckKeys } from './useAckKeys';
import { ITEM_ORDER } from '../../config/items';
import { t } from '../../i18n';
import { useGame, useStore } from '../../store/hooks';
import { Card, Chip, Yield } from '../components/Kit';
import { Panel } from '../panels/Panel';

export function DeathPopup() {
  const g = useGame();
  const store = useStore();
  const d = g.lastDeath;
  const show = !!d && !d.seen;
  useEffect(() => {
    store.hold('death', show);
  }, [show, store]);
  const ack = useCallback(() => store.dispatch({ t: 'ackDeath' }), [store]);
  useAckKeys(show, ack);
  if (!show || !d) return null;
  const lost = ITEM_ORDER.filter((id) => (d.lost[id] ?? 0) > 0).map((id) => [id, d.lost[id] ?? 0] as [string, number]);
  return (
    <>
      <div className="shade" />
      <Panel
        title={t('ui.diedTitle')}
        icon="ui_warn"
        onClose={ack}
        status={<Chip icon="ui_bowlEmpty">{t('ui.diedWoke', { bed: { k: 'island.' + d.bed } })}</Chip>}
        actions={
          <button className="u-btn" autoFocus onClick={ack}>
            {t('ui.gotIt')}
          </button>
        }
      >
        <Card title={t('ui.diedLost')} icon="ui_pack">
          {lost.length ? <Yield items={lost} /> : <span className="u-dim">{t('ui.diedNothing')}</span>}
        </Card>
      </Panel>
    </>
  );
}
