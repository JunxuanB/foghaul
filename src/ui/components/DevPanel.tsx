import { useEffect, useState } from 'react';
import { ITEM_ORDER, type ItemId } from '../../config/items';
import { t } from '../../i18n';
import { look } from '../../sim/map';
import { giveToPlayer } from '../../sim/inventory';
import { applyPreset, PRESETS } from '../../sim/presets';
import { useGame, useStore } from '../../store/hooks';

/** 调试面板：只在开发模式或 ?debug 时出现，按 ` 键开关 */
export function DevPanel() {
  const g = useGame();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<ItemId>('wood');
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '`') setOpen((o) => !o);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const mut = (f: () => void) => {
    f();
    store.bump();
  };
  if (!open)
    return (
      <button className="cmd mini" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 40, background: 'var(--bg)' }} onClick={() => setOpen(true)}>
        DEV
      </button>
    );
  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 40, width: 340, maxHeight: '80vh', overflow: 'auto', background: 'var(--bg)', border: '1px solid var(--alert)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>DEV</strong>
        <button className="cmd mini" onClick={() => setOpen(false)}>×</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        <span>speed</span>
        {[1, 5, 20, 100].map((s) => (
          <button key={s} className={'cmd mini' + (store.speed === s ? ' lead' : '')} onClick={() => mut(() => (store.speed = s))}>×{s}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <button className="cmd mini" onClick={() => mut(() => Object.assign(g.player, { hp: 100, water: 100, food: 100 }))}>heal</button>
        <button className="cmd mini" onClick={() => mut(() => g.islands.forEach((i) => { if (i.kind !== 'bureau') i.buildings.lighthouse = true; }))}>light all</button>
        <button className="cmd mini" onClick={() => mut(() => g.islands.forEach((i) => { if (i.kind !== 'bureau' || g.flags.flightDone) i.discovered = true; }))}>reveal isles</button>
        <button className="cmd mini" onClick={() => mut(() => { g.seen.fill(1); })}>reveal map</button>
        <button className="cmd mini" onClick={() => mut(() => { g.player.hasRaft = true; })}>raft</button>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <select className="sel" value={item} onChange={(e) => setItem(e.target.value as ItemId)}>
          {ITEM_ORDER.map((id) => <option key={id} value={id}>{t('item.' + id)}</option>)}
        </select>
        {[1, 10].map((n) => (
          <button key={n} className="cmd mini" onClick={() => mut(() => giveToPlayer(g, item, n))}>+{n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ width: '100%' }}>teleport</span>
        {g.islands.filter((i) => i.discovered).map((i) => (
          <button key={i.id} className="cmd mini" onClick={() => mut(() => { g.player.x = i.x; g.player.y = i.y; g.player.at = i.id; i.visited = true; look(g); })}>
            {t('island.' + i.id)}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ width: '100%' }}>presets (new game)</span>
        {PRESETS.map((p) => (
          <button key={p.id} className="cmd mini" onClick={() => store.replace(applyPreset(p.id, g.seed))}>{p.id}</button>
        ))}
      </div>
      <button className="cmd mini" onClick={() => store.newGame()}>reset save</button>
    </div>
  );
}
