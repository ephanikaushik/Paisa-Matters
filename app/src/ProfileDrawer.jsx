import { useEffect, useState } from 'react'
import { saveProfile } from './api.js'
import { useI18n } from './i18n.jsx'
import Icon from './Icons.jsx'

const TYPES = [['Kirana', 'stKirana'], ['Sweets', 'stSweets'], ['Vegetables', 'stVeg'], ['Tea', 'stTea'], ['Other', 'stOther']]
const KEYS = ['first_name', 'last_name', 'store_name', 'store_type', 'city', 'area', 'phone', 'upi_id']
const COUNTED = ['first_name', 'store_name', 'store_type', 'city', 'phone', 'upi_id']

export default function ProfileDrawer({ home, closing, onClose }) {
  const { t } = useI18n()
  const p = home.data?.profile || {}
  const initial = () => Object.fromEntries(KEYS.map(k => [k, p[k] || '']))
  const [f, setF] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k, v) => { setMsg(''); setF(x => ({ ...x, [k]: v })) }
  const dirty = KEYS.some(k => f[k] !== saved[k])
  // profile may arrive after the drawer opens: fill the form unless the user has already started typing
  useEffect(() => { if (!dirty && home.data?.profile) { setF(initial()); setSaved(initial()) } }, [home.data?.profile]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = COUNTED.filter(k => String(f[k]).trim()).length
  const fullName = [f.first_name, f.last_name].filter(Boolean).join(' ')
  const typeLabel = TYPES.find(([v]) => v === f.store_type)
  const title = fullName || f.store_name || t('pfNoName')
  const sub = fullName ? f.store_name : [typeLabel && t(typeLabel[1]), f.city].filter(Boolean).join(' · ')
  const since = p.member_since ? new Date(p.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null
  const month = home.data?.month

  async function save() {
    setBusy(true); setMsg('')
    try { const r = await saveProfile(f); home.patchProfile(r.profile || { ...p, ...f }); setSaved(f); setMsg(t('pfSaved')) }
    catch { setMsg(t('offline')) }
    setBusy(false)
  }
  const field = (k, label, props = {}) => (
    <div className="fld"><label className="label" htmlFor={'pf-' + k}>{label}</label>
      <input id={'pf-' + k} className="input" value={f[k]} onChange={e => set(k, e.target.value)} {...props} /></div>
  )
  return (
    <div className={`scrim left ${closing ? 'closing' : ''}`} onClick={onClose}>
      <aside className="drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('profile')}>
        <div className="pf-hero">
          <button className="icon-btn pf-close" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
          <span className="avatar xl">{(title[0] || 'S').toUpperCase()}</span>
          <h2>{title}</h2>
          {sub && <span className="pf-sub">{sub}</span>}
          {since && <span className="tag soft">{t('memberSince', { a: since })}</span>}
        </div>

        <div className="drawer-body">
          {month && (
            <div className="pf-stats">
              <div><span>{t('pfMonthProfit')}</span><b className={month.profit >= 0 ? 'up-text' : 'down-text'}>₹{Math.round(month.profit).toLocaleString('en-IN')}</b></div>
              <div><span>{t('pfDays')}</span><b>{month.days}</b></div>
            </div>
          )}
          <div className="pf-progress">
            <div className="row"><span className="muted">{t('pfDone', { n: done, m: COUNTED.length })}</span></div>
            <div className="track"><i style={{ width: `${done / COUNTED.length * 100}%` }} /></div>
          </div>

          <section className="pf-card">
            <h3>{t('pfPersonal')}</h3>
            <div className="two-col">{field('first_name', t('firstName'), { autoComplete: 'given-name' })}{field('last_name', t('lastName'), { autoComplete: 'family-name' })}</div>
            {field('phone', t('phone'), { type: 'tel', inputMode: 'numeric', autoComplete: 'tel' })}
          </section>

          <section className="pf-card">
            <h3>{t('pfStore')}</h3>
            {field('store_name', t('storeName'))}
            <div className="fld"><span className="label">{t('storeType')}</span>
              <div className="type-chips">{TYPES.map(([v, k]) => (
                <button key={v} type="button" className={`chip ${f.store_type === v ? 'on' : ''}`} aria-pressed={f.store_type === v} onClick={() => set('store_type', f.store_type === v ? '' : v)}>{t(k)}</button>))}</div></div>
            <div className="two-col">{field('city', t('city'))}{field('area', t('area'))}</div>
          </section>

          <section className="pf-card">
            <h3>{t('pfPay')}</h3>
            {field('upi_id', t('upiId'), { autoCapitalize: 'none', autoCorrect: 'off' })}
            <span className="muted">{t('pfHintUpi')}</span>
          </section>
        </div>

        <div className="drawer-foot">
          {msg && <span className={`pf-msg ${msg === t('pfSaved') ? 'ok' : ''}`}>{msg === t('pfSaved') && <Icon name="check" size={16} />}{msg}</span>}
          <button className="primary grow" onClick={save} disabled={busy || !dirty || !f.store_name.trim()}>{t('saveProfile')}</button>
        </div>
      </aside>
    </div>
  )
}
