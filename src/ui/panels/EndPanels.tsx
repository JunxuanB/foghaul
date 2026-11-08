// M5 的面板：残骸（装零件、修直升机）、停机坪（飞往别的停机坪）、进出口局（汇报、出口、订单、升级），
// 以及试飞和结局的过场卡片。
import { useEffect, useState } from 'react';
import { BALANCE } from '../../config/balance';
import { ITEMS, ITEM_ORDER, PART_IDS, type ItemId } from '../../config/items';
import { VILLAGES, WATER_DISPUTE, type VillageId } from '../../config/world';
import { t } from '../../i18n';
import { here } from '../../sim/actions';
import { upgradeCost } from '../../sim/endgame';
import { canPay } from '../../sim/inventory';
import { charOf } from '../../sim/interact';
import { presentPeople } from '../../sim/people';
import type { Stock } from '../../sim/types';
import { useGame, useStore } from '../../store/hooks';
import { Card, Cell, Chip, CostGrid, Icon, Picture, Portrait, Stars } from '../components/Kit';
import { Rich } from '../components/Text';
import { Panel } from './Panel';

/** 每个零件从哪来（请求板的奖励、两村争水） */
function partSource(id: ItemId): string {
  for (const [vid, def] of Object.entries(VILLAGES) as [VillageId, (typeof VILLAGES)[VillageId]][]) {
    if (def.requests.some((r) => r.reward.part === id) || def.repeat?.reward.part === id) return t('village.' + vid);
  }
  if (WATER_DISPUTE.options.some((o) => o.reward.part === id)) return t('ui.disputeShort');
  return '';
}

/**
 * 残骸：五个零件排成一排（装好的打勾、背包里有的亮、还没找到的暗，下面写从哪个村子换），
 * 下面一张“修好直升机”的卡：零件、飞行员在场、材料。主按钮：有零件就“安装零件”，否则“修好直升机”。
 */
export function WreckPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const inPack = PART_IDS.filter((id) => (g.player.pack[id] ?? 0) > 0);
  const installed = g.flags.partsInstalled.length;
  const pilot = presentPeople(g).find((p) => p.role === 'pilot');
  const cost = BALANCE.endgame.repairCost as Stock;
  const payOk = canPay(g, isl, cost);
  const allIn = installed >= PART_IDS.length;
  const reason = inPack.length ? '' : !allIn ? t('ui.needParts', { n: PART_IDS.length - installed }) : !pilot ? t('ui.needRolePresent', { role: t('role.pilot') }) : !payOk ? t('ui.lack') : '';
  return (
    <Panel
      title={t('thing.wreck')}
      icon="partRotor"
      status={reason ? <span className="tone-b">{reason}</span> : null}
      actions={
        inPack.length ? (
          <button className="u-btn" onClick={() => inPack.forEach((id) => store.dispatch({ t: 'installPart', item: id }))}>
            {t('ui.installParts', { n: inPack.length })}
          </button>
        ) : (
          <button className="u-btn" disabled={!!reason} onClick={() => store.dispatch({ t: 'repairPlane' })}>
            {t('ui.repairPlane')}
          </button>
        )
      }
    >
      <div className="v-building">
        <Picture sprite="wreck" />
        <div className="v-stack">
          <Card cls="main" title={t('ui.parts')} icon="partGear" right={<span className="u-dim">{`${installed}/${PART_IDS.length}`}</span>}>
            <span className="k-cells">
              {PART_IDS.map((id) => {
                const done = g.flags.partsInstalled.includes(id);
                const have = (g.player.pack[id] ?? 0) > 0;
                return (
                  <span key={id} className={'k-cell' + (done ? ' ok' : have ? '' : ' dim')} title={t('item.' + id)}>
                    <span className="k-box">
                      <Icon id={id} />
                      {done && <Icon id="ui_check" size={8} />}
                    </span>
                    <span className="k-num">{done ? t('ui.installed') : have ? t('ui.inPack') : partSource(id)}</span>
                  </span>
                );
              })}
            </span>
          </Card>
          <Card title={t('ui.repairPlane')} icon="ui_plane">
            <span className="k-row">
              <Portrait char={pilot ? charOf(pilot) : undefined} name={t('role.pilot')} dim={!pilot} />
              <CostGrid g={g} cost={cost} src={isl} />
            </span>
          </Card>
        </div>
      </div>
    </Panel>
  );
}

