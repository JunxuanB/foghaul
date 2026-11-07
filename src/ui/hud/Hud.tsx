// HUD 四角（docs/2d-design.md 第 9 节）：左上地名、时间、生存值；右上当前目标；左下日志；下中快捷栏。
// 元素按 has() 逐步出现，出现时闪两下。
import { useEffect, useRef, useState } from 'react';
import { BR, phaseAt } from '../../art/palette';
import { BALANCE } from '../../config/balance';
import { ITEM_ORDER } from '../../config/items';
import { PHASES } from '../../config/visual';
import { t, tm } from '../../i18n';
import { dayOf, minuteOfDay } from '../../sim/clock';
import { currentGuide } from '../../sim/guide';
import { objectives } from '../../sim/objectives';
import { activeTip, has } from '../../sim/tutorial';
import { useGame, useStore, useView, useViewStore } from '../../store/hooks';
import { Rich } from '../components/Text';
import { Slot } from '../components/Item';

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
        {t('island.' + (p.at ?? 'home'))}
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
        <b>{title}</b>
        <p>
          <Rich s={detail} />
        </p>
      </div>
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
  const items = ITEM_ORDER.filter((id) => (g.player.pack[id] ?? 0) > 0).slice(0, 5);
  return (
    <div className={'hud-bc' + f}>
      {Array.from({ length: 5 }, (_, i) => (
        <Slot key={i} id={items[i]} n={items[i] ? g.player.pack[items[i]] : undefined} sel={v.hotbar === i} onClick={() => vs.set({ hotbar: i })} />
      ))}
    </div>
  );
}

/** 画面里的字跟着时段换色 */
function usePhaseColors(ref: React.RefObject<HTMLDivElement>) {
  const g = useGame();
  const v = useView();
  const min = v.debugMinute ?? minuteOfDay(g.time);
  const ph = phaseAt(min);
  const key = ph.m < 0.5 ? ph.a : ph.b;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const i of [0, 5, 6, 7, 10, 11]) el.style.setProperty('--w' + i, BR[PHASES[key].t[i]]);
  }, [key, ref]);
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
    </div>
  );
}
