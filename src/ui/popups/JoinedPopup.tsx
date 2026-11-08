// 有人加入：救出同伴或招募原住民以后弹一张卡片（时间暂停）。同一个 Panel 外框。
// 同伴：头像、身份、一句道谢、教会了什么、在这座岛做什么工作；可以“留在这里”或“跟我上船”。
// 原住民：头像、一句话、下一步（带会教的同伴来设施地基培训）。
import { useCallback, useEffect } from 'react';
import { useAckKeys } from './useAckKeys';
import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { charOf } from '../../sim/interact';
import { jobMsg, personLabel } from '../../sim/people';
import type { Job } from '../../sim/types';
import { useGame, useStore } from '../../store/hooks';
import { Card, Chip, label, Portrait } from '../components/Kit';
import { Rich } from '../components/Text';
import { Panel } from '../panels/Panel';

export function JoinedPopup() {
  const g = useGame();
  const store = useStore();
  const id = g.joined[0];
  const who = id ? g.people.find((p) => p.id === id) : undefined;
  const show = !!who && !g.cutscene;
  useEffect(() => {
    store.hold('joined', show);
  }, [show, store]);
  const ack = useCallback(() => store.dispatch({ t: 'ackJoined' }), [store]);
  useAckKeys(show, ack);
  if (!show || !who) return null;
  const native = who.type === 'native';
  const isl = who.loc.kind === 'island' ? g.islands.find((i) => i.id === (who.loc as { id: string }).id) : undefined;
  const here = isl && g.player.at === isl.id;
  const canBoard = !native && here && g.player.hasRaft && g.player.aboard.length < BALANCE.inventory.seats;
  const name = label(personLabel(who));
  return (
    <>
      <div className="shade" />
      <Panel
        title={native ? t('ui.nativeJoinedTitle') : t('ui.joinedTitle', { who: name })}
        icon="ui_person"
        onClose={ack}
        status={native ? <Chip icon="ui_star">{t('ui.nativeJoinedHint')}</Chip> : isl?.facility ? <span className="u-dim">{label(jobMsg(isl.facility as Job))}</span> : null}
        actions={
          native ? (
            <button className="u-btn" autoFocus onClick={ack}>
              {t('ui.gotIt')}
            </button>
          ) : (
            <>
              <button className="u-btn sec" autoFocus onClick={ack}>
                {t('ui.stayHere')}
              </button>
              {canBoard && (
                <button
                  className="u-btn"
                  onClick={() => {
                    store.dispatch({ t: 'pickUp', personId: who.id });
                    ack();
                  }}
                >
                  {t('ui.boardRaft')}
                </button>
              )}
            </>
          )
        }
      >
        <div className="v-talk">
          <div className="v-who">
            <Portrait char={charOf(who)} name={name} big />
            {who.role && <span className="u-dim">{t('role.' + who.role)}</span>}
          </div>
          <div className="v-stack">
            <p className="v-say">
              <Rich s={t(native ? 'talk.native.idle' : `rescue.${who.role}.thanks`)} />
            </p>
            {!native && (
              <Card title={t('ui.learned')} icon="ui_star">
                <p className="v-teach">
                  <Rich s={t(`rescue.${who.role}.teach`)} />
                </p>
              </Card>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
