// 每个面板对应一个建筑或一个全局键（docs/2d-design.md 第 9 节“面板清单”）。
// 外框都是 Panel（大小固定），内容用 Views 的模板和 Kit 的零件拼，不写说明句子。
import { useState } from 'react';
import { iconURL, spriteURL } from '../../art/draw';
import { BALANCE } from '../../config/balance';
import { PART_IDS, type ItemId } from '../../config/items';
import { RECIPES, RECIPE_ORDER, type RecipeId } from '../../config/recipes';
import { LANGS, t, tm } from '../../i18n';
import { canUseStock, craftBlock, here } from '../../sim/actions';
import { dryStock, slotsUsed, stockSlots } from '../../sim/inventory';
import { useGame, useStore, useView, useViewStore } from '../../store/hooks';
import { Card, Cell, Chip, CostGrid, Icon, Key, label, Picture, Portrait, reasonText, Yield } from '../components/Kit';
import { charOf } from '../../sim/interact';
import { canDo, isHungry, jobMsg, personLabel } from '../../sim/people';
import type { Job, Person } from '../../sim/types';
import { Rich } from '../components/Text';
import { useUi } from '../ui';
import { FacilityPanel, RaftPanel } from './IslandPanels';
import { Panel } from './Panel';
import { LighthousePanel, MapPanel, TalkPanel } from './SeaPanels';
import { Column, FocusActions, FocusStatus, PackHoldBody, SlotGrid, TankStrip, useFocus } from './Views';

const P = BALANCE.inventory;

/** 背包（Tab）。有木筏后多一栏货舱：海上可以直接搬，岛上要到木筏旁 */
export function InventoryPanel() {
  const g = useGame();
  const p = g.player;
  const [focus, setFocus] = useFocus();
  const atSea = !p.at;
  return (
    <Panel
      title={t('ui.pack')}
      icon="ui_pack"
      status={<FocusStatus g={g} focus={focus} src={{ pack: p.pack, hold: p.hold, stock: undefined }} />}
      actions={<FocusActions focus={focus} canMoveHold={atSea && p.hasRaft} />}
    >
      {p.hasRaft ? (
        <PackHoldBody canMove={atSea} focus={focus} setFocus={setFocus} />
      ) : (
        <div className="v-cols">
          <Column icon="ui_pack" title={t('ui.pack')} right={t('ui.slotsUsed', { n: slotsUsed(p.pack), cap: P.packCap })}>
            <SlotGrid stock={p.pack} slots={P.packCap} cols={4} where="pack" focus={focus} onFocus={setFocus} />
          </Column>
          <ItemCard id={focus?.where === 'pack' && (p.pack[focus.id] ?? 0) > 0 ? focus.id : undefined} />
        </div>
      )}
    </Panel>
  );
}

/** 选中物品的大图卡（右栏）：图标、名字、用途 */
function ItemCard({ id }: { id?: ItemId }) {
  if (!id) return <div className="v-col v-empty" />;
  const desc = t('itemdesc.' + id);
  return (
    <div className="v-col v-item">
      <span className="v-item-big">
        <Icon id={id} size={32} />
      </span>
      <b>{t('item.' + id)}</b>
      {!desc.startsWith('itemdesc.') && <p>{desc}</p>}
    </div>
  );
}

function knownRecipes(g: ReturnType<typeof useGame>): RecipeId[] {
  return RECIPE_ORDER.filter((r) => g.player.recipes.includes(r) && !RECIPES[r].noFacility && !(r === 'raft' && g.player.hasRaft));
}

/** 配方的图：产物图标；木筏用木筏的图 */
function RecipeIcon({ r, size = 16 }: { r: RecipeId; size?: number }) {
  const def = RECIPES[r];
  if (def.special === 'raft') {
    const s = spriteURL('raft');
    return <img className="k-ic fit" src={s.url} alt="" style={{ ['--s' as string]: size }} />;
  }
  const out = Object.keys(def.outputs)[0];
  return out ? <Icon id={out} size={size} /> : null;
}

