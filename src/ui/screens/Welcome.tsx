import { useEffect, useRef, useState } from 'react';
import { LANGS, t } from '../../i18n';
import { useUi } from '../ui';
import { paintCover } from './cover';

/** 欢迎页：选择语言，继续或开始新的旅程 */
export function Welcome({ canContinue, onContinue, onNew }: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
  const ui = useUi();
  const [confirm, setConfirm] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (cv.current) paintCover(cv.current);
  }, []);
  return (
    <div className="screen">
      <div className="screen-in">
        <canvas ref={cv} className="cover" width={240} height={90} aria-hidden="true" />
        <div>
          <h1>{t('ui.title')}</h1>
          <p style={{ marginTop: 10 }}>{t('welcome.tagline')}</p>
        </div>
        <div className="row">
          <span className="small">{t('ui.language')}</span>
          {LANGS.map((l) => (
            <button key={l} className={'u-btn' + (ui.lang === l ? '' : ' sec')} aria-pressed={ui.lang === l} onClick={() => ui.setLang(l)}>
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
        <div className="row">
          {canContinue && (
            <button className="u-btn" autoFocus onClick={onContinue}>
              {t('welcome.continue')}
            </button>
          )}
          {!confirm ? (
            <button className={'u-btn' + (canContinue ? ' sec' : '')} autoFocus={!canContinue} onClick={() => (canContinue ? setConfirm(true) : onNew())}>
              {t('welcome.new')}
            </button>
          ) : (
            <span className="row">
              <span>{t('ui.newGameConfirm')}</span>
              <button className="u-btn" onClick={onNew}>
                {t('ui.newGameYes')}
              </button>
              <button className="u-btn sec" onClick={() => setConfirm(false)}>
                {t('ui.cancel')}
              </button>
            </span>
          )}
        </div>
        <p className="small">{t('welcome.note')}</p>
      </div>
    </div>
  );
}
