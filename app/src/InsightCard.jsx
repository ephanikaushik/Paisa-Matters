import { useI18n } from './i18n.jsx'
import { describeInsight } from './insightText.js'
import Icon from './Icons.jsx'

// One insight in plain words: what happened, how much it costs, and a single big action.
export default function InsightCard({ insight, index, onDone }) {
  const { t, lang } = useI18n()
  const d = describeInsight(insight, t)
  const speak = () => {
    const u = new SpeechSynthesisUtterance(`${d.title}. ${d.body} ${d.money}`)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; speechSynthesis.cancel(); speechSynthesis.speak(u)
  }
  return (
    <article className={`jcard tone-${d.tone}`}>
      <div className="jhead">
        <span className="jicon"><Icon name={d.icon} size={26} />{index != null && <i className="jnum">{index}</i>}</span>
        <h3>{d.title}</h3>
      </div>
      <p className="jbody">{d.body}</p>
      {d.money && <p className="jmoney">{d.money}</p>}
      <div className="jactions">
        {d.action && <a className="jbtn" href={d.action.href} target="_blank" rel="noreferrer">{d.action.label}</a>}
        <button className="jlisten" onClick={speak} aria-label={t('listen')}><Icon name="sound" size={20} />{!d.action && t('listen')}</button>
      </div>
      {onDone && <button className="text-btn" onClick={onDone}>{t('markDone')}</button>}
    </article>
  )
}
