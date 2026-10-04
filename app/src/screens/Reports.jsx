import { useEffect, useMemo, useState } from 'react'
import { getTransactions, updateTxn, deleteTxn, todayStr } from '../api.js'
import { useI18n } from '../i18n.jsx'
import Icon from '../Icons.jsx'
import { inr } from './Home.jsx'

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const dayLabel = (dateStr, opts) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', opts)
const sum = (rows, pred) => rows.filter(pred).reduce((a, r) => a + Number(r.amount_inr), 0)
const FILTERS = [['all', 'fAll'], ['sale', 'sales'], ['purchase', 'bought'], ['expense', 'expenses']]
const TYPE_ICON = { sale: 'coin', purchase: 'cart', expense: 'bolt' }
const TYPE_KEY = { sale: 'typeSale', purchase: 'typePurchase', expense: 'typeExpense' }

function totals(rows) {
  const sales = sum(rows, r => r.type === 'sale'), purchases = sum(rows, r => r.type === 'purchase'), expenses = sum(rows, r => r.type === 'expense')
  return { sales, purchases, expenses, profit: sales - purchases - expenses, count: rows.length }
}

function EditSheet({ row, title, onClose, onDone }) {
  const { t } = useI18n()
  const [amount, setAmount] = useState(String(Math.round(row.amount_inr)))
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async (fn, msg) => { setBusy(true); setErr(''); try { await fn(); onDone(msg) } catch { setErr(t('offline')); setBusy(false) } }
  const amt = Number(amount)
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('editEntry')}>
        <div className="sheet-head"><div><h2>{t('editEntry')}</h2><div className="muted">{title}</div></div><button className="icon-btn" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button></div>
        <div className="sheet-body">
          <label className="label" htmlFor="ea">{t('payAmount')}</label>
          <input id="ea" className="input big-input" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
          {confirmDel && <div className="alert">{t('deleteSure')}</div>}
          {err && <div className="alert">{err}</div>}
        </div>
        <div className="sheet-foot">
          {confirmDel
            ? <><button onClick={() => setConfirmDel(false)} disabled={busy}>{t('close')}</button><button className="danger grow" disabled={busy} onClick={() => run(() => deleteTxn(row.id), t('entryDeleted'))}>{t('deleteYes')}</button></>
            : <><button className="danger" disabled={busy} onClick={() => setConfirmDel(true)}>{t('deleteEntry')}</button>
                <button className="primary grow" disabled={busy || !(amt > 0) || amt === Number(row.amount_inr)} onClick={() => run(() => updateTxn(row.id, amt), t('entryUpdated'))}>{t('saveChanges')}</button></>}
        </div>
      </div>
    </div>
  )
}

