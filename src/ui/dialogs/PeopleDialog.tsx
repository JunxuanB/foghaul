import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { ROLE_BIOME, BIOME_ITEM } from '../../config/recipes';
import { t, tm } from '../../i18n';
import { isHungry, jobMsg } from '../../sim/people';
import { bestWeaponKey, force, levelInfo, personTable, type PlayerSkill } from '../../sim/progression';
import type { GameState, Person } from '../../sim/types';
import { useGame } from '../../store/hooks';
import { ratioBar } from '../selectors';
import { Dialog } from './Dialog';

const P = BALANCE.progression;

function where(g: GameState, p: Person): string {
  if (p.loc.kind === 'raft') return t('ui.onRaft');
  if (p.loc.kind === 'route') {
    const r = g.transport.routes.find((x) => x.id === (p.loc as { id: string }).id);
    return r ? t('ui.routeNo', { no: r.no }) : '';
  }
  return t('island.' + p.loc.id);
}

function skillNext(skill: PlayerSkill, lv: number): string {
  if (skill === 'sail') return lv < P.sailTwoStepLevel ? t('ui.next.twoStep', { lv: P.sailTwoStepLevel }) : t('ui.next.twoStepOn');
  if (skill === 'attack') return lv < BALANCE.sea.combat.critFromLevel ? t('ui.next.crit', { lv: BALANCE.sea.combat.critFromLevel }) : t('ui.next.critOn');
  return t('ui.next.manage', { p: Math.round(Math.min(0.9, (lv - 1) * BALANCE.economy.sleepyReducePerManageLevel) * 100) });
}

export function PeopleDialog() {
  const g = useGame();
  const [picked, setPicked] = useState(0);
  const passengers = g.people.filter((p) => p.type === 'passenger');
  const natives = g.people.filter((p) => p.type === 'native' && p.active);
  const sel = passengers[picked];
  const selInfo = sel ? levelInfo(sel.xp, personTable(sel)) : null;
  return (
    <Dialog kind="people">
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '6px 20px' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('ui.you')}</h2>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--soft)' }}>
            {t('ui.youMeta', { force: force(g), weapon: t(bestWeaponKey(g)), cap: g.player.holdCap })}
          </p>
        </div>
        <div className="grid2" style={{ fontSize: 15, gap: '16px 24px' }}>
          {(['sail', 'attack', 'manage'] as PlayerSkill[]).map((k) => {
            const info = levelInfo(g.player.xp[k], P[k]);
            return (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>{t('skill.' + k)}</span>
                  <span>Lv.{info.level}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--soft)' }}>
                  <span aria-hidden="true">{ratioBar(info.ratio)}</span>
                  <span>{info.next === null ? 'MAX' : `${info.xp}/${info.next}`}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--soft)' }}>{skillNext(k, info.level)}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('ui.passengers', { n: passengers.filter((p) => p.active).length, total: passengers.length })}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 380px', minWidth: 0, fontSize: 15 }}>
            {passengers.map((p, i) => {
              const hungry = p.active && isHungry(g, p);
              return (
                <button key={p.id} className={'pick' + (i === picked ? ' on' : '')} style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }} onClick={() => setPicked(i)} aria-pressed={i === picked}>
                  <span>{tm(p.name)} {p.active ? `Lv.${levelInfo(p.xp, personTable(p)).level}` : ''}</span>
                  <span style={{ color: 'var(--soft)' }}>{p.active ? where(g, p) : '???'}</span>
                  <span className={!p.active ? 'tone-ok' : hungry ? 'tone-al' : 'tone-ok'}>
                    {!p.active ? t('ui.missing') : hungry ? t('ui.starved') : p.learning ? t('ui.learningState') : t('ui.normal')}
                  </span>
                </button>
              );
            })}
          </div>
          {sel && selInfo && (
            <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 24 }}>{tm(sel.name)}</h3>
              {sel.active ? (
                <>
                  <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--soft)' }}>
                    <span aria-hidden="true">{ratioBar(selInfo.ratio)}</span>
                    <span>
                      {sel.role === 'pilot' ? t('ui.xpTransport') : t('ui.xpProduce', { item: t('item.' + BIOME_ITEM[ROLE_BIOME[sel.role!]!]) })}{' '}
                      {selInfo.next === null ? 'MAX' : `${Math.floor(selInfo.xp)}/${selInfo.next}`}
                    </span>
                  </p>
                  <dl className="dl">
                    <dt>{t('ui.location')}</dt>
                    <dd>{where(g, sel)}</dd>
                    <dt>{t('ui.skills')}</dt>
                    <dd>{[sel.role === 'pilot' ? t('ui.trainCrew') : t('job.produce', { item: { k: 'item.' + BIOME_ITEM[ROLE_BIOME[sel.role!]!] } }), ...sel.recipes.map((r) => t('recipe.' + r))].join(t('ui.sep'))}</dd>
                    <dt>{t('ui.bonus')}</dt>
                    <dd>
                      {sel.role === 'pilot'
                        ? t('ui.pilotBonus', { p: Math.round((selInfo.level - 1) * P.pilotSpeedPerLevel * 100) })
                        : t('ui.passengerBonus', { p: Math.round((selInfo.level - 1) * P.passengerBonusPerLevel * 100) })}
                    </dd>
                  </dl>
                  <p className={isHungry(g, sel) ? 'tone-al' : 'tone-ok'} style={{ margin: 0, lineHeight: 1.6 }}>
                    {isHungry(g, sel) ? t('ui.starvedNote') : sel.role === 'pilot' ? t('ui.pilotNote') : t('ui.passengerNote')}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, color: 'var(--soft)' }}>{t('ui.missingNote')}</p>
              )}
            </div>
          )}
        </div>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('ui.natives', { n: natives.length })}</h2>
        {!natives.length ? (
          <p className="empty">{t('ui.noNatives')}</p>
        ) : (
          <ul className="list" style={{ fontSize: 15 }}>
            {natives.map((p) => (
              <li key={p.id} className="row">
                <span className="nm">{tm(p.name)}</span>
                <span className="meta">{tm(jobMsg(p.job))}</span>
                <span className="meta">{where(g, p)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  );
}
