// 岛上建筑的面板：木筏（停在码头边：货舱装卸、改造）、设施（生产、工人、吃饭、升级）。
// 一个建筑一个功能：货舱和木筏改造在木筏旁，岛的升级在设施旁（docs/2d-design.md “玩法梳理”）。
// 版面是“建筑详情”模板：左边建筑的图和等级星，右边一张张小卡，主按钮在右下。
import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER, type ItemId } from '../../config/items';
import { RECIPES } from '../../config/recipes';
import { WORK_ICON } from '../../config/visual';
import { t } from '../../i18n';
import { buildCost, canUseStock, here } from '../../sim/actions';
import { canLevelUp, islandRate, upgradeCostOf } from '../../sim/economy';
import { charOf, facilityName, facilitySprite } from '../../sim/interact';
import { canPay, isBulk, tankCap } from '../../sim/inventory';
import { residentsOf, workersAt } from '../../sim/people';
import type { Facility } from '../../sim/types';
import { useGame, useStore } from '../../store/hooks';
import { Bowls, Card, label, Chip, CostGrid, Icon, Meter, Picture, Portrait, Stars } from '../components/Kit';
import { Panel, Soon } from './Panel';
import { FocusActions, FocusStatus, PackHoldBody, SlotGrid, useFocus } from './Views';

const E = BALANCE.economy;
const IS = BALANCE.inventory.island;

