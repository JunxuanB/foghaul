// HUD 四角（docs/2d-design.md 第 9 节）：左上地名、时间、生存值；右上当前目标；左下日志；下中快捷栏。
// 元素按 has() 逐步出现，出现时闪两下。
import { useEffect, useRef, useState } from 'react';
import { BR, blendTable, phaseAt } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../config/items';
import { slotView } from '../../sim/inventory';
import { t, tm } from '../../i18n';
import { dayOf, minuteOfDay } from '../../sim/clock';
import { currentGuide } from '../../sim/guide';
import { objectives } from '../../sim/objectives';
import { activeTip, has } from '../../sim/tutorial';
import { towardsMsg } from '../../sim/hints';
import { useGame, useStore, useView, useViewStore } from '../../store/hooks';
import { Rich } from '../components/Text';
import { ItemName, Slot } from '../components/Item';

/** 第一次出现时闪两下 */
function useFlash(on: boolean): string {
  const was = useRef(on);
  const [f, setF] = useState(false);
  useEffect(() => {
    if (on && !was.current) {
      setF(true);
      const id = setTimeout(() => setF(false), 1100);
      was.current = on;
      return () => clearTimeout(id);
    }
    was.current = on;
  }, [on]);
  return f ? ' flash' : '';
}

const pad = (n: number) => String(n).padStart(2, '0');

