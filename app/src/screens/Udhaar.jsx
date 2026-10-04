import { useState } from 'react'
import { getPref } from '../prefs.js'
import { saveUdhaar } from '../api.js'
import { useI18n } from '../i18n.jsx'
import Icon from '../Icons.jsx'
import EntryDock from '../EntryDock.jsx'
import { inr } from './Home.jsx'

export function remindLink(t, name, amt) {
  return `https://wa.me/?text=${encodeURIComponent(t('remindMsg', { name, amt: Math.round(amt).toLocaleString('en-IN'), store: getPref('store', '') }))}`
}

function OweRow({ p, onGotPayment }) {
  const { t } = useI18n()
  const late = p.days_since != null && p.days_since >= 14
  const age = p.days_since == null ? '' : p.days_since <= 0 ? t('today0') : t('days', { n: p.days_since })
  return (
    <div className="owe">
      <div className="owe-top">
        <span className="avatar sm">{p.customer?.[0]?.toUpperCase()}</span>
        <div className="owe-main"><b>{p.customer}</b><span className={`muted ${late ? 'late' : ''}`}>{p.taken_on ? t('takenOn', { d: new Date(p.taken_on + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }) + ' · ' : ''}{age}</span></div>
        <b className="owe-amt">{inr(p.balance_inr)}</b>
      </div>
      <div className="owe-actions">
        <a className="btn-outline" href={remindLink(t, p.customer, p.balance_inr)} target="_blank" rel="noreferrer">{t('remind')}</a>
        <button className="btn-solid" onClick={() => onGotPayment(p)}>{t('gotPayment')}</button>
      </div>
    </div>
  )
}

// One-tap "got payment": prefilled amount, Full/Half shortcuts, saves directly (no AI step).
function PaySheet({ person, onClose, onSaved }) {
  const { t } = useI18n()
  const [amount, setAmount] = useState(String(Math.round(person.balance_inr)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const amt = Number(amount)
  async function save() {
    setBusy(true); setErr('')
    try { await saveUdhaar('receive', person.customer, amt); onSaved(t('paymentSaved', { a: person.customer, b: amt.toLocaleString('en-IN') })) }
    catch { setErr(t('offline')); setBusy(false) }
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('payTitle')}>
        <div className="sheet-head"><h2>{t('payTitle')}</h2><button className="icon-btn" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button></div>
        <div className="sheet-body">
          <div className="muted">{t('payFrom', { a: person.customer })} · {t('owesTotal')} {inr(person.balance_inr)}</div>
          <label className="label" htmlFor="am">{t('payAmount')}</label>
          <input id="am" className="input big-input" type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="filters">
            <button className="chip" onClick={() => setAmount(String(Math.round(person.balance_inr)))}>{t('payFull', { a: Math.round(person.balance_inr).toLocaleString('en-IN') })}</button>
            <button className="chip" onClick={() => setAmount(String(Math.round(person.balance_inr / 2)))}>{t('payHalf')}</button>
          </div>
          {err && <div className="alert">{err}</div>}
        </div>
        <div className="sheet-foot"><button className="primary grow" disabled={!(amt > 0) || busy} onClick={save}><Icon name="check" size={18} />{t('paySave')}</button></div>
      </div>
    </div>
  )
}

export default function Udhaar({ home }) {
  const { t } = useI18n()
  const [paying, setPaying] = useState(null)
  const [toast, setToast] = useState('')
  const list = home.data?.udhaar
  const body = () => {
    if (home.loading) return <><div className="skel h1" /><div className="skel card-h" /></>
    if (home.error && !list) return <div className="alert">{t('loadError')} <button className="text-btn" onClick={home.refresh}>{t('retry')}</button></div>
    const total = list.reduce((s, p) => s + Number(p.balance_inr), 0)
    return list.length > 0 ? (
      <>
        <section className="card status"><span className="muted">{t('owesTotal')}</span><div className="big warn">{inr(total)}</div></section>
        <section className="card list">{list.map(p => <OweRow key={p.customer} p={p} onGotPayment={setPaying} />)}</section>
      </>
    ) : <div className="empty"><Icon name="people" size={32} /><b>{t('owesEmpty')}</b><span className="muted">{t('owesEmptySub')}</span></div>
  }
  const saved = msg => { setPaying(null); setToast(msg); home.refresh(); setTimeout(() => setToast(''), 3500) }
  return (
    <main className="screen">
      <div className="greet"><h1>{t('navUdhaar')}</h1><span className="muted">{t('udhaarScreenSub')}</span></div>
      {body()}
      <EntryDock home={home} placeholder={t('udhaarPlaceholder')} />
      {paying && <PaySheet person={paying} onClose={() => setPaying(null)} onSaved={saved} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}
