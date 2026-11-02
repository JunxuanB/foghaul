import { t } from '../../i18n';
import { Rich } from '../components/Text';
import { Dialog } from './Dialog';

const SECTIONS = ['goal', 'time', 'map', 'bags', 'water', 'craft', 'islands', 'controls'];

/** 玩法说明 */
export function HelpDialog() {
  return (
    <Dialog kind="help" tabs={false}>
      <div className="grid2" style={{ fontSize: 15 }}>
        {SECTIONS.map((s) => (
          <section key={s}>
            <h3 className="h3">{t('help.' + s + '.title')}</h3>
            <p style={{ margin: 0, lineHeight: 1.8 }}>
              <Rich s={t('help.' + s + '.body')} />
            </p>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
