import { useI18n } from '../i18n.jsx'
import { insightKey } from '../insightText.js'
import InsightCard from '../InsightCard.jsx'
import Icon from '../Icons.jsx'
import { inr } from './Home.jsx'

export default function Insights({ home, list, hiddenCount, onHide, onRestore }) {
  const { t } = useI18n()
  if (home.loading) return <main className="screen"><div className="skel h1" /><div className="skel card-h" /></main>
  if (!home.data) return <main className="screen"><div className="alert">{t('loadError')} <button className="text-btn" onClick={home.refresh}>{t('retry')}</button></div></main>
  const savings = list.filter(i => i.type !== 'udhaar_risk').reduce((a, i) => a + Number(i.impact_inr || 0), 0)
  return (
    <main className="screen">
      <div className="greet"><h1>{t('insights')}</h1></div>
      {list.length > 0 ? (
        <>
          <section className="card hero-save">
            <span className="hs-ico"><Icon name="coin" size={28} /></span>
            <div><b className="hs-text">{savings > 0 ? t('saveHero', { a: inr(savings).replace('₹', '') }) : t('jobsTitle')}</b><span className="muted">{t('saveHeroSub')}</span></div>
          </section>
          <div className="label">{t('jobsTitle')}</div>
          {list.map((i, n) => <InsightCard key={insightKey(i)} insight={i} index={n + 1} onDone={() => onHide(insightKey(i))} />)}
        </>
      ) : (
        <div className="empty"><Icon name={hiddenCount ? 'check' : 'bulb'} size={32} /><b>{hiddenCount ? t('allDone') : t('noJobsTitle')}</b>{!hiddenCount && <span className="muted">{t('insightsEmptySub')}</span>}</div>
      )}
      {hiddenCount > 0 && <button className="text-btn" onClick={onRestore}>{t('restore')} ({hiddenCount})</button>}
    </main>
  )
}
