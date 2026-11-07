// 调试面板（开发服务器或 ?debug）：拖时间看换色、时间倍率、补木头。
import { useState } from 'react';
import { useGame, useStore, useView, useViewStore } from '../store/hooks';
import { minuteOfDay } from '../sim/clock';
import { stockAdd } from '../sim/util';

export function DevPanel() {
  const g = useGame();
  const store = useStore();
  const v = useView();
  const vs = useViewStore();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="dev">
        <button onClick={() => setOpen(true)}>dev</button>
      </div>
    );
  const min = v.debugMinute ?? Math.floor(minuteOfDay(g.time));
  const hh = String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  return (
    <div className="dev">
      <label>
        look {hh}{' '}
        <input type="range" min={0} max={1439} value={min} onChange={(e) => vs.set({ debugMinute: Number(e.target.value) })} />
      </label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={() => vs.set({ debugMinute: null })}>real time</button>
        {[1, 10, 60].map((n) => (
          <button key={n} onClick={() => (store.speed = n)}>
            ×{n}
          </button>
        ))}
        <button
          onClick={() => {
            stockAdd(store.state.player.pack, 'wood', 4);
            store.bump();
          }}
        >
          +4 wood
        </button>
        <button onClick={() => setOpen(false)}>hide</button>
      </div>
    </div>
  );
}