/** 停机坪 / 直升机：所有修了停机坪的岛排成一列，点一座飞过去（花一小时） */
export function HelipadPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const [pick, setPick] = useState<string | null>(null);
  const dests = g.islands.filter((i) => i.buildings.helipad && i.discovered && i.id !== isl?.id);
  const sel = dests.find((d) => d.id === pick) ?? dests[0];
  return (
    <Panel
      title={t('thing.helipad')}
      icon="ui_plane"
      status={dests.length ? <span className="u-dim">{t('ui.flyTime', { h: BALANCE.actions.flyMinutes / 60 })}</span> : <span className="tone-b">{t('ui.noPads')}</span>}
      actions={
        sel && (
          <button className="u-btn" onClick={() => store.dispatch({ t: 'fly', to: sel.id })}>
            {t('ui.flyTo', { isl: t('island.' + sel.id) })}
          </button>
        )
      }
    >
      <div className="v-building">
        <Picture sprite="plane" />
        <div className="v-stack">
          <Card cls="main" title={t('ui.destinations')} icon="ui_plane">
            <span className="k-row">
              {dests.map((d) => (
                <button key={d.id} type="button" className={'u-btn sec' + (d === sel ? ' on' : '')} onClick={() => setPick(d.id)}>
                  {t('island.' + d.id)}
                </button>
              ))}
            </span>
          </Card>
          <span className="u-dim">{t('ui.padHint')}</span>
        </div>
      </div>
    </Panel>
  );
}

type UpKind = 'speed' | 'storage' | 'output';
const UPS: { k: UpKind; icon: string }[] = [
  { k: 'speed', icon: 'ui_hold' },
  { k: 'storage', icon: 'ui_stock' },
  { k: 'output', icon: 'ui_clock' },
];

/**
 * 进出口局：还没汇报时只有一件事——“汇报”（结局）。汇报以后是无尽模式：
 * 分页“出口”（背包 / 货舱的东西换贸易额，每格标单价）、“订单”（限时收购，交够有奖励）、“升级”（花贸易额买全网的加成）。
 */
