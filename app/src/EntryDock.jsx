import { useRef, useState, useEffect } from 'react'
import { logEntry, confirmDraft, correctDraft, logTelemetry } from './api.js'
import { useRecorder } from './useRecorder.js'
import { useI18n } from './i18n.jsx'
import { Dock } from './Dock.jsx'
import EntryBar from './EntryBar.jsx'
import ConfirmSheet from './screens/ConfirmCard.jsx'
import ProfitCard from './screens/ProfitCard.jsx'

// One entry flow for Home and Udhaar: type or speak → check → confirm. Pinned to the bottom (thumb zone).
export default function EntryDock({ home, placeholder, prefill }) {
  const { t } = useI18n()
  const { recording, seconds, start, stop, finished } = useRecorder()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState('idle') // idle | working | confirm | done
  const [draft, setDraft] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState('')
  const t0 = useRef(0)
  const inputRef = useRef(null)
  // a tapped example from the screen fills the field and focuses it
  useEffect(() => { if (prefill?.text) { if (!t0.current) t0.current = Date.now(); setText(prefill.text); inputRef.current?.focus() } }, [prefill]) // eslint-disable-line react-hooks/exhaustive-deps
  const mark = () => { if (!t0.current) t0.current = Date.now() }

  async function submit(payload) {
    setError(''); setPhase('working')
    try { const res = await logEntry(payload); setTranscript(res.transcript); setDraft(res.draft); setPhase('confirm') }
    catch { setError(t('offline')); setPhase('idle') }
  }
  async function toggleMic() {
    setError('')
    if (recording) { stop(); return }
    try { mark(); const done = finished(); await start(); submit({ audio: await done }) }
    catch { setError(t('micDenied')); t0.current = 0 }
  }
  async function confirm(d) {
    setPhase('working')
    try {
      const res = await confirmDraft(d)
      logTelemetry(Math.round((Date.now() - t0.current) / 1000)); t0.current = 0
      setSummary(res.summary); setAlerts(res.alerts || []); home.patchSummary(res.summary); setText(''); setPhase('done'); home.refresh()
    } catch { setError(t('offline')); setPhase('confirm') }
  }
  async function fix(correction) {
    setPhase('working')
    try { setDraft((await correctDraft(draft, correction)).draft) } catch { setError(t('offline')) }
    setPhase('confirm')
  }

  const busy = phase === 'working'
  return (
    <>
      <Dock><div className="dock">
        {error && <div className="alert">{error}</div>}
        {recording && <div className="muted center">{t('listening')}</div>}
        <EntryBar value={text} onChange={v => { mark(); setText(v) }} onSend={() => submit({ text })} onMic={toggleMic}
          recording={recording} seconds={seconds} busy={busy} inputRef={inputRef} micLabel={recording ? t('listening') : t('micSpeak')}
          placeholder={busy ? t('understanding') : placeholder} />
      </div></Dock>
      {phase === 'confirm' && <ConfirmSheet draft={draft} transcript={transcript} onConfirm={confirm} onFix={fix} onCancel={() => { setPhase('idle'); t0.current = 0 }} error={error} />}
      {phase === 'done' && <ProfitCard summary={summary} draft={draft} alerts={alerts} owed={home.data?.udhaar} onBack={() => { setPhase('idle'); setDraft(null) }} />}
    </>
  )
}
