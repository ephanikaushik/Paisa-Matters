import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import Icon from '../Icons.jsx'

const SECTIONS = [
  ['sales', 'secSales', 'coin', 'amount_inr', (s, t) => (s.on_credit ? t('onCreditTo', { a: s.customer || '…' }) : [s.note && s.note !== 'total day sales' ? s.note.replace(/^./, c => c.toUpperCase()) : 'Sales', s.customer].filter(Boolean).join(' · '))],
  ['purchases', 'secPurchases', 'cart', 'total_inr', p => `${p.item}${p.qty ? ` · ${p.qty} ${p.unit || ''}` : ''}${p.supplier ? ` · ${p.supplier}` : ''}`],
  ['expenses', 'secExpenses', 'bolt', 'amount_inr', x => x.category],
  ['udhaar_given', 'secUdhaarGiven', 'people', 'amount_inr', u => u.customer],
  ['udhaar_received', 'secUdhaarGot', 'people', 'amount_inr', u => u.customer],
]

export default function ConfirmSheet({ draft, transcript, onConfirm, onFix, onCancel, error }) {
  const { t, lang } = useI18n()
  const [d, setD] = useState(draft)
  const [fixing, setFixing] = useState(false)
  const [fixText, setFixText] = useState('')
  const unc = field => d.uncertain?.find(u => u.field === field)
  const setAmt = (key, i, field, v) => setD(p => ({ ...p, [key]: p[key].map((x, j) => (j === i ? { ...x, [field]: v === '' ? null : Number(v) } : x)) }))
  const setSale = (i, patch) => setD(p => ({ ...p, sales: p.sales.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const needsName = (d.sales || []).some(s => s.on_credit && !String(s.customer || '').trim())
  const nothing = SECTIONS.every(([k]) => !d[k]?.length)

  return (
    <div className="scrim">
      <div className="sheet tall" role="dialog" aria-label={t('confirmTitle')}>
        <div className="sheet-head"><div><h2>{t('confirmTitle')}</h2><div className="muted">{t('confirmSub')}</div></div>
          <button className="icon-btn" onClick={onCancel} aria-label={t('close')}><Icon name="close" /></button></div>
        <div className="heard"><span className="label">{t('heard')}</span>
          {(() => {
            // Show what was said, and — only when it is in another language — what it means in the app language.
            const said = String(transcript || '').trim(), meaning = String(d.translation || '').trim()
            const devanagari = /[\u0900-\u097F]/.test(said)
            const spoken = d.language_detected
            if (lang === 'hi') return <div>“{spoken === 'hindi' || !meaning ? said : meaning}”</div>
            const needsTranslation = !!meaning && meaning !== said && (lang === 'en' ? spoken !== 'english' : devanagari)
            return <>
              <div>“{said}”</div>
              {needsTranslation && <div className="heard-tr"><span className="label">{t('inLang')}</span>“{meaning}”</div>}
            </>
          })()}
        </div>
        <div className="sheet-body">
          {SECTIONS.map(([key, title, ico, amtField, label]) => d[key]?.length > 0 && (
            <div key={key} className="group">
              <div className="group-title"><Icon name={ico} size={16} />{t(title)}</div>
              {d[key].map((row, i) => {
                const flagged = unc(`${key}[${i}].${amtField}`) || unc(`${key}[${i}].qty`) || unc(`${key}[${i}].item`)
                return (
                  <div key={i} className={`line-item ${key} ${flagged ? 'flag' : ''}`}>
                    <div className="li-main">{label(row, t)}{flagged && <div className="li-warn"><Icon name="warn" size={14} />{t('notSure')}: {flagged.reason}</div>}</div>
                    <div className="amt"><span>₹</span><input type="number" inputMode="decimal" value={row[amtField] ?? ''} onChange={e => setAmt(key, i, amtField, e.target.value)} aria-label={label(row, t)} /></div>
                    {key === 'sales' && (
                      <div className="pay-row">
                        <div className="seg compact" role="group" aria-label={t('payMode')}>
                          <button className={!row.on_credit ? 'on' : ''} onClick={() => setSale(i, { on_credit: false })}>{t('payCash')}</button>
                          <button className={row.on_credit ? 'on' : ''} onClick={() => setSale(i, { on_credit: true })}>{t('onCredit')}</button>
                        </div>
                        {row.on_credit && <input className={`input ${row.customer ? '' : 'need'}`} value={row.customer || ''} onChange={e => setSale(i, { customer: e.target.value })} placeholder={t('whoOwes')} aria-label={t('whoOwes')} />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {nothing && d.uncertain?.map((u, i) => <div key={i} className="line-item flag"><div className="li-warn"><Icon name="warn" size={14} />{u.reason}</div></div>)}
          {fixing && (
            <div className="fix"><input className="input" autoFocus value={fixText} onChange={e => setFixText(e.target.value)} placeholder={t('fixPlaceholder')} />
              <button onClick={() => { onFix(fixText) }} disabled={!fixText.trim()}>{t('applyFix')}</button></div>
          )}
          {error && <div className="alert">{error}</div>}
        </div>
        <div className="sheet-foot">
          <button onClick={() => setFixing(f => !f)}>{t('fixIt')}</button>
          <button className="primary grow" disabled={needsName} onClick={() => onConfirm(d)}><Icon name="check" size={18} />{t('looksRight')}</button>
        </div>
      </div>
    </div>
  )
}
