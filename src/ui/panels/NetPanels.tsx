// M4 的面板：村落的请求板（一张张“请求卡”，奖励一开始就看得见）、学堂（同伴学配方）、
// 建设地基（床、仓库、停机坪）、主岛的农田、船坞（运输木筏和运输线）。
// 版面沿用三个模板：建筑详情（左图右卡）、清单（一行一项）、对话交付（需求格 + 交付）。
import { useState } from 'react';
import { BALANCE } from '../../config/balance';
import { ITEMS, type ItemId } from '../../config/items';
import { RECIPES, type RecipeId } from '../../config/recipes';
import { VILLAGES, WATER_DISPUTE, type Need, type Reward, type VillageRequest } from '../../config/world';
import { t } from '../../i18n';
import { buildCost, here, plotReady, trainCost } from '../../sim/actions';
import { canPay, carriedForNeed, needItems } from '../../sim/inventory';
import { charOf, plotOptions } from '../../sim/interact';
import { presentPeople, rolePresent } from '../../sim/people';
import { freeRafts, idleCrew, portableCargo, routeEndpoints } from '../../sim/transport';
import type { GameState, Person, Route, Stock } from '../../sim/types';
import { currentRequest, villageOf } from '../../sim/villages';
import { findIsland } from '../../sim/util';
import { useGame, useStore } from '../../store/hooks';
import { Card, Cell, Chip, CostGrid, Icon, label, Meter, Picture, Portrait } from '../components/Kit';
import { Panel } from './Panel';

/** 一个配方的图标：它的第一个产物（运输木筏、木筏没有产物，用货舱图标） */
export function recipeIcon(r: RecipeId): string {
  return (Object.keys(RECIPES[r].outputs)[0] as string | undefined) ?? 'ui_hold';
}

/** 奖励画成格子：配方（产物图标）、武器、零件、人 */
export function rewardCells(r: Reward): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  if (r.recipe) out.push({ id: recipeIcon(r.recipe), text: t('recipe.' + r.recipe) });
  if (r.weapon) out.push({ id: r.weapon === 'harpoon' ? 'spear' : 'ui_flare', text: t('weapon.' + r.weapon) });
  if (r.part) out.push({ id: r.part, text: t('item.' + r.part) });
  if (r.natives) out.push({ id: 'ui_person', text: t('ui.peopleN', { n: r.natives }) });
  return out;
}

function RewardCells({ r, dim }: { r: Reward; dim?: boolean }) {
  return (
    <span className="k-cells">
      {rewardCells(r).map((c) => (
        <span key={c.id} className={'k-cell v-reward' + (dim ? ' dim' : '')} title={c.text}>
          <span className="k-box">
            <Icon id={c.id} />
          </span>
          <span className="k-num">{c.text}</span>
        </span>
      ))}
    </span>
  );
}

