import { useEffect } from 'react'
import { useI18n } from '../i18n.jsx'
import { getPref } from '../prefs.js'
import { buildCoach } from '../insightText.js'
import Icon from '../Icons.jsx'
import { inr } from './Home.jsx'

export default function ProfitCard({ summary: s, draft, alerts, owed, onBack }) {
  const { t, lang } = useI18n()
  const good = s.est_profit >= 0
  const coach = buildCoach(s, alerts, owed, t)
  useEffect(() => { if (getPref('readaloud') === '1' && (s.sales || s.purchases || s.expenses)) speak() }, [])
  function speak() {
    const u = new SpeechSynthesisUtterance(`${t('profitToday')} ${Math.abs(Math.round(s.est_profit))}. ${coach.well} ${coach.leaked} ${coach.tomorrow}`)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; speechSynthesis.cancel(); speechSynthesis.speak(u)
  }
  if (!(s.sales || s.purchases || s.expenses)) {
    const rows = [...(draft?.udhaar_given || []).map(u => [t('typeGiven'), u]), ...(draft?.udhaar_received || []).map(u => [t('typeGot'), u])]
    return (
      <div className="scrim"><div className="sheet" role="dialog" aria-label={t('savedTitle')}>
        <div className="sheet-head"><h2>{t('savedTitle')}</h2></div>
        <div className="sheet-body"><span className="muted">{t('savedSub')}</span>
          {rows.map(([label, u], i) => <div key={i} className="kv"><span>{label} · {u.customer}</span><b>{inr(u.amount_inr)}</b></div>)}</div>
        <div className="sheet-foot"><button className="primary grow" onClick={onBack}>{t('done')}</button></div>
      </div></div>
    )
  }
  return (
    <div className="scrim">
      <div className="sheet tall" role="dialog" aria-label={t('resultTitle')}>
        <div className="sheet-head"><h2>{t('resultTitle')}</h2></div>
        <div className="sheet-body">
          <div className={`result ${good ? 'good' : 'bad'}`}>
            <div className="muted">{t('profitToday')} · {t('estimated')}</div>
            <div className="result-num"><Icon name={good ? 'up' : 'down'} size={40} />{inr(s.est_profit)}</div>
            <div className="muted">{t('salesMinus')}</div>
            <div className="tiles light"><div><span>{t('sales')}</span><b>{inr(s.sales)}</b></div><div><span>{t('bought')}</span><b>{inr(s.purchases)}</b></div><div><span>{t('expenses')}</span><b>{inr(s.expenses)}</b></div></div>
          </div>
          {s.credit_sales > 0 && <div className="udhaar-line"><Icon name="people" size={18} />{t('creditNote', { a: Math.round(s.credit_sales).toLocaleString('en-IN') })}</div>}
          {s.udhaar_net > 0 && <div className="udhaar-line"><Icon name="people" size={18} />{t('udhaarPending')}<b>{inr(s.udhaar_net)}</b></div>}
          <div className="card coach">
            <div className="coach-row ok"><Icon name="check" size={18} /><div><span className="label">{t('wentWell')}</span>{coach.well}</div></div>
            <div className="coach-row leak"><Icon name="warn" size={18} /><div><span className="label">{t('leaked')}</span>{coach.leaked}</div></div>
            <div className="coach-row todo"><Icon name="bolt" size={18} /><div><span className="label">{t('tomorrow')}</span>{coach.tomorrow}</div></div>
          </div>
        </div>
        <div className="sheet-foot"><button onClick={speak}><Icon name="sound" size={18} />{t('readOut')}</button><button className="primary grow" onClick={onBack}>{t('done')}</button></div>
      </div>
    </div>
  )
}
