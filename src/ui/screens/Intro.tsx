import { useState } from 'react';
import { t } from '../../i18n';
import { Rich } from '../components/Text';

const STORY = 5;
const QUICK = 4;

/** 新游戏开场：背景故事逐段出现（可跳过），最后是简短的操作说明 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(1);
  const [page, setPage] = useState<'story' | 'quick'>('story');
  return (
    <div className="screen">
      <div className="screen-in fixed">
        {page === 'story' ? (
          <>
            <p className="small" style={{ letterSpacing: '0.2em' }}>{t('intro.label')}</p>
            <div className="story">
              {Array.from({ length: shown }, (_, i) => (
                <p key={i} className={i === shown - 1 ? 'cur' : ''}>
                  <Rich s={t('intro.' + i)} />
                </p>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="u-btn sec" onClick={() => setPage('quick')}>
                {t('intro.skip')}
              </button>
              <button className="u-btn" autoFocus onClick={() => (shown >= STORY ? setPage('quick') : setShown(shown + 1))}>
                {t('ui.cut.next')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t('intro.quickTitle')}</h2>
            <ul style={{ flex: '1 1 auto', overflowY: 'auto' }}>
              {Array.from({ length: QUICK }, (_, i) => (
                <li key={i}>
                  <Rich s={t('intro2d.quick.' + i)} />
                </li>
              ))}
            </ul>
            <p className="small">{t('intro.helpLater')}</p>
            <button className="u-btn" style={{ alignSelf: 'flex-end' }} autoFocus onClick={onDone}>
              {t('intro.start')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
