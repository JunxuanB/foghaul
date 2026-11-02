import { useState } from 'react';
import { LANGS, t } from '../../i18n';
import { useUi } from '../ui';

/** 欢迎页：选择语言，继续或开始新的旅程 */
export function Welcome({ canContinue, onContinue, onNew }: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
  const ui = useUi();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen">
      <div className="screen-in">
        <div>
          <h1>{t('ui.title')}</h1>
          <p style={{ margin: '10px 0 0', color: 'var(--soft)', fontSize: 16, lineHeight: 1.7 }}>{t('welcome.tagline')}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="small">{t('ui.language')}</span>
          {LANGS.map((l) => (
            <button key={l} className={'cmd mini' + (ui.lang === l ? ' lead' : '')} aria-pressed={ui.lang === l} onClick={() => ui.setLang(l)}>
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
          <span className="small" style={{ marginLeft: 12 }}>{t('ui.theme')}</span>
          <button className="cmd mini" onClick={() => ui.setTheme(ui.theme === 'dark' ? 'light' : 'dark')}>
            {ui.theme === 'dark' ? t('ui.light') : t('ui.dark')}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {canContinue && (
            <button className="cmd lead" autoFocus onClick={onContinue}>
              {t('welcome.continue')}
            </button>
          )}
          {!confirm ? (
            <button className={'cmd' + (canContinue ? '' : ' lead')} autoFocus={!canContinue} onClick={() => (canContinue ? setConfirm(true) : onNew())}>
              {t('welcome.new')}
            </button>
          ) : (
            <span className="box box-stop" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span>{t('ui.newGameConfirm')}</span>
              <button className="cmd mini lead" onClick={onNew}>{t('ui.newGameYes')}</button>
              <button className="cmd mini" onClick={() => setConfirm(false)}>{t('ui.cancel')}</button>
            </span>
          )}
        </div>
        <p className="small" style={{ margin: 0 }}>{t('welcome.note')}</p>
      </div>
    </div>
  );
}