/** 制作（工作台）：左边配方格，右边选中的配方：要什么 → 得到什么 */
export function CraftPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const src = canUseStock(isl) ? isl : undefined;
  const rs = knownRecipes(g);
  const [pick, setPick] = useState<RecipeId | null>(null);
  const cur = pick && rs.includes(pick) ? pick : rs.find((r) => !craftBlock(g, r)) ?? rs[0];
  const def = cur ? RECIPES[cur] : undefined;
  const block = cur ? craftBlock(g, cur) : null;
  return (
    <Panel
      title={t('thing.workbench')}
      icon="wood"
      status={cur && block ? <span className="tone-b">{reasonText(block)}</span> : null}
      actions={
        cur && (
          <button className="u-btn" disabled={!!block} onClick={() => store.dispatch({ t: 'craft', recipe: cur })}>
            {t('ui.make')}
          </button>
        )
      }
    >
      {rs.length === 0 || !cur || !def ? (
        <p className="v-note">{t('ui.noRecipes')}</p>
      ) : (
        <div className="v-cols">
          <Column icon="ui_clock" title={t('ui.recipes')}>
            <div className="v-grid" style={{ ['--cols' as string]: 4 }}>
              {rs.map((r) => (
                <button key={r} type="button" className={'u-slot' + (r === cur ? ' sel' : '') + (craftBlock(g, r) ? ' off' : '')} onClick={() => setPick(r)} title={t('recipe.' + r)}>
                  <RecipeIcon r={r} />
                </button>
              ))}
            </div>
          </Column>
          <div className="v-col v-recipe">
            <div className="v-recipe-name">
              <span className="v-item-big">
                <RecipeIcon r={cur} size={32} />
              </span>
              <div>
                <b>{t('recipe.' + cur)}</b>
                <span className="k-chip dim">
                  <Icon id="ui_clock" size={8} />
                  {t('ui.minutes', { n: def.manualMinutes })}
                </span>
              </div>
            </div>
            <div className="v-eq">
              {Object.keys(def.inputs).length ? <CostGrid g={g} cost={def.inputs} src={src} /> : <span className="k-cells"><Cell id="water" label={t('ui.seawater')} /></span>}
              <Icon id="ui_arrow" size={8} />
              {def.special === 'raft' ? (
                <span className="k-cells">
                  <span className="k-cell">
                    <span className="k-box">
                      <RecipeIcon r={cur} />
                    </span>
                    <span className="k-num">×1</span>
                  </span>
                </span>
              ) : (
                <Yield items={Object.entries(def.outputs) as [string, number][]} />
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** 储物箱：左边背包，右边储物箱的格子（和背包同一套格子 + 堆叠，格数随岛等级变多），下面是单独的水缸。点一下整格放进 / 取出 */
export function ChestPanel() {
  const g = useGame();
  const store = useStore();
  const isl = here(g);
  const [focus, setFocus] = useFocus();
  if (!isl || !canUseStock(isl)) return null;
  const dry = dryStock(isl.stock);
  const slots = stockSlots(g, isl);
  const move = (id: ItemId, from: 'pack' | 'stock') => {
    const src = from === 'pack' ? g.player.pack : isl.stock;
    store.dispatch({ t: 'transfer', item: id, from, to: from === 'pack' ? 'stock' : 'pack', n: src[id] ?? 0 });
  };
  return (
    <Panel
      title={t('thing.chest')}
      icon="ui_stock"
      status={<FocusStatus g={g} isl={isl} focus={focus} src={{ pack: g.player.pack, hold: undefined, stock: isl.stock }} />}
      actions={<FocusActions focus={focus} canStock />}
    >
      <div className="v-cols">
        <Column icon="ui_pack" title={t('ui.pack')} right={t('ui.slotsUsed', { n: slotsUsed(g.player.pack), cap: P.packCap })}>
          <SlotGrid stock={g.player.pack} slots={P.packCap} cols={4} where="pack" focus={focus} onFocus={setFocus} onPick={(id) => move(id, 'pack')} />
        </Column>
        <div className="v-col">
          <Column icon="ui_stock" title={t('ui.warehouse')} right={t('ui.slotsUsed', { n: slotsUsed(dry), cap: slots })}>
            <SlotGrid stock={dry} slots={slots} cols={6} where="stock" focus={focus} onFocus={setFocus} onPick={(id) => move(id, 'stock')} />
          </Column>
          <TankStrip g={g} isl={isl} />
        </div>
      </div>
    </Panel>
  );
}

/** 维修（直升机残骸）：零件格：装好的打勾，背包里有的亮，缺的暗 */
export function WreckPanel() {
  const g = useGame();
  return (
    <Panel title={t('thing.wreck')} icon="partRotor" status={<span className="u-dim">{t('ui.repairSoon')}</span>}>
      <div className="v-building">
        <Picture sprite="wreck" />
        <div className="v-stack">
          <Card title={t('ui.parts')} icon="partGear">
            <span className="k-cells">
              {PART_IDS.map((id) => {
                const done = g.flags.partsInstalled.includes(id);
                const have = (g.player.pack[id] ?? 0) > 0;
                return <CellPart key={id} id={id} state={done ? 'done' : have ? 'have' : 'missing'} />;
              })}
            </span>
          </Card>
        </div>
      </div>
    </Panel>
  );
}

function CellPart({ id, state }: { id: ItemId; state: 'done' | 'have' | 'missing' }) {
  return (
    <span className={'k-cell' + (state === 'missing' ? ' dim' : '')} title={t('item.' + id)}>
      <span className="k-box">
        <Icon id={id} />
        {state === 'done' && <img className="k-tick" src={iconURL('ui_check')} alt="" />}
      </span>
      <span className="k-num">{t(state === 'done' ? 'ui.installed' : state === 'have' ? 'ui.inPack' : 'ui.partMissing')}</span>
    </span>
  );
}

/** 日志（J）：日志是剧情文字，可以有强调色 */
export function JournalPanel() {
  const g = useGame();
  const lines = g.log.slice(-60).reverse();
  return (
    <Panel title={t('ui.journal')} icon="ui_clock">
      <div className="logfull">
        {lines.map((l, i) => (
          <div key={i}>
            <Rich s={tm(l.m)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** 人物（P）：网络里所有的人，一人一张卡：头像、名字、在哪、在做什么、有没有断供 */
export function PeoplePanel() {
  const g = useGame();
  const ppl = g.people.filter((p) => p.active);
  const where = (p: Person) => (p.loc.kind === 'raft' ? t('ui.onRaft') : p.loc.kind === 'island' ? t('island.' + p.loc.id) : t('job.crew'));
  return (
    <Panel title={t('ui.people')} icon="ui_person" status={<span className="u-dim">{ppl.length}</span>}>
      <div className="v-people">
        {ppl.map((p) => {
          const isl = p.loc.kind === 'island' ? g.islands.find((i) => i.id === (p.loc as { id: string }).id) : undefined;
          // 原住民看学会的工作；同伴在自己能干活的岛上看那座岛的设施，否则写身份
          const doing = p.type === 'native' ? label(jobMsg(p.job)) : isl?.facility && canDo(p, isl.facility) ? label(jobMsg(isl.facility as Job)) : t('role.' + p.role);
          return (
            <div key={p.id} className="k-card v-person">
              <Portrait char={charOf(p)} name={label(personLabel(p))} />
              <div>
                <b>{label(personLabel(p))}</b>
                <span className="u-dim">{where(p)}</span>
                <span className="v-person-tags">
                  {p.learning ? <Chip icon="ui_clock">{t('ui.learningTag')}</Chip> : <span className="u-dim">{doing}</span>}
                  {isHungry(g, p) && (
                    <Chip icon="ui_bowlEmpty" tone="warn">
                      {t('ui.hungryTag')}
                    </Chip>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const KEYS: [string, string][] = [
  ['WASD', 'ui.keyMove'],
  ['E', 'ui.keyUse'],
  ['Tab', 'ui.keyPack'],
  ['1–5', 'ui.keyHotbar'],
  ['Q', 'ui.keyEat'],
  ['J', 'ui.keyJournal'],
  ['P', 'ui.keyPeople'],
  ['M', 'ui.keyMap'],
  ['H', 'ui.keyHelp'],
  ['Esc', 'ui.keyMenu'],
  ['X', 'ui.keyFish'],
  ['Z', 'ui.keyDrink'],
  ['F', 'ui.keyCrate'],
];
const HELP = ['goal', 'time', 'craft', 'bags'];

/** 帮助（H）：按键一页画成键帽，规则一页是文字（帮助本来就是给人读的） */
export function HelpPanel() {
  const [tab, setTab] = useState('keys');
  return (
    <Panel
      title={t('ui.help')}
      icon="ui_eye"
      tabs={[
        { id: 'keys', label: t('ui.tabControls') },
        { id: 'rules', label: t('ui.tabRules') },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'keys' ? (
        <div className="v-keys">
          {KEYS.map(([k, label]) => (
            <div key={k}>
              <Key k={k} />
              <span>{t(label)}</span>
            </div>
          ))}
        </div>
      ) : (
        HELP.map((k) => (
          <div key={k} className="v-help">
            <h3>{t('help.' + k + '.title')}</h3>
            <p>
              <Rich s={t('help2d.' + k)} />
            </p>
          </div>
        ))
      )}
    </Panel>
  );
}

/** 菜单（Esc）：继续、存档、帮助、语言、回到欢迎页 */
export function MenuPanel() {
  const store = useStore();
  const vs = useViewStore();
  const ui = useUi();
  return (
    <Panel title={t('ui.menu')} status={<span className="u-dim">{t('ui.paused')}</span>}>
      <div className="menu">
        <button className="u-btn" autoFocus onClick={() => vs.set({ panel: null })}>
          {t('ui.resume')}
        </button>
        <button
          className="u-btn sec"
          onClick={() => {
            store.save();
            vs.set({ panel: null });
          }}
        >
          {t('ui.saveNow')}
        </button>
        <button className="u-btn sec" onClick={() => vs.set({ panel: 'help' })}>
          {t('ui.help')}
        </button>
        <div className="seg">
          <span className="u-label">{t('ui.language')}</span>
          {LANGS.map((l) => (
            <button key={l} className={'u-btn' + (ui.lang === l ? '' : ' sec')} aria-pressed={ui.lang === l} onClick={() => ui.setLang(l)}>
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
        <button
          className="u-btn sec"
          onClick={() => {
            store.save();
            vs.set({ panel: null });
            ui.toWelcome();
          }}
        >
          {t('ui.toWelcome')}
        </button>
      </div>
    </Panel>
  );
}

export function PanelHost() {
  const v = useView();
  switch (v.panel) {
    case 'inventory':
      return <InventoryPanel />;
    case 'craft':
      return <CraftPanel />;
    case 'chest':
      return <ChestPanel />;
    case 'lighthouse':
      return <LighthousePanel />;
    case 'wreck':
      return <WreckPanel />;
    case 'journal':
      return <JournalPanel />;
    case 'talk':
      return <TalkPanel />;
    case 'raft':
      return <RaftPanel />;
    case 'facility':
      return <FacilityPanel />;
    case 'map':
      return <MapPanel />;
    case 'help':
      return <HelpPanel />;
    case 'menu':
      return <MenuPanel />;
    case 'people':
      return <PeoplePanel />;
    default:
      return null;
  }
}

