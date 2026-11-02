import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { craftable } from '../../sim/actions';
import { carried } from '../../sim/inventory';
import { teachableJobs, presentPeople } from '../../sim/people';
import { has } from '../../sim/tutorial';
import type { GameState } from '../../sim/types';
import { island, islandAt } from '../../sim/util';
import { ISLANDS } from '../../config/world';
import { useGame, useStore } from '../../store/hooks';
import { useUi, type Ui } from '../ui';
import { Rich } from './Text';

// 聚焦引导：在关键时刻把屏幕调暗，只留下要点的那一个按钮或板块，并在旁边说明。
// 每一步只出现一次；点了高亮的东西或“知道了”就结束。聚焦期间时间暂停。

interface Step {
  id: string;
  /** data-coach 的值；可以给多个，按顺序取第一个在页面上的（手机上有些按钮收在菜单里） */
  targets: string[];
  when: (g: GameState, ui: Ui) => boolean;
}

const wood = (g: GameState) => carried(g, 'wood') + (island(g, 'home').stock.wood ?? 0);
const here = (g: GameState) => (g.player.at ? island(g, g.player.at) : undefined);

export const COACH: Step[] = [
  { id: 'branch', targets: ['gather-branch'], when: (g) => g.player.at === 'home' && !g.player.hasRaft && wood(g) === 0 },
  { id: 'clock', targets: ['clock'], when: (g) => has(g, 'clock') && !has(g, 'vitals') },
  { id: 'craftTab', targets: ['tab-craft'], when: (g, ui) => !g.player.hasRaft && craftable(g, 'raft') && ui.sideTab !== 'craft' },
  { id: 'craftRaft', targets: ['craft-raft'], when: (g, ui) => !g.player.hasRaft && craftable(g, 'raft') && ui.sideTab === 'craft' },
  { id: 'vitals', targets: ['stats'], when: (g) => has(g, 'vitals') },
  { id: 'setSail', targets: ['set-sail'], when: (g) => g.player.hasRaft && g.stats.moves === 0 && g.player.at === 'home' },
  { id: 'dpad', targets: ['dpad'], when: (g) => !g.player.at && g.stats.moves === 0 },
  { id: 'guide', targets: ['guide'], when: (g) => !g.player.at && g.stats.moves >= 2 && !!g.player.target },
  {
    id: 'dock',
    targets: ['dock'],
    when: (g) => {
      const i = islandAt(g, g.player.x, g.player.y);
      return !g.player.at && !!i && i.discovered && !i.visited;
    },
  },
  {
    id: 'deliver',
    targets: ['deliver'],
    when: (g) => {
      const i = here(g);
      const tpl = i && ISLANDS.find((x) => x.id === i.id);
      return !!i && !i.owned && !!(tpl?.rescueNeed || tpl?.recruitNeed);
    },
  },
  { id: 'lighthouse', targets: ['build-lighthouse'], when: (g) => !!here(g) && g.lighthouseAsked.includes(here(g)!.id) && !here(g)!.buildings.lighthouse },
  { id: 'water', targets: ['stock-water'], when: (g) => !!here(g)?.owned && (here(g)!.stock.water ?? 0) > 0 && here(g)!.kind !== 'home' },
  {
    id: 'train',
    targets: ['train'],
    when: (g) => {
      const i = here(g);
      if (!i || !i.owned || i.kind !== 'native' || g.flags.firstTraining) return false;
      return presentPeople(g).some((p) => p.type === 'passenger' && teachableJobs(p, i).length > 0);
    },
  },
  { id: 'routes', targets: ['nav-routes', 'menu'], when: (g) => has(g, 'routes') && g.transport.routes.length === 0 && g.transport.rafts > 0 },
];

function activeStep(g: GameState, ui: Ui): Step | null {
  for (const s of COACH) if (!g.tips.includes('coach.' + s.id) && s.when(g, ui)) return s;
  return null;
}

function findTarget(step: Step): HTMLElement | null {
  for (const id of step.targets) {
    const el = document.querySelector<HTMLElement>(`[data-coach="${id}"]`);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

export function useCoachActive(): boolean {
  const g = useGame();
  const ui = useUi();
  return !!activeStep(g, ui);
}

export function Coach() {
  const g = useGame();
  const ui = useUi();
  const store = useStore();
  const step = ui.dialog || g.cutscene || g.recipePopup.length ? null : activeStep(g, ui);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolled = useRef<string | null>(null);

  // 找到目标并测量位置；目标还没渲染出来时等一等
  useLayoutEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const el = findTarget(step);
      if (el) {
        if (scrolled.current !== step.id) {
          scrolled.current = step.id;
          el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        }
        const r = el.getBoundingClientRect();
        setRect((old) => (old && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r));
      } else setRect(null);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step?.id]);

  const shown = !!step && !!rect;
  useEffect(() => {
    store.hold('coach', shown);
  }, [shown, store]);
  useEffect(() => () => store.hold('coach', false), [store]);

  // 点了高亮的东西就算完成
  useEffect(() => {
    if (!step || !rect) return;
    const el = findTarget(step);
    if (!el) return;
    const done = () => store.dispatch({ t: 'dismissTip', id: 'coach.' + step.id });
    el.addEventListener('click', done, { capture: true, once: true });
    return () => el.removeEventListener('click', done, { capture: true });
  }, [step?.id, !!rect]);

  if (!step || !rect) return null;
  const pad = 6;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = y + h + 180 < vh || y < 180;
  const calloutW = Math.min(340, vw - 32);
  const calloutLeft = Math.max(16, Math.min(vw - calloutW - 16, x + w / 2 - calloutW / 2));
  const scrim = { position: 'fixed' as const, background: 'var(--scrim)', zIndex: 60 };
  return (
    <>
      <div style={{ ...scrim, left: 0, top: 0, width: vw, height: Math.max(0, y) }} />
      <div style={{ ...scrim, left: 0, top: y + h, width: vw, height: Math.max(0, vh - y - h) }} />
      <div style={{ ...scrim, left: 0, top: y, width: Math.max(0, x), height: h }} />
      <div style={{ ...scrim, left: x + w, top: y, width: Math.max(0, vw - x - w), height: h }} />
      <div aria-hidden="true" style={{ position: 'fixed', left: x, top: y, width: w, height: h, border: '2px solid var(--alert)', zIndex: 61, pointerEvents: 'none', boxShadow: '0 0 0 4px rgba(242,184,75,.25)' }} />
      <div
        role="dialog"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: calloutLeft,
          top: below ? y + h + 12 : undefined,
          bottom: below ? undefined : vh - y + 12,
          width: calloutW,
          zIndex: 62,
          background: 'var(--bg)',
          border: '1px solid var(--alert)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        <span>
          <Rich s={t('coach.' + step.id)} />
        </span>
        <button className="cmd mini" style={{ alignSelf: 'flex-end' }} onClick={() => store.dispatch({ t: 'dismissTip', id: 'coach.' + step.id })}>
          {t('ui.gotIt')}
        </button>
      </div>
    </>
  );
}