function NeedCells({ g, need, progress, state }: { g: GameState; need: Need[]; progress: number[]; state: 'done' | 'cur' | 'next' }) {
  return (
    <span className="k-cells">
      {need.map((n, i) => {
        const id = needItems(n)[0];
        if (state === 'done') return <Cell key={i} id={id} have={n.n} need={n.n} />;
        if (state === 'next') return <Cell key={i} id={id} need={n.n} tone="dim" />;
        const have = progress[i] ?? 0;
        const carry = carriedForNeed(g, n);
        return (
          <span key={i} className="v-need">
            <Cell id={id} have={have} need={n.n} />
            <span className={'u-dim' + (carry > 0 && have < n.n ? ' tone-g' : '')}>{t('ui.carry', { n: carry })}</span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * 请求板：村子的全部请求排成一张清单（像星露谷社区中心的收集包），做完的打勾、当前的亮着、后面的暗着；
 * 每一行右边是奖励，一开始就看得到能换来什么（配方、武器、飞机零件、人手）。交付在底栏。
 * 两村争水的事件也贴在这里（麦香村、人力村的请求板）。
 */
export function BoardPanel() {
  const g = useGame();
  const store = useStore();
  const [tab, setTab] = useState('req');
  const isl = here(g);
  const vid = isl ? villageOf(isl) : null;
  if (!isl || !vid) return null;
  const def = VILLAGES[vid];
  const v = g.villages[vid];
  const dispute = g.flags.waterDispute === 'pending' && (vid === 'wheat' || vid === 'labor');
  const trust = def.trustRole && !rolePresent(g, def.trustRole) ? def.trustRole : null;
  const cur = currentRequest(g, vid);
  const rows: { req: VillageRequest; st: 'done' | 'cur' | 'next'; repeat?: boolean }[] = def.requests.map((req, i) => ({ req, st: i < v.favor ? 'done' : i === v.favor ? 'cur' : 'next' }));
  if (def.repeat) rows.push({ req: def.repeat, st: v.favor >= def.requests.length ? 'cur' : 'next', repeat: true });
  const canGive = !!cur && !trust && cur.need.some((n, i) => (v.progress[i] ?? 0) < n.n && carriedForNeed(g, n) > 0);
  const tabs = dispute ? [{ id: 'req', label: t('ui.tabRequests') }, { id: 'dispute', label: t('ui.tabDispute') }] : undefined;
  if (dispute && tab === 'dispute')
    return (
      <Panel title={t('village.' + vid)} icon="ui_warn" tabs={tabs} tab={tab} onTab={setTab} status={<span className="u-dim">{t('ui.disputePick')}</span>}>
        <p className="v-say-plain">{t('dispute.text')}</p>
        <div className="v-train">
          {WATER_DISPUTE.options.map((o) => (
            <Card key={o.id} title={t('village.' + o.id)} icon="ui_person">
              <RewardCells r={o.reward} />
              <button className="u-btn" onClick={() => store.dispatch({ t: 'choose', option: o.id })}>
                {t('dispute.' + o.id + '.label')}
              </button>
            </Card>
          ))}
        </div>
      </Panel>
    );
  const status = trust ? (
    <Chip icon="ui_person" tone="warn">
      {t('ui.needRolePresent', { role: t('role.' + trust) })}
    </Chip>
  ) : v.pendingRecipes.length ? (
    <Chip icon="ui_book" tone="ok">
      {t('ui.goSchool', { recipe: t('recipe.' + v.pendingRecipes[0]) })}
    </Chip>
  ) : !cur ? (
    <Chip icon="ui_check" tone="ok">
      {t('ui.allRequestsDone')}
    </Chip>
  ) : !canGive ? (
    <span className="tone-b">{t('ui.nothingToGive')}</span>
  ) : null;
  return (
    <Panel
      title={t('village.' + vid)}
      icon="ui_stock"
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      status={status}
      actions={
        cur && (
          <button className="u-btn" disabled={!canGive} onClick={() => store.dispatch({ t: 'deliver' })}>
            {t('ui.give')}
          </button>
        )
      }
    >
      <div className="v-reqs">
        {rows.map(({ req, st, repeat }, i) => (
          <div key={i} className={'v-req ' + st}>
            <span className="v-req-no">{st === 'done' ? <Icon id="ui_check" size={8} /> : repeat ? '∞' : i + 1}</span>
            <NeedCells g={g} need={req.need} progress={v.progress} state={st} />
            <Icon id="ui_arrow" size={8} />
            <RewardCells r={req.reward} dim={st === 'next'} />
            {repeat && v.repeatCount > 0 && <span className="u-dim">{'×' + v.repeatCount}</span>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * 学堂：请求换来的配方要由对应的同伴来学。一张卡一个配方：产物、要谁来学（在场亮、不在暗）；
 * 正在学的画一根进度条。学完以后同伴留在村里，和他说话“跟我上船”带回去。
 */
export function SchoolPanel() {
  const g = useGame();
  const store = useStore();
  const [pick, setPick] = useState<RecipeId | null>(null);
  const isl = here(g);
  const vid = isl ? villageOf(isl) : null;
  if (!isl || !vid) return null;
  const v = g.villages[vid];
  const learning = g.people.filter((p) => p.learning?.village === vid);
  const offered = v.pendingRecipes;
  const sel = offered.find((r) => r === pick) ?? offered[0];
  const role = sel ? RECIPES[sel].role : null;
  const student = role ? presentPeople(g).find((p) => p.role === role && !p.learning) : undefined;
  const L = BALANCE.actions.learnMinutes;
  const reason = !sel ? '' : !student ? t('ui.needRolePresent', { role: t('role.' + (role ?? 'pilot')) }) : '';
  return (
    <Panel
      title={t('thing.school')}
      icon="ui_book"
      status={reason ? <span className="tone-b">{reason}</span> : sel ? <span className="u-dim">{t('ui.learnTime', { h: L / 60 })}</span> : null}
      actions={
        sel && (
          <button className="u-btn" disabled={!student} onClick={() => student && store.dispatch({ t: 'learn', personId: student.id, recipe: sel })}>
            {t('ui.learnBtn')}
          </button>
        )
      }
    >
      <div className="v-building">
        <Picture sprite="school" />
        <div className="v-stack">
          {learning.map((p) => (
            <Card key={p.id} cls="main" title={t('ui.learningTag')} icon="ui_clock">
              <div className="v-output">
                <Portrait char={charOf(p)} name={label(p.name)} />
                <Icon id={recipeIcon(p.learning!.recipe)} size={16} />
                <Meter value={L - Math.max(0, p.learning!.until - g.time)} max={L} label={t('recipe.' + p.learning!.recipe)} />
              </div>
            </Card>
          ))}
          {offered.length ? (
            <Card title={t('ui.canLearn')} icon="ui_book">
              <span className="k-row">
                {offered.map((r) => {
                  const rl = RECIPES[r].role ?? 'pilot';
                  const who = rolePresent(g, rl);
                  return (
                    <button key={r} type="button" className={'v-lesson' + (r === sel ? ' on' : '')} onClick={() => setPick(r)}>
                      <span className="k-box">
                        <Icon id={recipeIcon(r)} />
                      </span>
                      <Portrait char={who ? charOf(who) : undefined} name={t('role.' + rl)} dim={!who} />
                      <span className="k-num">{t('recipe.' + r)}</span>
                    </button>
                  );
                })}
              </span>
            </Card>
          ) : (
            !learning.length && (
              <Card title={t('ui.canLearn')} icon="ui_book">
                <span className="u-dim">{t('ui.schoolEmpty')}</span>
              </Card>
            )
          )}
        </div>
      </div>
    </Panel>
  );
}

const PLOT_SPRITE = { bed: 'hut', depot: 'shed', helipad: 'pad' } as const;

/** 建设地基：每种能建的东西一个分页（图、建好以后多了什么、材料），主按钮“建造” */
export function PlotPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const opts = isl ? plotOptions(g, isl) : [];
  const [tab, setTab] = useState<string>(opts[0] ?? 'bed');
  if (!isl || !opts.length) return null;
  const what = (opts.includes(tab as never) ? tab : opts[0]) as 'bed' | 'depot' | 'helipad';
  const cost = (buildCost(g, what) ?? {}) as Stock;
  const ok = canPay(g, isl, cost);
  return (
    <Panel
      title={t('thing.plot')}
      icon="ui_hammer"
      tabs={opts.map((o) => ({ id: o, label: t('build.' + o) }))}
      tab={what}
      onTab={setTab}
      status={!ok ? <span className="tone-b">{t('ui.lack')}</span> : null}
      actions={
        <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'build', what })}>
          {t('ui.buildBtn')}
        </button>
      }
    >
      <div className="v-building">
        <Picture sprite={PLOT_SPRITE[what]} />
        <div className="v-stack">
          <Card cls="main" title={t('build.' + what)} icon="ui_hammer">
            <span className="u-dim">{t('build.' + what + '.d')}</span>
          </Card>
          <Card title={t('ui.condCost')} icon="wood">
            <CostGrid g={g} cost={cost} src={isl} />
          </Card>
        </div>
      </div>
    </Panel>
  );
}

/** 主岛的农田：三块地，每块一张卡（苗 / 麦穗、长了多久），农民在才能种 */
export function FarmPanel() {
  const g = useGame();
  const store = useStore();
  const farmer = g.people.find((p) => p.role === 'farmer' && p.active);
  const plots = g.flags.farm;
  const grow = BALANCE.home.farm.growMinutes;
  const ready = plots.findIndex((_, i) => plotReady(g, i));
  const empty = plots.findIndex((p) => p === null || p === undefined);
  return (
    <Panel
      title={t('thing.farm')}
      icon="wheat"
      status={!farmer ? <span className="tone-b">{t('ui.needFarmer')}</span> : <span className="u-dim">{t('ui.farmYield', { n: BALANCE.home.farm.yield })}</span>}
      actions={
        ready >= 0 ? (
          <button className="u-btn" onClick={() => store.dispatch({ t: 'harvest', plot: ready })}>
            {t('ui.harvest')}
          </button>
        ) : (
          <button className="u-btn" disabled={!farmer || empty < 0} onClick={() => store.dispatch({ t: 'plant', plot: empty })}>
            {t('ui.plant')}
          </button>
        )
      }
    >
      <div className="v-seats">
        {plots.map((p, i) => {
          const planted = p !== null && p !== undefined;
          const ok = plotReady(g, i);
          return (
            <div key={i} className={'k-card v-seat' + (planted ? '' : ' empty')}>
              <span className="v-item-big">{planted ? <Icon id={ok ? 'wheat' : 'herb'} size={ok ? 24 : 12} /> : <Icon id="ui_personEmpty" size={12} />}</span>
              <b>{t(planted ? (ok ? 'ui.ripe' : 'ui.growing') : 'ui.plotEmpty')}</b>
              {planted && !ok && <Meter value={g.time - (p ?? 0)} max={grow} label={t('ui.hoursLeft', { n: Math.ceil((grow - (g.time - (p ?? 0))) / 60) })} />}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- 船坞

/**
 * 船坞（主岛）：分页“运输木筏”（造船：工程师要在场、会造）和“运输线”（一条线一行：两头的岛、两个方向运什么、船员、货舱里装着什么）。
 * 新开一条线：选两座岛、两个方向的货、一位船员（受过培训的原住民）。规则在 sim/transport.ts。
 */
export function ShipyardPanel() {
  const g = useGame();
  const store = useStore();
  const [tab, setTab] = useState('raft');
  const [form, setForm] = useState<{ a?: string; b?: string; ab?: string; ba?: string; crew?: string }>({});
  const isl = here(g);
  if (!isl) return null;
  const tabs = [
    { id: 'raft', label: t('ui.tabTransportRaft') },
    { id: 'crew', label: t('ui.crew') },
    { id: 'routes', label: t('ui.tabRoutes') },
  ];
  const free = freeRafts(g);
  if (tab === 'crew') {
    // 船员：这座岛上的原住民，由在场的飞行员培训
    const pilot = presentPeople(g).find((p) => p.role === 'pilot');
    const natives = g.people.filter((p) => p.type === 'native' && p.active && p.loc.kind === 'island' && p.loc.id === isl.id && p.job?.kind !== 'crew');
    const student = natives.find((p) => p.id === form.crew) ?? natives[0];
    const cost = trainCost({ kind: 'crew' });
    const payOk = canPay(g, isl, cost);
    const reason = !natives.length ? t('ui.noNativesHere') : !pilot ? t('ui.needRolePresent', { role: t('role.pilot') }) : !payOk ? t('ui.lack') : '';
    return (
      <Panel
        title={t('thing.shipyard')}
        icon="ui_person"
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        status={reason ? <span className="tone-b">{reason}</span> : null}
        actions={
          <button className="u-btn" disabled={!!reason} onClick={() => student && pilot && store.dispatch({ t: 'train', personId: student.id, trainerId: pilot.id, job: { kind: 'crew' } })}>
            {t('ui.trainBtn')}
          </button>
        }
      >
        <div className="v-train">
          <Card title={t('ui.student')} icon="ui_person">
            <span className="k-row">
              {natives.length ? (
                natives.map((p) => (
                  <button key={p.id} type="button" className={'v-pick' + (p === student ? ' on' : '')} onClick={() => setForm({ ...form, crew: p.id })} title={label(p.name)}>
                    <Portrait char={charOf(p)} name={label(p.name)} />
                  </button>
                ))
              ) : (
                <Portrait />
              )}
            </span>
          </Card>
          <Card title={t('ui.teacher')} icon="ui_star">
            <Portrait char={pilot ? charOf(pilot) : undefined} name={t('role.pilot')} dim={!pilot} />
          </Card>
          <Card title={t('ui.jobPick')} icon="ui_hold">
            <span className="k-row">
              <Icon id="ui_hold" />
              <span className="u-dim">{t('job.crew')}</span>
            </span>
          </Card>
          <Card title={t('ui.condCost')} icon="wood">
            <CostGrid g={g} cost={cost} src={isl} />
          </Card>
        </div>
      </Panel>
    );
  }
  if (tab === 'raft') {
    const eng = presentPeople(g).find((p) => p.role === 'engineer');
    const knows = !!eng?.recipes.includes('transportRaft');
    const cost = RECIPES.transportRaft.inputs as Stock;
    const ok = knows && canPay(g, isl, cost);
    return (
      <Panel
        title={t('thing.shipyard')}
        icon="ui_hold"
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        status={!eng ? <span className="tone-b">{t('ui.needRolePresent', { role: t('role.engineer') })}</span> : !knows ? <span className="tone-b">{t('ui.engineerCantRaft')}</span> : !ok ? <span className="tone-b">{t('ui.lack')}</span> : null}
        actions={
          <button className="u-btn" disabled={!ok} onClick={() => store.dispatch({ t: 'buildTransportRaft' })}>
            {t('ui.buildRaftBtn')}
          </button>
        }
      >
        <div className="v-building">
          <Picture sprite="shipyard" />
          <div className="v-stack">
            <Card cls="main" title={t('ui.transportRafts')} icon="ui_hold" right={<span className="u-dim">{t('ui.raftsFree', { n: free, all: g.transport.rafts })}</span>}>
              <span className="k-row">
                {Array.from({ length: Math.max(1, g.transport.rafts) }, (_, i) => (
                  <span key={i} className={'k-cell' + (i < g.transport.rafts ? '' : ' dim')}>
                    <span className="k-box">
                      <Icon id="ui_hold" />
                    </span>
                  </span>
                ))}
              </span>
            </Card>
            <Card title={t('ui.condCost')} icon="wood">
              <span className="k-row">
                <Portrait char={eng ? charOf(eng) : undefined} name={t('role.engineer')} dim={!knows} />
                <CostGrid g={g} cost={cost} src={isl} />
              </span>
            </Card>
          </div>
        </div>
      </Panel>
    );
  }
  const ends = routeEndpoints(g);
  const crews = idleCrew(g);
  const cargo = portableCargo();
  const a = form.a ?? ends[0]?.id;
  const b = form.b ?? ends.find((x) => x.id !== a)?.id;
  const crew = crews.find((p) => p.id === form.crew) ?? crews[0];
  const ab = (form.ab || null) as ItemId | null;
  const ba = (form.ba || null) as ItemId | null;
  const reason = free <= 0 ? t('ui.noFreeRaft') : !crew ? t('ui.noCrew') : !a || !b || a === b ? t('ui.pickTwo') : !ab && !ba ? t('ui.pickCargo') : '';
  const sel = (v: string | undefined, set: (x: string) => void, opts: { id: string; text: string }[]) => (
    <select className="u-sel" value={v ?? ''} onChange={(e) => set(e.target.value)}>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.text}
        </option>
      ))}
    </select>
  );
  const islOpts = ends.map((i) => ({ id: i.id, text: t('island.' + i.id) }));
  const itemOpts = [{ id: '', text: t('ui.cargoNone') }, ...cargo.map((c) => ({ id: c, text: t('item.' + c) }))];
  return (
    <Panel
      title={t('thing.shipyard')}
      icon="ui_route"
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      status={reason ? <span className="tone-b">{reason}</span> : <span className="u-dim">{t('ui.raftsFree', { n: free, all: g.transport.rafts })}</span>}
      actions={
        <button
          className="u-btn"
          disabled={!!reason}
          onClick={() => a && b && crew && store.dispatch({ t: 'createRoute', a, b, cargoAB: ab, cargoBA: ba, crewId: crew.id })}
        >
          {t('ui.openRoute')}
        </button>
      }
    >
      <div className="v-routes">
        {g.transport.routes.map((r) => (
          <RouteRow key={r.id} g={g} r={r} onDelete={() => store.dispatch({ t: 'deleteRoute', id: r.id })} />
        ))}
        <Card title={t('ui.newRoute')} icon="ui_route">
          <div className="v-route-form">
            {sel(a, (x) => setForm({ ...form, a: x }), islOpts)}
            {sel(form.ab ?? '', (x) => setForm({ ...form, ab: x }), itemOpts)}
            <Icon id="ui_arrow" size={8} />
            {sel(b, (x) => setForm({ ...form, b: x }), islOpts)}
            {sel(form.ba ?? '', (x) => setForm({ ...form, ba: x }), itemOpts)}
          </div>
          <span className="k-row">
            <span className="u-label">{t('ui.crew')}</span>
            {crews.length ? (
              crews.map((p) => (
                <button key={p.id} type="button" className={'v-pick' + (p === crew ? ' on' : '')} onClick={() => setForm({ ...form, crew: p.id })} title={label(p.name)}>
                  <Portrait char={charOf(p)} name={label(p.name)} />
                </button>
              ))
            ) : (
              <span className="u-dim">{t('ui.noCrewHint')}</span>
            )}
          </span>
        </Card>
      </div>
    </Panel>
  );
}

function RouteRow({ g, r, onDelete }: { g: GameState; r: Route; onDelete: () => void }) {
  const crew: Person | undefined = g.people.find((p) => p.id === r.crewId);
  const low = r.supplies.water <= 0 || r.supplies.food <= 0;
  const cargoIcon = (c: ItemId | null) => (c ? <Icon id={c} size={12} title={t('item.' + c)} /> : <span className="u-dim">—</span>);
  return (
    <div className="k-card v-route">
      <b>{'#' + r.no}</b>
      <span className="v-route-ends">
        {t('island.' + r.a)} {cargoIcon(r.cargoAB)} <Icon id="ui_arrow" size={6} /> {t('island.' + r.b)} {cargoIcon(r.cargoBA)}
      </span>
      {crew && <Portrait char={charOf(crew)} name={label(crew.name)} />}
      <span className="v-route-state">
        {r.load ? <Cell id={r.load.item} need={r.load.n} /> : <span className="u-dim">{t(r.phase === 'dock' ? 'ui.routeDocked' : 'ui.routeEmpty')}</span>}
        {low && (
          <Chip icon="ui_warn" tone="warn">
            {t('ui.hungryTag')}
          </Chip>
        )}
      </span>
      <span className="u-dim">{t('ui.delivered', { n: r.delivered })}</span>
      <button className="u-btn sec" onClick={onDelete}>
        {t('ui.closeRoute')}
      </button>
    </div>
  );
}

/** 一个岛名（给别的面板用） */
export function islandName(g: GameState, id: string | null | undefined): string {
  return id && findIsland(g, id) ? t('island.' + id) : '';
}

export function tradeOf(id: ItemId): number {
  return ITEMS[id].trade;
}
