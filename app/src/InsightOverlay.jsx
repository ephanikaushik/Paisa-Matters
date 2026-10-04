import { useEffect, useState } from 'react'
import { useI18n } from './i18n.jsx'
import InsightCard from './InsightCard.jsx'
import { insightKey } from './insightText.js'
import Icon from './Icons.jsx'

// Latest insight as a modal on top of whatever screen you are on — it never moves the page content.
export default function InsightOverlay({ list, onClose, onSeeAll, onDone }) {
  const { t } = useI18n()
  const [i, setI] = useState(0)
  useEffect(() => { if (list.length === 0) onClose(); else if (i >= list.length) setI(0) }, [list.length])
  const cur = list[Math.min(i, list.length - 1)]
  if (!cur) return null
  return (
    <div className="scrim mid" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('overlayTitle')}>
        <div className="sheet-head"><div><h2>{t('overlayTitle')}</h2><span className="muted">{t('ofN', { a: Math.min(i, list.length - 1) + 1, b: list.length })}</span></div>
          <button className="icon-btn" onClick={onClose} aria-label={t('closeIt')}><Icon name="close" /></button></div>
        <div className="sheet-body"><InsightCard key={insightKey(cur)} insight={cur} onDone={() => onDone(insightKey(cur))} /></div>
        <div className="sheet-foot">
          {list.length > 1 && <button onClick={() => setI(n => (n + 1) % list.length)}>{t('next')}</button>}
          <button className="primary grow" onClick={onSeeAll}>{t('seeAllInsights')}</button>
        </div>
      </div>
    </div>
  )
}
