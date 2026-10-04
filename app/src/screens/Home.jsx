import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import Icon from '../Icons.jsx'
import EntryDock from '../EntryDock.jsx'
import { todayStr } from '../api.js'

export const inr = n => (n < 0 ? '−₹' : '₹') + Math.abs(Math.round(n || 0)).toLocaleString('en-IN')
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function weekOf(days) {
  const by = Object.fromEntries((days || []).map(d => [d.date, d]))
  const at = off => { const dt = new Date(); dt.setDate(dt.getDate() + off); return iso(dt) }
  const cur = Array.from({ length: 7 }, (_, i) => { const date = at(i - 6); return { date, row: by[date] || null } })
  const prev = Array.from({ length: 7 }, (_, i) => by[at(i - 13)] || null)
  const total = rows => rows.reduce((a, r) => a + Number(r?.est_profit || 0), 0)
  return { cur, tw: total(cur.map(c => c.row)), pw: total(prev) }
}
function streakOf(cur) {
  let n = 0, i = cur.length - 1
  if (!cur[i].row) i--
  for (; i >= 0 && cur[i].row; i--) n++
  return n
}

export default function Home({ home, goTab, openReport }) {
  const { t } = useI18n()
  const [prefill, setPrefill] = useState(null)
  const d = home.data
  const s = d?.summary
  const logged = !!(s && (s.sales || s.purchases || s.expenses))
  const hour = new Date().getHours()
  const greet = hour < 12 ? t('greetMorning') : hour < 17 ? t('greetAfternoon') : t('greetEvening')
  const { cur, tw, pw } = weekOf(d?.days)
  const streak = streakOf(cur)
  const maxAbs = Math.max(1, ...cur.map(w => Math.abs(w.row?.est_profit || 0)))
  const delta = pw !== 0 ? Math.round((tw - pw) / Math.abs(pw) * 100) : null
  const owed = d?.udhaar || []
  const owedTotal = owed.reduce((a, p) => a + Number(p.balance_inr), 0)
  const oldest = [...owed].sort((a, b) => (b.days_since ?? 0) - (a.days_since ?? 0))[0]
  const today = todayStr()
  const tiles = [['sale', 'sales', s?.sales], ['purchase', 'bought', s?.purchases], ['expense', 'expenses', s?.expenses]]

  return (
    <main className="screen">
      <div className="greet"><h1>{greet}</h1><span className="muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>

      {/* Today: skeleton until we know, so the empty state never flashes */}
      <section className="card status">
        {home.loading ? (
          <><div className="skel line sm" /><div className="skel line xl" /><div className="skel line" /></>
        ) : home.error && !d ? (
          <div className="alert">{t('loadError')} <button className="text-btn" onClick={home.refresh}>{t('retry')}</button></div>
        ) : logged ? (
          <>
            <div className="stack" data-tour="today">
              <div className="row"><span className="muted">{t('profitToday')}</span><span className="tag">{t('estimated')}</span></div>
              <div className={`big ${s.est_profit >= 0 ? 'good' : 'bad'}`}><Icon name={s.est_profit >= 0 ? 'up' : 'down'} size={30} />{inr(s.est_profit)}</div>
            </div>
            <div className="tiles">
              {tiles.map(([type, label, val]) => (
                <button key={type} className="tile" onClick={() => openReport({ date: today, type })} aria-label={`${t(label)} ${inr(val)}. ${t('viewEntries')}`}>
                  <span className="tile-top">{t(label)}<Icon name="chevron" size={16} /></span><b>{inr(val)}</b>
                </button>
              ))}
            </div>
            {s.credit_sales > 0 && <div className="credit-note"><Icon name="people" size={16} />{t('creditNote', { a: Math.round(s.credit_sales).toLocaleString('en-IN') })}</div>}
            <div className="muted hint-edit">{t('viewEntries')} ›</div>
          </>
        ) : (
          <>
            <div className="stack" data-tour="today"><h2>{t('startTitle')}</h2><p className="muted">{t('startSub')}</p></div>
            <ol className="steps"><li><i>1</i>{t('step1')}</li><li><i>2</i>{t('step2')}</li><li><i>3</i>{t('step3')}</li></ol>
            <div className="try">
              <span className="label">{t('tryTitle')}</span>
              {[t('ex1'), t('ex2')].map(x => <button key={x} className="try-row" onClick={() => setPrefill({ text: x, n: Date.now() })}><Icon name="spark" size={16} />{x}</button>)}
            </div>
          </>
        )}
      </section>

      <button className="card row-card reports-cta" data-tour="reports" onClick={() => openReport({ range: 'day', date: today })}>
        <span className="ins-ico"><Icon name="chart" /></span>
        <span className="grow-text"><b>{t('reportsCta')}</b><span className="muted">{t('reportsCtaSub')}</span></span>
        <Icon name="chevron" />
      </button>

      {!home.loading && owed.length > 0 && (
        <button className="card row-card" onClick={() => goTab('udhaar')}>
          <span className="ins-ico warn"><Icon name="people" /></span>
          <span className="grow-text"><b>{t('pendingUdhaar')} · {inr(owedTotal)}</b>
            <span className="muted">{t('peopleOwe', { n: owed.length })}{oldest?.days_since >= 14 ? ` · ${t('lateBy', { a: oldest.customer, n: oldest.days_since })}` : ''}</span></span>
          <Icon name="chevron" />
        </button>
      )}

      {!home.loading && d && cur.some(w => w.row) && (
        <button className="card week-card" data-tour="week" onClick={() => openReport({ range: 'week' })}>
          <div className="row"><span className="muted">{t('thisWeek')}</span>
            <span className="row gap">{streak > 1 && <span className="tag soft"><Icon name="bolt" size={14} />{t('streak', { n: streak })}</span>}<Icon name="chevron" size={18} /></span></div>
          <div className="row end"><b className={`wk ${tw >= 0 ? 'up-text' : 'down-text'}`}>{inr(tw)}</b>
            {delta !== null && <span className={`tag ${delta >= 0 ? 'good' : 'bad'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% {t('vsLast')}</span>}</div>
          <div className="week">
            {cur.map(w => (
              <div key={w.date} className="day">
                <div className="bar-slot">{w.row ? <i className={w.row.est_profit >= 0 ? 'up' : 'down'} style={{ height: `${Math.max(8, Math.abs(w.row.est_profit) / maxAbs * 100)}%` }} /> : <i className="none" />}</div>
                <span>{new Date(w.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
        </button>
      )}

      <EntryDock home={home} placeholder={logged ? t('addAnother') : t('composerPlaceholder')} prefill={prefill} />
    </main>
  )
}
