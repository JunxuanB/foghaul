import { useState } from 'react';
import { t } from '../../i18n';
import { Rich } from '../components/Text';

const STORY = 5;
const QUICK = 4;

/** 新游戏开场：背景故事逐段出现，最后是简短的玩法说明 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(1);
  const storyDone = shown >= STORY;
  const [page, setPage] = useState<'story' | 'quick'>('story');
  return (
    <div className="screen">
      <div className="screen-in">
        {page === 'story' ? (
          <>
            <p className="small" style={{ margin: 0, letterSpacing: '0.2em' }}>{t('intro.label')}</p>
            <div className="story" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: shown }, (_, i) => (
                <p key={i} style={{ color: i === shown - 1 ? 'var(--ink)' : 'var(--soft)' }}>
                  <Rich s={t('intro.' + i)} />
                </p>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="cmd" onClick={() => setPage('quick')}>{t('intro.skip')}</button>
              <button className="cmd lead" autoFocus onClick={() => (storyDone ? setPage('quick') : setShown(shown + 1))}>
                {t('ui.cut.next')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 22 }}>{t('intro.quickTitle')}</h2>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 16, lineHeight: 1.7 }}>
              {Array.from({ length: QUICK }, (_, i) => (
                <li key={i}><Rich s={t('intro.quick.' + i)} /></li>
              ))}
            </ul>
            <p className="small" style={{ margin: 0 }}>{t('intro.helpLater')}</p>
            <button className="cmd lead" style={{ alignSelf: 'flex-end' }} autoFocus onClick={onDone}>
              {t('intro.start')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