/** 木筏（停在码头边）：货舱 ↔ 背包、全部卸到仓库；改造货舱 */
export function RaftPanel() {
  const g = useGame();
  const store = useStore();
  const [tab, setTab] = useState('hold');
  const [focus, setFocus] = useFocus();
  const isl = here(g);
  const own = canUseStock(isl) ? isl : undefined;
  const p = g.player;
  const holdIds = ITEM_ORDER.filter((id) => (p.hold[id] ?? 0) > 0);
  const unloadAll = () => {
    for (const id of holdIds) store.dispatch({ t: 'transfer', item: id, from: 'hold', to: 'stock', n: p.hold[id] ?? 0 });
  };
  const cost = buildCost(g, 'holdUpgrade');
  const ok = !!cost && canPay(g, own, cost);
  const tabs = [
    { id: 'hold', label: t('ui.tabHold') },
    { id: 'upgrade', label: t('ui.tabUpgrade') },
  ];
  if (tab === 'hold')
    return (
      <Panel
        title={t('thing.raft')}
        icon="ui_hold"
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        status={<FocusStatus g={g} focus={focus} src={{ pack: p.pack, hold: p.hold, stock: undefined }} />}
        actions={
          <>
            <FocusActions focus={focus} canMoveHold />
            {own && (
              <button className="u-btn sec" disabled={!holdIds.length} onClick={unloadAll}>
                {t('ui.unloadAll')}
              </button>
            )}
          </>
        }
      >
        <PackHoldBody canMove focus={focus} setFocus={setFocus} />
      </Panel>
    );
  const step = BALANCE.home.holdUpgrade.step;
  return (
    <Panel
      title={t('thing.raft')}
      icon="ui_hold"
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      status={!cost ? <span className="u-dim">{t('ui.holdMaxed')}</span> : !ok ? <span className="tone-b">{t('ui.lack')}</span> : null}
      actions={
        cost && (
          <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'build', what: 'holdUpgrade' })}>
            {t('ui.make')}
          </button>
        )
      }
    >
      <div className="v-building">
        <Picture sprite="raft" />
        <div className="v-stack">
          <Card title={t('ui.hold')} icon="ui_hold">
            <div className="v-gain">
              <span>{t('ui.holdSlots', { n: p.holdCap })}</span>
              {cost && (
                <>
                  <Icon id="ui_arrow" size={8} />
                  <b>{t('ui.holdSlots', { n: p.holdCap + step })}</b>
                </>
              )}
            </div>
          </Card>
          {cost && (
            <Card title={t('ui.condCost')} icon="wood">
              <CostGrid g={g} cost={cost} src={own} />
            </Card>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** 设施的产物（加工设施取配方的第一个产物） */
function productOf(f: Facility): ItemId | undefined {
  if (f.kind === 'produce') return f.item;
  return Object.keys(RECIPES[f.recipe].outputs)[0] as ItemId | undefined;
}

/**
 * 设施：先看“在产什么、每小时多少、仓库满没满、为什么停”，再看“谁在干活”，最后是升级卡。
 * 升级卡：连续吃饱画成碗，材料画成格子，升级后的变化画成“现在 → 以后”。两个条件都满足，右下的“升级”才亮。
 */
export function FacilityPanel() {
  const g = useGame();
  const store = useStore();
  const [tab, setTab] = useState('main');
  const isl = here(g);
  if (!isl || !isl.facility) return null;
  const fac = isl.facility;
  const r = islandRate(g, isl);
  const note = r.rate > 0 ? r.note : isl.workNote && r.note === 'work.ok' ? isl.workNote : r.note;
  const ok = r.rate > 0 && note === 'work.ok';
  const workers = workersAt(g, isl);
  const people = residentsOf(g, isl);
  const idle = people.filter((p) => !workers.includes(p));
  const product = productOf(fac);
  const need = E.mealsToUpgrade;
  const cost = upgradeCostOf(isl);
  const canUp = canLevelUp(isl) && !!cost;
  const mealsOk = isl.mealStreak >= need;
  const payOk = !!cost && canPay(g, isl, cost);
  const now = E.levels[isl.level - 1];
  const next = E.levels[isl.level];
  const seats = Math.max(now.people, people.length);
  const kinds = fac.kind === 'produce' ? 1 : Object.keys(RECIPES[fac.recipe].outputs).length;
  const boxSlots = (IS.outputStacks[isl.level - 1] ?? 1) * kinds;
  const boxHas = Object.values(isl.output).some((v) => (v ?? 0) > 0);
  const tabs = [
    { id: 'main', label: t('ui.tabFacility') },
    { id: 'train', label: t('ui.tabTraining'), soon: true },
  ];
  const status = !canUp ? (
    <span className="u-dim">{t('ui.maxLevel')}</span>
  ) : mealsOk && payOk ? (
    <Chip icon="ui_check" tone="ok">
      {t('ui.canUpgrade')}
    </Chip>
  ) : !mealsOk ? (
    <Chip icon="ui_bowlEmpty" tone="warn">
      {t('ui.needMeals', { n: need - isl.mealStreak })}
    </Chip>
  ) : (
    <Chip icon="ui_warn" tone="warn">
      {t('ui.lack')}
    </Chip>
  );
  return (
    <Panel
      title={label(facilityName(fac))}
      icon={product}
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      status={tab === 'main' ? status : null}
      actions={
        tab === 'main' &&
        canUp && (
          <button className="u-btn" disabled={!mealsOk || !payOk} onClick={() => store.dispatch({ t: 'upgradeIsland' })}>
            {t('ui.upgradeTo', { lv: isl.level + 1 })}
          </button>
        )
      }
    >
      {tab === 'train' ? (
        <Soon />
      ) : (
        <div className="v-building">
          <Picture sprite={facilitySprite(fac)}>
            <Stars lv={isl.level} max={E.levels.length} />
          </Picture>
          <div className="v-stack">
            {/* 第一眼：在产什么、多快、仓库、为什么停 */}
            <Card cls="main" title={t('ui.produces')} icon="ui_clock" right={<Chip icon={WORK_ICON[note] ?? 'ui_warn'} tone={ok ? 'ok' : 'warn'}>{t(note)}</Chip>}>
              <div className="v-output">
                {product && (
                  <span className="v-item-big">
                    <Icon id={product} size={24} />
                  </span>
                )}
                <b className={'v-rate' + (r.rate > 0 ? '' : ' off')}>{t('ui.perHourShort', { n: Math.round(r.rate * 10) / 10 })}</b>
              </div>
              {/* 产物去哪：淡水直接进水缸；其他进设施旁的暂存箱，满了停工，玩家决定拿多少进仓库 */}
              {product && isBulk(product) ? (
                <div className="v-box">
                  <span className="u-label">{t('ui.tank')}</span>
                  <Meter value={isl.stock[product] ?? 0} max={tankCap(g, isl)} icon="ui_tank" />
                </div>
              ) : (
                <div className="v-box">
                  <span className="u-label">{t('ui.outputBox')}</span>
                  <SlotGrid stock={isl.output} slots={boxSlots} cols={boxSlots} where="stock" onPick={(id) => store.dispatch({ t: 'collect', to: 'pack', item: id })} />
                  <span className="v-box-btns">
                    <button className="u-btn sec" disabled={!boxHas} onClick={() => store.dispatch({ t: 'collect', to: 'pack' })}>
                      {t('ui.btnToPack')}
                    </button>
                    <button className="u-btn sec" disabled={!boxHas} onClick={() => store.dispatch({ t: 'collect', to: 'stock' })}>
                      {t('ui.collectAll')}
                    </button>
                  </span>
                </div>
              )}
            </Card>
            {/* 第二眼：谁在干活、空位 */}
            <Card title={t('ui.workers')} icon="ui_person" right={<span className="u-dim">{`${workers.length}/${now.people}`}</span>}>
              <span className="k-row">
                {Array.from({ length: seats }, (_, i) => {
                  const p = workers[i] ?? idle[i - workers.length];
                  return p ? <Portrait key={i} char={charOf(p)} name={label(p.name) + (workers.includes(p) ? '' : ' · ' + t('ui.idleTag'))} dim={!workers.includes(p)} /> : <Portrait key={i} />;
                })}
              </span>
            </Card>
            {/* 最后：升级卡 */}
            {canUp && cost && next && (
              <Card cls="up" title={t('ui.upgradeTo', { lv: isl.level + 1 })} icon="ui_star">
                <div className="v-up">
                  <div>
                    <span className="u-label">{t('ui.condMeals')}</span>
                    <Bowls lit={Math.min(isl.mealStreak, need)} total={need} />
                  </div>
                  <div>
                    <span className="u-label">{t('ui.condCost')}</span>
                    <CostGrid g={g} cost={cost} src={isl} />
                  </div>
                  <div className="v-gains">
                    <span className="u-label">{t('ui.gain')}</span>
                    <Gain icon={product ?? 'ui_clock'} label={t('ui.gainRate')} a={'×' + now.mult} b={'×' + next.mult} />
                    <Gain icon="ui_stock" label={t('ui.gainCap')} a={IS.slots[isl.level - 1]} b={IS.slots[isl.level]} />
                    <Gain icon="ui_tank" label={t('ui.gainTank')} a={IS.tank[isl.level - 1]} b={IS.tank[isl.level]} />
                    <Gain icon="ui_person" label={t('ui.gainPeople')} a={now.people} b={next.people} />
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Gain({ icon, label, a, b }: { icon: string; label: string; a: string | number; b: string | number }) {
  return (
    <span className="v-gain" title={label}>
      <Icon id={icon} size={8} />
      <span>{a}</span>
      <Icon id="ui_arrow" size={8} />
      <b>{b}</b>
    </span>
  );
}