export function OfficePanel() {
  const g = useGame();
  const store = useStore();
  const [tab, setTab] = useState('export');
  const b = g.bureau;
  if (!g.flags.reported)
    return (
      <Panel
        title={t('thing.office')}
        icon="ui_book"
        actions={
          <button className="u-btn" onClick={() => store.dispatch({ t: 'report' })}>
            {t('ui.reportBtn')}
          </button>
        }
      >
        <div className="v-building">
          <Picture sprite="office" />
          <div className="v-stack">
            <Card cls="main" title={t('ui.yourNetwork')} icon="ui_route">
              <Summary />
            </Card>
          </div>
        </div>
      </Panel>
    );
  const coin = (
    <Chip icon="ui_coin" tone="ok">
      {t('ui.tradeNow', { n: Math.floor(b.trade) })}
    </Chip>
  );
  const tabs = [
    { id: 'export', label: t('ui.tabExport') },
    { id: 'order', label: t('ui.tabOrder') },
    { id: 'upgrade', label: t('ui.tabUpgrades') },
  ];
  if (tab === 'export') {
    const rows: { id: ItemId; from: 'pack' | 'hold'; n: number }[] = [];
    for (const from of ['pack', 'hold'] as const)
      for (const id of ITEM_ORDER) {
        const n = g.player[from][id] ?? 0;
        if (n > 0 && !ITEMS[id].key && ITEMS[id].trade > 0) rows.push({ id, from, n });
      }
    return (
      <Panel title={t('thing.office')} icon="ui_coin" tabs={tabs} tab={tab} onTab={setTab} status={coin} actions={<span className="u-dim">{t('ui.exportTap')}</span>}>
        <div className="v-grid" style={{ ['--cols' as string]: 8 }}>
          {rows.map((r) => (
            <button key={r.from + r.id} type="button" className="v-sell" title={t('item.' + r.id)} onClick={() => store.dispatch({ t: 'export', item: r.id, from: r.from, n: r.n })}>
              <Cell id={r.id} need={r.n} />
              <span className="v-price">
                <Icon id="ui_coin" size={6} />
                {ITEMS[r.id].trade}
              </span>
            </button>
          ))}
          {!rows.length && <span className="u-dim v-wide">{t('ui.nothingToExport')}</span>}
        </div>
      </Panel>
    );
  }
  if (tab === 'order') {
    const o = b.order;
    return (
      <Panel title={t('thing.office')} icon="ui_coin" tabs={tabs} tab={tab} onTab={setTab} status={coin}>
        {o ? (
          <Card cls="main" title={t('ui.orderNow')} icon="ui_clock" right={<span className="u-dim">{t('ui.hoursLeft', { n: Math.max(0, Math.ceil((o.deadline - g.time) / 60)) })}</span>}>
            <div className="v-output">
              <Cell id={o.item} have={o.progress} need={o.n} />
              <Icon id="ui_arrow" size={8} />
              <Chip icon="ui_coin" tone="ok">
                {'+' + o.reward}
              </Chip>
            </div>
          </Card>
        ) : (
          <Card title={t('ui.orderNow')} icon="ui_clock">
            <span className="u-dim">{t('ui.orderNext', { n: Math.max(0, Math.ceil((b.nextOrderAt - g.time) / 60)) })}</span>
          </Card>
        )}
        <span className="u-dim">{t('ui.ordersDone', { n: b.ordersDone })}</span>
      </Panel>
    );
  }
  return (
    <Panel title={t('thing.office')} icon="ui_coin" tabs={tabs} tab={tab} onTab={setTab} status={coin}>
      <div className="v-seats">
        {UPS.map(({ k, icon }) => {
          const lv = b.upgrades[k];
          const max = BALANCE.endgame.upgrades[k].costs.length;
          const cost = upgradeCost(g, k);
          return (
            <div key={k} className="k-card v-seat">
              <span className="v-item-big">
                <Icon id={icon} size={16} />
              </span>
              <b>{t('upgrade.' + k)}</b>
              <Stars lv={lv} max={max} />
              <span className="u-dim">{t('ui.upgradeEffect', { n: Math.round(BALANCE.endgame.upgrades[k].per * 100 * lv) })}</span>
              {cost !== null ? (
                <button className="u-btn sec" disabled={b.trade < cost} onClick={() => store.dispatch({ t: 'buyUpgrade', kind: k })}>
                  <Icon id="ui_coin" size={6} /> {cost}
                </button>
              ) : (
                <span className="u-dim">{t('ui.maxLevel')}</span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** 一路走来的成绩：天数、同伴、网络里的岛、运过的货 */
function Summary() {
  const g = useGame();
  const day = Math.floor(g.time / 1440) + 1;
  const people = g.people.filter((p) => p.active).length;
  const owned = g.islands.filter((i) => i.owned).length;
  const made = Object.values(g.stats.produced).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <div className="v-summary">
      <Chip icon="ui_clock">{t('ui.sumDays', { n: day })}</Chip>
      <Chip icon="ui_person">{t('ui.sumPeople', { n: people })}</Chip>
      <Chip icon="ui_star">{t('ui.sumIslands', { n: owned })}</Chip>
      <Chip icon="ui_stock">{t('ui.sumMade', { n: Math.floor(made) })}</Chip>
      <Chip icon="ui_route">{t('ui.sumShipped', { n: g.stats.transported })}</Chip>
    </div>
  );
}

/**
 * 过场（试飞、结局）：全屏压暗，中间一张卡，一句一句往下说（E / Enter / “下一句”），说完“继续”。
 * 结局卡多一行成绩。时间在过场时暂停（store.hold）。
 */
export function CutscenePopup() {
  const g = useGame();
  const store = useStore();
  const c = g.cutscene;
  const [i, setI] = useState(0);
  const n = c?.lines.length ?? 0;
  const last = i >= n - 1;
  useEffect(() => setI(0), [c?.kind]);
  useEffect(() => {
    store.hold('cutscene', !!c);
    if (!c) return;
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' && e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (last) store.dispatch({ t: 'endCutscene' });
      else setI((x) => x + 1);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [c, last, store]);
  if (!c) return null;
  return (
    <>
      <div className="shade dark" />
      <Panel
        title={t(c.kind === 'flight' ? 'ui.cutFlight' : 'ui.cutEnding')}
        icon={c.kind === 'flight' ? 'ui_plane' : 'ui_star'}
        onClose={() => store.dispatch({ t: 'endCutscene' })}
        status={<span className="u-dim">{`${i + 1}/${n}`}</span>}
        actions={
          <button className="u-btn" autoFocus onClick={() => (last ? store.dispatch({ t: 'endCutscene' }) : setI(i + 1))}>
            <span className="u-key">E</span> {t(last ? 'ui.continue' : 'ui.nextLine')}
          </button>
        }
      >
        <div className="v-cut">
          <Picture sprite={c.kind === 'flight' ? 'plane' : 'office'} scale={2} />
          <div className="v-stack">
            <p className="v-say">
              <Rich s={t(c.lines[i])} />
            </p>
            {c.kind === 'ending' && last && <Summary />}
          </div>
        </div>
      </Panel>
    </>
  );
}
