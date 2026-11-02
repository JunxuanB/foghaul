import { useRef, useState } from 'react';
import { t, LANGS } from '../../i18n';
import { deserialize, serialize } from '../../sim/save';
import { useGame, useStore } from '../../store/hooks';
import { useUi } from '../ui';
import { Dialog } from './Dialog';

export function SettingsDialog() {
  const g = useGame();
  const store = useStore();
  const ui = useUi();
  const [confirmNew, setConfirmNew] = useState(false);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const exportSave = () => {
    const blob = new Blob([serialize(g)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `foghaul-day${Math.floor(g.time / 1440) + 1}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importSave = async (f: File) => {
    const s = deserialize(await f.text());
    if (!s) return setMsg(t('ui.importBad'));
    store.replace(s);
    setMsg(t('ui.importOk'));
  };
  return (
    <Dialog kind="settings" tabs={false}>
      <div className="grid2" style={{ fontSize: 15 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 className="h3">{t('ui.language')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {LANGS.map((l) => (
              <button key={l} className={'cmd' + (ui.lang === l ? ' lead' : '')} onClick={() => ui.setLang(l)} aria-pressed={ui.lang === l}>
                {l === 'zh' ? '中文' : 'English'}
              </button>
            ))}
          </div>
          <h3 className="h3">{t('ui.theme')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={'cmd' + (ui.theme === 'dark' ? ' lead' : '')} onClick={() => ui.setTheme('dark')}>{t('ui.dark')}</button>
            <button className={'cmd' + (ui.theme === 'light' ? ' lead' : '')} onClick={() => ui.setTheme('light')}>{t('ui.light')}</button>
          </div>
          <h3 className="h3">{t('ui.controls')}</h3>
          <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>{t('ui.controlsText')}</p>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 className="h3">{t('ui.save')}</h3>
          <p className="small" style={{ margin: 0 }}>{t('ui.saveNote')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="cmd" onClick={() => { store.save(); setMsg(t('ui.saved')); }}>{t('ui.saveNow')}</button>
            <button className="cmd" onClick={exportSave}>{t('ui.exportSave')}</button>
            <button className="cmd" onClick={() => file.current?.click()}>{t('ui.importSave')}</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importSave(e.target.files[0])} />
          </div>
          {!confirmNew ? (
            <button className="cmd" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmNew(true)}>{t('ui.newGame')}</button>
          ) : (
            <div className="box box-stop" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>{t('ui.newGameConfirm')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="cmd lead" onClick={() => { store.newGame(); setConfirmNew(false); ui.close(); }}>{t('ui.newGameYes')}</button>
                <button className="cmd" onClick={() => setConfirmNew(false)}>{t('ui.cancel')}</button>
              </div>
            </div>
          )}
          {msg && <p className="tone-al" style={{ margin: 0 }}>{msg}</p>}
          <p className="small" style={{ margin: 0 }}>{t('ui.seed', { seed: g.seed })}</p>
        </section>
      </div>
    </Dialog>
  );
}