export default function Reports({ initial, onClose, onChanged }) {
  const { t } = useI18n()
  const today = todayStr()
  const [range, setRange] = useState(initial.range || 'day')
  const [date, setDate] = useState(initial.date || today)
  const [filter, setFilter] = useState(TYPE_ICON[initial.type] ? initial.type : 'all')
  const [items, setItems] = useState(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')

  const load = () => getTransactions(addDays(today, -13), today).then(r => setItems((r.items || []).filter(x => TYPE_ICON[x.type]))).catch(() => setError(true))
  useEffect(() => { load() }, [today])
  const changed = msg => { setEditing(null); setToast(msg); load(); onChanged?.(); setTimeout(() => setToast(''), 3000) }

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today])
  const data = useMemo(() => {
    if (!items) return null
    const byDate = d => items.filter(r => r.date === d)
    const thisWeek = items.filter(r => r.date >= week[0]), prevWeek = items.filter(r => r.date < week[0])
    const days = week.map(d => ({ date: d, ...totals(byDate(d)) }))
    const logged = days.filter(d => d.count > 0)
    const best = logged.length ? logged.reduce((a, b) => (b.profit > a.profit ? b : a)) : null
    const spend = {}
    thisWeek.filter(r => r.type === 'purchase').forEach(r => { const k = (r.note || '?').toLowerCase(); spend[k] = (spend[k] || 0) + Number(r.amount_inr) })
    const top = Object.entries(spend).sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { byDate, days, logged, best, top, tw: totals(thisWeek), pw: totals(prevWeek) }
  }, [items, week])

  const rowTitle = r => r.type === 'purchase' ? `${(r.note || '').replace(/^./, c => c.toUpperCase())}` : r.type === 'sale' ? (r.customer ? `${t('typeSale')} · ${r.customer}` : t('typeSale')) : r.type === 'expense' ? (r.note || t('typeExpense')).replace(/^./, c => c.toUpperCase()) : r.note
  const rowSub = r => {
    const bits = [t(TYPE_KEY[r.type])]
    if (r.type === 'sale' && r.on_credit) bits.push(t('onCredit'))
    if (r.type === 'purchase' && r.qty) bits.push(`${r.qty} ${r.unit || ''}${r.unit_price_inr ? ` @ ₹${Math.round(r.unit_price_inr * 100) / 100}` : ''}`.trim())
    if (r.supplier) bits.push(r.supplier)
    bits.push(new Date(r.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))
    return bits.join(' · ')
  }
  const toggle = type => setFilter(f => (f === type ? 'all' : type))
  const matches = r => filter === 'all' || r.type === filter
  const dayRows = data ? data.byDate(date).filter(matches) : []
  const dayT = data ? totals(data.byDate(date)) : null
  const maxAbs = data ? Math.max(1, ...data.days.map(d => Math.abs(d.profit))) : 1
  const delta = data && data.pw.profit !== 0 ? Math.round((data.tw.profit - data.pw.profit) / Math.abs(data.pw.profit) * 100) : null

  return (
    <div className="page" role="dialog" aria-label={t('reports')}>
      <header className="page-bar">
        <button className="icon-btn" onClick={onClose} aria-label={t('back')}><Icon name="back" /></button>
        <h2>{t('reports')}</h2>
        <div className="seg compact">
          {[['day', 'repDay'], ['week', 'repWeek']].map(([id, k]) => <button key={id} className={range === id ? 'on' : ''} onClick={() => setRange(id)}>{t(k)}</button>)}
        </div>
      </header>

      <div className="page-body">
        {error && <div className="alert">{t('retryLoad')} <button className="text-btn" onClick={() => { setError(false); load() }}>{t('retry')}</button></div>}
        {!data && !error && <><div className="skel card-h" /><div className="skel card-h" /></>}

        {data && (
          <div className="datestrip">
            {week.map(d => (
              <button key={d} className={`dchip ${range === 'day' && date === d ? 'on' : ''}`} onClick={() => { setDate(d); setRange('day') }}>
                <span>{dayLabel(d, { weekday: 'short' })}</span><b>{dayLabel(d, { day: 'numeric' })}</b>
                <i className={data.byDate(d).length ? 'has' : ''} />
              </button>
            ))}
          </div>
        )}

        {data && range === 'day' && (
          <>
            <section className="card status">
              <div className="row"><span className="muted">{dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="tag">{t('estimated')}</span></div>
              <div className={`big ${dayT.profit >= 0 ? 'good' : 'bad'}`}>{inr(dayT.profit)}</div>
              <div className="tiles">
                <button className={`tile ${filter === 'sale' ? 'sel' : ''}`} aria-pressed={filter === 'sale'} onClick={() => toggle('sale')}><span className="tile-top">{t('sales')}</span><b>{inr(dayT.sales)}</b></button>
                <button className={`tile ${filter === 'purchase' ? 'sel' : ''}`} aria-pressed={filter === 'purchase'} onClick={() => toggle('purchase')}><span className="tile-top">{t('bought')}</span><b>{inr(dayT.purchases)}</b></button>
                <button className={`tile ${filter === 'expense' ? 'sel' : ''}`} aria-pressed={filter === 'expense'} onClick={() => toggle('expense')}><span className="tile-top">{t('expenses')}</span><b>{inr(dayT.expenses)}</b></button>
              </div>
            </section>
            {filter !== 'all' && <div className="row"><span className="muted">{t('showing')}: <b>{t(FILTERS.find(f => f[0] === filter)[1])}</b></span><button className="text-btn" onClick={() => setFilter('all')}>{t('clearFilter')}</button></div>}
            {dayRows.length > 0 && <div className="muted hint-edit">{t('tapToEdit')}</div>}
            {dayRows.length === 0 ? <div className="empty"><Icon name="bulb" size={28} /><span className="muted">{t('noTxn')}</span></div> : (
              <section className="card list">
                {dayRows.map(r => (
                  <button className="txn" key={r.id} onClick={() => setEditing(r)}>
                    <span className={`ins-ico t-${r.type}`}><Icon name={TYPE_ICON[r.type]} size={18} /></span>
                    <div className="owe-main"><b>{rowTitle(r)}</b><span className="muted">{rowSub(r)}</span></div>
                    <b className={`amt-${r.type}`}>{r.type === 'sale' ? '+' : '−'}{inr(r.amount_inr)}</b>
                  </button>
                ))}
              </section>
            )}
          </>
        )}

        {data && range === 'week' && (
          <>
            <section className="card status">
              <div className="row"><span className="muted">{t('thisWeek')}</span>{delta !== null && <span className={`tag ${delta >= 0 ? 'good' : 'bad'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% {t('vsLast')}</span>}</div>
              <div className={`big ${data.tw.profit >= 0 ? 'good' : 'bad'}`}>{inr(data.tw.profit)}</div>
              <div className="tiles">
                <div><span>{t('sales')}</span><b>{inr(data.tw.sales)}</b></div>
                <div><span>{t('bought')}</span><b>{inr(data.tw.purchases)}</b></div>
                <div><span>{t('expenses')}</span><b>{inr(data.tw.expenses)}</b></div>
              </div>
            </section>

            <section className="card">
              <h3>{t('dailyProfit')}</h3>
              <div className="week big-chart">
                {data.days.map(d => (
                  <button key={d.date} className="day" onClick={() => { setDate(d.date); setRange('day') }}>
                    <span className="val">{d.count ? inr(d.profit).replace('₹', '') : ''}</span>
                    <div className="bar-slot tall">{d.count ? <i className={d.profit >= 0 ? 'up' : 'down'} style={{ height: `${Math.max(6, Math.abs(d.profit) / maxAbs * 100)}%` }} /> : <i className="none" />}</div>
                    <span>{dayLabel(d.date, { weekday: 'narrow' })}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="kpis">
              <div className="card kpi"><span className="muted">{t('margin')}</span><b>{data.tw.sales ? Math.round(data.tw.profit / data.tw.sales * 100) : 0}%</b></div>
              <div className="card kpi"><span className="muted">{t('avgDaily')}</span><b>{inr(data.logged.length ? data.tw.profit / data.logged.length : 0)}</b></div>
              <div className="card kpi"><span className="muted">{t('bestDay')}</span><b>{data.best ? `${dayLabel(data.best.date, { weekday: 'short' })} · ${inr(data.best.profit)}` : '–'}</b></div>
              <div className="card kpi"><span className="muted">{t('daysLogged')}</span><b>{data.logged.length}/7</b></div>
            </section>

            {data.top.length > 0 && (
              <section className="card">
                <h3>{t('topItems')}</h3>
                {data.top.map(([item, v]) => (
                  <div className="meter" key={item}>
                    <div className="row"><span>{item.replace(/^./, c => c.toUpperCase())}</span><b>{inr(v)}</b></div>
                    <div className="track"><i style={{ width: `${v / data.top[0][1] * 100}%` }} /></div>
                  </div>
                ))}
              </section>
            )}

            <section className="card list">
              <h3>{t('allEntries')}</h3>
              {[...data.days].reverse().filter(d => d.count).map(d => (
                <button key={d.date} className="dayrow" onClick={() => { setDate(d.date); setRange('day') }}>
                  <div className="owe-main"><b>{dayLabel(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</b><span className="muted">{t('sales')} {inr(d.sales)} · {t('bought')} {inr(d.purchases)} · {t('expenses')} {inr(d.expenses)}</span></div>
                  <b className={d.profit >= 0 ? 'up-text' : 'down-text'}>{inr(d.profit)}</b><Icon name="chevron" size={18} />
                </button>
              ))}
            </section>
          </>
        )}
      </div>
      {editing && <EditSheet row={editing} title={rowTitle(editing)} onClose={() => setEditing(null)} onDone={changed} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
