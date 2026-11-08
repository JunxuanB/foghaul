// 触屏操作（手机、平板）：左下一个虚拟摇杆，右下一个大的“互动”键（写着现在能做的事，比如“掰树枝”），
// 旁边是只在能用时出现的 X / Z / F 小键，上面一排背包、海图、菜单。按下去和按键盘一样（game/input/keys.ts 的 fire / setStick）。
import { useEffect, useRef, useState } from 'react';
import { fire, setStick, type Action } from '../../game/input/keys';
import { t } from '../../i18n';
import { useView, useViewStore } from '../../store/hooks';
import { label } from '../components/Kit';

/** 触屏设备，或地址里带 ?touch（调试用） */
export function isTouch(): boolean {
  try {
    return matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
  } catch {
    return false;
  }
}

function Stick() {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const id = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || id.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    const R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R;
    let dy = (e.clientY - (r.top + R)) / R;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    // 中间一小圈不动，免得手指一放上去人就溜走
    const dead = len < 0.2;
    setStick(dead ? 0 : dx, dead ? 0 : dy);
    setKnob([dx, dy]);
  };
  const end = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return;
    id.current = null;
    setStick(0, 0);
    setKnob([0, 0]);
  };
  useEffect(() => () => setStick(0, 0), []);
  return (
    <div
      ref={ref}
      className="t-stick"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <i style={{ ['--x' as string]: knob[0], ['--y' as string]: knob[1] }} />
    </div>
  );
}

function Btn({ a, text, big, dim }: { a: Action; text: string; big?: boolean; dim?: boolean }) {
  return (
    <button
      type="button"
      className={'t-btn' + (big ? ' big' : '') + (dim ? ' dim' : '')}
      onPointerDown={(e) => {
        e.preventDefault();
        fire(a);
      }}
    >
      {text}
    </button>
  );
}

const KEY_ACTION: Record<string, Action> = { X: 'fish', Z: 'drink', F: 'grab' };

export function TouchControls() {
  const v = useView();
  const vs = useViewStore();
  if (!isTouch()) return null;
  const e = v.prompts.find((p) => p.key === 'E');
  const extra = v.prompts.filter((p) => KEY_ACTION[p.key] && p.ok);
  const open = !!v.panel;
  return (
    <div className="touch">
      {!open && <Stick />}
      <div className="t-right">
        <div className="t-row">
          <Btn a="inventory" text={t('ui.pack')} />
          <Btn a="map" text={t('ui.seaChart')} />
          <button type="button" className="t-btn" onPointerDown={(ev) => (ev.preventDefault(), open ? vs.set({ panel: null }) : fire('close'))}>
            {open ? t('ui.close') : t('ui.menu')}
          </button>
        </div>
        {!open && (
          <div className="t-row">
            {extra.map((p) => (
              <Btn key={p.key} a={KEY_ACTION[p.key]} text={label(p.label)} />
            ))}
            <Btn a="use" text="Q" />
            <Btn a="interact" big dim={!e?.ok} text={e ? label(e.label) : 'E'} />
          </div>
        )}
      </div>
    </div>
  );
}
