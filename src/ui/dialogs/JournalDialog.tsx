import { RECIPES, RECIPE_ORDER } from '../../config/recipes';
import { t, tm } from '../../i18n';
import { clockParts } from '../../sim/clock';
import { stockP } from '../../sim/msg';
import { objectives } from '../../sim/objectives';
import type { Stock } from '../../sim/types';
import { useGame } from '../../store/hooks';
import { M, Rich, T } from '../components/Text';
import { Dialog } from './Dialog';

export function JournalDialog() {
  const g = useGame();
  const objs = objectives(g);
  const cur = objs.findIndex((o) => !o.done);
  const log = g.log.slice(-120).reverse();
  return (
    <Dialog kind="journal">
      <div className="grid2" style={{ fontSize: 15 }}>
        <section>
          <h3 className="h3">{t('ui.goals')}</h3>
          <ol className="list">
            {objs.map((o, i) => (
              <li key={o.id} className="row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 2, padding: '8px 0' }}>
                <span className={o.done ? 'tone-ok' : i === cur ? 'tone-al' : ''} style={{ color: !o.done && i !== cur ? 'var(--dim)' : undefined }}>
                  {o.done ? '✓ ' : i === cur ? '▶ ' : '· '}
                  <M m={o.title} />
                </span>
                {i === cur && <span className="small"><M m={o.detail} /></span>}
              </li>
            ))}
          </ol>
          <h3 className="h3" style={{ marginTop: 20 }}>{t('ui.recipes')}</h3>
          <ul className="list">
            {RECIPE_ORDER.filter((r) => g.player.recipes.includes(r) || g.people.some((p) => p.recipes.includes(r))).map((r) => {
              const d = RECIPES[r];
              return (
                <li key={r} className="row">
                  <span className="nm">{t('recipe.' + r)}</span>
                  <span className="meta small">
                    <T k="ui.recipeIO" p={{ ins: stockP(d.inputs as Stock), outs: stockP(d.outputs as Stock) }} />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="small">{t('ui.clues', { n: g.clueIndex })}</p>
        </section>
        <section>
          <h3 className="h3">{t('ui.history')}</h3>
          <ol className="list" style={{ maxHeight: '60vh', overflow: 'auto' }}>
            {log.map((l, i) => {
              const c = clockParts(l.at);
              return (
                <li key={i} className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                  <span className="small" style={{ whiteSpace: 'nowrap' }}>{t('ui.clockShort', { day: c.day, hh: c.hh, mm: c.mm })}</span>
                  <span className={'nm ' + (l.c === 'bad' ? 'tone-b' : l.c === 'hint' ? 'tone-h' : l.c === 'warn' ? 'tone-w' : '')}>
                    <Rich s={tm(l.m)} />
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </Dialog>
  );
}
