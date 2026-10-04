import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from './i18n.jsx'

// First-run guided tour: dims everything except one element and explains it.
// Steps point at elements by [data-tour="<key>"]; steps whose element is not on screen are skipped.
const KEYS = ['profile', 'bulb', 'settings', 'today', 'reports', 'week', 'field', 'mic', 'tab-udhaar', 'tab-insights', 'tab-ask']
const PAD = 6

export default function Tour({ onClose }) {
  const { t } = useI18n()
  const root = useRef(null)
  const tip = useRef(null)
  const [steps, setSteps] = useState(null) // [{ key, n }] — only steps whose element exists
  const [i, setI] = useState(0)
  const [box, setBox] = useState(null)
  const [tipH, setTipH] = useState(170)

  useEffect(() => {
    setSteps(KEYS.map((key, n) => ({ key, n: n + 1 })).filter(s => document.querySelector(`[data-tour="${s.key}"]`)))
  }, [])

  const measure = useCallback(() => {
    if (!steps?.length || !root.current) return
    const el = document.querySelector(`[data-tour="${steps[i].key}"]`)
    if (!el) return
    const r = el.getBoundingClientRect(), o = root.current.getBoundingClientRect()
    setBox({ x: r.left - o.left - PAD, y: r.top - o.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, W: o.width, H: o.height })
  }, [steps, i])

  useLayoutEffect(() => {
    if (!steps?.length) return
    const el = document.querySelector(`[data-tour="${steps[i].key}"]`)
    el?.scrollIntoView({ block: 'center', inline: 'nearest' })
    measure()
    const id = setTimeout(measure, 120) // after the scroll settles
    return () => clearTimeout(id)
  }, [steps, i, measure])

  useLayoutEffect(() => { if (tip.current) setTipH(tip.current.offsetHeight) }, [i, box])
  useEffect(() => {
    window.addEventListener('resize', measure)
    const key = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('keydown', key) }
  }, [measure, onClose])

  if (!steps?.length) return null
  const s = steps[i], last = i === steps.length - 1
  // Place the note beside the highlighted element, never on top of it. If the element is so tall that the note fits on neither
  // side, the note takes the roomier side and the highlight is trimmed to the part that stays visible.
  let tipStyle = { left: 16, right: 16, top: 80 }, hole = box
  if (box) {
    const w = Math.min(320, box.W - 32), gap = 14, edge = 12
    const left = Math.max(16, Math.min(box.x + box.w / 2 - w / 2, box.W - w - 16))
    const spaceBelow = box.H - edge - (box.y + box.h) - gap, spaceAbove = box.y - edge - gap
    let place = spaceBelow >= tipH ? 'below' : spaceAbove >= tipH ? 'above' : spaceBelow >= spaceAbove ? 'below' : 'above'
    if (spaceBelow < tipH && spaceAbove < tipH) {
      if (place === 'below') { const top = Math.max(edge, box.y), h = Math.max(56, box.H - edge - tipH - gap - top); hole = { ...box, y: top, h: Math.min(h, box.h) } }
      else { const bottom = box.y + box.h, top = Math.max(box.y, edge + tipH + gap); hole = { ...box, y: top, h: Math.max(56, bottom - top) } }
    }
    tipStyle = { width: w, left, top: place === 'below' ? Math.min(hole.y + hole.h + gap, box.H - edge - tipH) : Math.max(edge, hole.y - gap - tipH) }
  }
  return (
    <div className="tour" ref={root} role="dialog" aria-modal="true" aria-label={t(`tr${s.n}t`)}>
      {hole && <div className="tour-hole" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
      <div className="tour-tip" ref={tip} style={tipStyle}>
        <div className="tour-top"><span className="tour-count">{t('tourStep', { n: i + 1, m: steps.length })}</span>
          {!last && <button className="text-btn" onClick={onClose}>{t('tourSkip')}</button>}</div>
        <h3>{t(`tr${s.n}t`)}</h3>
        <p>{t(`tr${s.n}b`)}</p>
        <div className="tour-dots">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          {i > 0 && <button onClick={() => setI(i - 1)}>{t('tourBack')}</button>}
          <button className="primary grow" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? t('tourDone') : t('tourNext')}</button>
        </div>
      </div>
    </div>
  )
}