function Status() {
  const g = useGame();
  const v = useView();
  const showClock = has(g, 'clock');
  const showVitals = has(g, 'vitals');
  const fc = useFlash(showClock);
  const fv = useFlash(showVitals);
  const min = minuteOfDay(g.time);
  const S = BALANCE.survival;
  const p = g.player;
  const bars: [string, number, number, string][] = [
    ['ui.hp', p.hp, S.maxHp, 'var(--c10)'],
    ['ui.water', p.water, S.maxWater, 'var(--c5)'],
    ['ui.food', p.food, S.maxFood, 'var(--c9)'],
  ];
  return (
    <div className="hud-tl">
      <div className={'hud-place' + fc}>
        {p.at ? t('island.' + p.at) : t('ui.atSea')}
        {showClock && <small>{t('ui.clock', { day: dayOf(g.time), hh: pad(Math.floor(min / 60)), mm: pad(Math.floor(min % 60)) })}</small>}
      </div>
      {showVitals && (
        <div className={'u-panel u-bars' + fv + (v.anchors.uiTarget === 'vitals' ? ' coach' : '')} data-coach="vitals">
          {bars.map(([k, val, max, fill]) => (
            <div key={k} className={'u-bar' + (val / max < 0.25 ? ' low' : '')}>
              <span>{t(k)}</span>
              <i style={{ ['--v' as string]: Math.max(0, Math.min(1, val / max)), ['--fill' as string]: fill }} />
              <span>{Math.round(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Goal() {
  const g = useGame();
  const show = has(g, 'goal');
  const f = useFlash(show);
  if (!show) return null;
  const step = currentGuide(g);
  let title: string;
  let detail: string;
  if (step) {
    title = t('guide.' + step.id);
    detail = tm(step.detail(g));
  } else {
    const o = objectives(g).find((x) => !x.done);
    if (!o) return null;
    title = tm(o.title);
    detail = tm(o.detail);
  }
  return (
    <div className="hud-tr">
      <div className={'u-panel goal' + f}>
        <span className="u-label">{t('ui.goal')}</span>
        <b>
          <Rich s={title} />
        </b>
        <p>
          <Rich s={detail} />
        </p>
      </div>
      <Towards />
    </div>
  );
}

/** 海上：目标卡下面一行方向提示（“→ 石头岛 东南 10 格”） */
function Towards() {
  const g = useGame();
  if (g.player.at) return null;
  const step = currentGuide(g);
  const id = (step?.target.kind === 'island' ? step.target.id : step?.at) ?? g.player.target;
  const isl = id ? g.islands.find((i) => i.id === id && i.revealed) : undefined;
  if (!isl) return null;
  return (
    <div className="towards">
      <Rich s={tm(towardsMsg(g, isl.id))} />
    </div>
  );
}

/** 海上战斗：一张小卡片，显示双方武力和结果，几秒后收起 */
function FightCard() {
  const g = useGame();
  const f = g.lastFight;
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!f) return;
    setShown(f.at);
    const id = setTimeout(() => setShown(null), BALANCE.ui.fightCardMs);
    return () => clearTimeout(id);
  }, [f?.at]);
  if (!f || shown !== f.at) return null;
  return (
    <div className="u-panel fight">
      <b>{t('foe.' + f.foe)}</b>
      <div className="vs">
        <span>{t('ui.yourForce', { n: f.mine })}</span>
        <span>{t('ui.foeForce', { n: f.theirs })}</span>
      </div>
      <div className={'res ' + (f.win ? 'tone-g' : 'tone-b')}>{t(f.win ? 'ui.fightWon' : 'ui.fightLost')}</div>
    </div>
  );
}

/** 海上：右下角的图例（迷雾 / 可探索 / 已探索） */
function SeaLegend() {
  const g = useGame();
  if (g.player.at) return null;
  return (
    <div className="u-panel legend">
      <span>
        <i className="sw fog" />
        {t('ui.legendFog')}
      </span>
      <span>
        <i className="sw open" />
        {t('ui.legendOpen')}
      </span>
      <span>
        <i className="sw seen" />
        {t('ui.legendSeen')}
      </span>
    </div>
  );
}

function LogLines() {
  const g = useGame();
  const show = has(g, 'log');
  const lines = g.log.filter((l) => !l.m.k.startsWith('opening.')).slice(-BALANCE.ui.hudLogLines);
  if (!show) return null;
  return (
    <div className="u-log" aria-live="polite">
      {lines.map((l, i) => (
        <div key={l.at + ':' + i + ':' + l.m.k} className={i < lines.length - 1 ? 'old' : ''}>
          <Rich s={tm(l.m)} />
        </div>
      ))}
    </div>
  );
}

function TipCard() {
  const g = useGame();
  const store = useStore();
  const id = activeTip(g);
  const step = currentGuide(g);
  // 引导第 6 步：介绍生命 / 水 / 食物
  if (step?.id === 'vitals') {
    return (
      <div className="u-panel tipcard click">
        <b>{t('guide.vitals')}</b>
        <p>
          <Rich s={t('guide.vitals.body')} />
        </p>
        <button className="u-btn" onClick={() => store.dispatch({ t: 'ackGuide', id: 'vitals' })}>
          {t('ui.gotIt')}
        </button>
      </div>
    );
  }
  if (!id) return null;
  return (
    <div className="u-panel tipcard click">
      <b>{t('tip.' + id + '.title')}</b>
      <p>
        <Rich s={t('tip.' + id + '.body')} />
      </p>
      <button className="u-btn sec" onClick={() => store.dispatch({ t: 'dismissTip', id })}>
        {t('ui.gotIt')}
      </button>
    </div>
  );
}

function Hotbar() {
  const g = useGame();
  const v = useView();
  const vs = useViewStore();
  const show = has(g, 'hotbar');
  const f = useFlash(show);
  if (!show) return null;
  const slots = slotView(g.player.pack).slots;
  return (
    <div className={'hud-bc' + f}>
      {Array.from({ length: BALANCE.ui.hotbarSlots }, (_, i) => (
        <Slot key={i} hotkey={String(i + 1)} id={slots[i]?.id} n={slots[i]?.n} sel={v.hotbar === i} onClick={() => vs.set({ hotbar: i })} />
      ))}
    </div>
  );
}

/** 右下角：海上的图例，下面是快捷栏选中的物品（名字、数量、能用时的按键）。固定在角上，快捷栏本身不会被挤动 */
function Selected() {
  const g = useGame();
  const v = useView();
  const cur = has(g, 'hotbar') ? slotView(g.player.pack).slots[v.hotbar] : undefined;
  if (!cur)
    return (
      <div className="hud-br">
        <SeaLegend />
      </div>
    );
  const def = ITEMS[cur.id];
  return (
    <div className="hud-br">
      <SeaLegend />
      <div className="u-panel sel-card">
        <ItemName id={cur.id} n={cur.n} />
        {def.eat && (
          <span className="keyhint">
            <span className="u-key">Q</span>
            {t(def.verb === 'drink' ? 'ui.drinkIt' : def.verb === 'use' ? 'ui.useIt' : 'ui.eatIt')}
          </span>
        )}
      </div>
    </div>
  );
}

function usePhaseColors(ref: React.RefObject<HTMLDivElement>) {
  const g = useGame();
  const v = useView();
  const min = v.debugMinute ?? minuteOfDay(g.time);
  const table = blendTable(phaseAt(min)).join(',');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = table.split(',').map(Number);
    for (const i of [0, 5, 6, 7, 10, 11]) el.style.setProperty('--w' + i, BR[t[i]]);
  }, [table, ref]);
}

export function Hud() {
  const ref = useRef<HTMLDivElement>(null);
  usePhaseColors(ref);
  return (
    <div className="hud" ref={ref}>
      <Status />
      <Goal />
      <div className="hud-bl">
        <TipCard />
        <LogLines />
      </div>
      <Hotbar />
      <Selected />
      <FightCard />
    </div>
  );
}
