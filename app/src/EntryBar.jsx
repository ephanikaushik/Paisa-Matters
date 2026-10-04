import Icon from './Icons.jsx'
import { useI18n } from './i18n.jsx'

// Text field (send inside) and a separate mic button at the far right, same row — easy to reach with a thumb.
export default function EntryBar({ value, onChange, onSend, onMic, recording, seconds, busy, placeholder, inputRef, micLabel }) {
  const { t } = useI18n()
  return (
    <div className="entry-row">
      <div className={`field ${recording ? 'rec-on' : ''}`} data-tour="field">
        {recording ? (
          <div className="rec"><span className="rec-dot" /><span className="rec-time">0:{String(seconds).padStart(2, '0')}</span>
            <span className="rec-bars">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 70}ms` }} />)}</span></div>
        ) : (
          <>
            <textarea ref={inputRef} value={value} rows={1} disabled={busy} placeholder={placeholder} aria-label={placeholder}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && value.trim()) { e.preventDefault(); onSend() } }} />
            <button className="send-in" disabled={!value.trim() || busy} onClick={onSend} aria-label={t('sendLabel')}><Icon name="send" size={20} /></button>
          </>
        )}
      </div>
      <button data-tour="mic" className={`mic-fab ${recording ? 'live' : ''}`} onClick={onMic} disabled={busy} aria-label={micLabel}><Icon name={recording ? 'stop' : 'mic'} size={26} /></button>
    </div>
  )
}
