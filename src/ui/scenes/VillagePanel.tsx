import { RECIPES } from '../../config/recipes';
import { VILLAGES, type VillageId } from '../../config/world';
import { t, tm } from '../../i18n';
import { isHungry, presentPeople } from '../../sim/people';
import { currentRequest, rewardMsgs } from '../../sim/villages';
import { useGame, useStore } from '../../store/hooks';
import { NeedList } from './NeedPanel';

export function VillagePanel({ vid }: { vid: VillageId }) {
  const g = useGame();
  const store = useStore();
  const def = VILLAGES[vid];
  const v = g.villages[vid];
  const req = currentRequest(g, vid);
  const present = presentPeople(g);
  const trusted = !def.trustRole || present.some((p) => p.role === def.trustRole);
  const disputeHere = g.flags.waterDispute === 'pending' && (vid === 'wheat' || vid === 'labor');
  const learners = g.people.filter((p) => p.learning?.village === vid);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 15 }}>
      <p style={{ margin: 0, color: 'var(--soft)' }}>
        {t('ui.favor', { n: v.favor, total: def.requests.length })}
        {def.trustRole && ' · ' + t('ui.trustOnly', { role: t('role.' + def.trustRole) })}
      </p>
      {disputeHere && (
        <div className="box box-alert" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span>{t('dispute.text')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="cmd lead" onClick={() => store.dispatch({ t: 'choose', option: 'wheat' })}>{t('dispute.wheat.label')}</button>
            <button className="cmd lead" onClick={() => store.dispatch({ t: 'choose', option: 'labor' })}>{t('dispute.labor.label')}</button>
          </div>
        </div>
      )}
      {req ? (
        <NeedList
          need={req.need}
          progress={v.progress}
          title={v.favor < def.requests.length ? t('ui.request', { n: v.favor + 1 }) : t('ui.repeatRequest')}
          reward={t('ui.reward', { r: rewardMsgs(req.reward).map(tm).join(t('ui.sep')) })}
          blocked={trusted ? undefined : t('err.trustRole', { village: t('village.' + vid), role: t('role.' + def.trustRole) })}
        />
      ) : (
        <p className="empty">{t('ui.villageAllDone')}</p>
      )}
      {(v.pendingRecipes.length > 0 || learners.length > 0) && (
        <section>
          <h3 className="h3">{t('ui.teach')}</h3>
          <ul className="list">
            {learners.map((p) => (
              <li key={p.id} className="row">
                <span className="nm">{tm(p.name)}</span>
                <span className="meta">
                  {t('ui.learningUntil', { recipe: t('recipe.' + p.learning!.recipe), m: Math.max(0, Math.ceil(p.learning!.until - g.time)) })}
                </span>
              </li>
            ))}
            {v.pendingRecipes.map((r) => {
              const role = RECIPES[r].role!;
              const student = present.find((p) => p.role === role && !p.learning);
              const hungry = student ? isHungry(g, student) : false;
              return (
                <li key={r} className="row">
                  <span className="nm">{t('recipe.' + r)}</span>
                  <span className="meta">{t('ui.forRole', { role: t('role.' + role) })}</span>
                  <span className="acts">
                    <button className="cmd mini lead" disabled={!student || hungry} onClick={() => student && store.dispatch({ t: 'learn', personId: student.id, recipe: r })}>
                      {student ? t('ui.learn') : t('ui.bringRole', { role: t('role.' + role) })}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
