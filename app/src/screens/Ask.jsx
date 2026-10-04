import { useEffect, useRef, useState } from 'react'
import { ask, transcribe } from '../api.js'
import { useRecorder } from '../useRecorder.js'
import { useI18n } from '../i18n.jsx'
import EntryBar from '../EntryBar.jsx'
import Icon from '../Icons.jsx'
import { Dock } from '../Dock.jsx'

export default function Ask() {
  const { t, lang } = useI18n()
  const { recording, seconds, start, stop, finished } = useRecorder()
  const [q, setQ] = useState('')
  const [chat, setChat] = useState([])
  const [busy, setBusy] = useState(false)
  const [hearing, setHearing] = useState(false)
  const [error, setError] = useState('')
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [chat, busy, hearing])

  const go = async text => {
    if (!text.trim() || busy) return
    setChat(c => [...c, { who: 'me', text }]); setQ(''); setBusy(true)
    try { const r = await ask(text, lang); setChat(c => [...c, { who: 'bot', text: r.answer_text }]) }
    catch { setChat(c => [...c, { who: 'bot', text: t('offline'), err: true }]) }
    setBusy(false)
  }
  const toggleMic = async () => {
    setError('')
    if (recording) { stop(); return }
    try {
      const done = finished(); await start()
      const blob = await done
      setHearing(true)
      const text = await transcribe(blob)
      setHearing(false)
      if (text) go(text); else setError(t('micDenied'))
    } catch { setHearing(false); setError(t('micDenied')) }
  }
  const speak = text => { const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; speechSynthesis.cancel(); speechSynthesis.speak(u) }
  const suggestions = ['q1', 'q2', 'q3', 'q4']

  return (
    <main className="screen ask">
      <div className="ai-head">
        <span className="ai-orb" aria-hidden="true"><Icon name="spark" size={24} /></span>
        <div className="greet"><h1>{t('askTitle')}<i className="ai-tag inline">{t('aiBadge')}</i></h1><span className="muted">{t('askIntro')}</span></div>
        {chat.length > 0 && <button className="text-btn" onClick={() => setChat([])}>{t('clearChat')}</button>}
      </div>
      <div className="thread">
        {chat.length === 0 && <><div className="label">{t('suggested')}</div>{suggestions.map(k => <button key={k} className="chip block" onClick={() => go(t(k))}>{t(k)}</button>)}</>}
        {chat.map((m, i) => (
          <div key={i} className={`bubble ${m.who} ${m.err ? 'err' : ''}`}>{m.text}
            {m.who === 'bot' && !m.err && <button className="icon-btn tiny" onClick={() => speak(m.text)} aria-label={t('readAnswer')}><Icon name="sound" size={16} /></button>}</div>
        ))}
        {(busy || hearing) && <div className="bubble bot muted">{hearing ? t('understanding') : t('thinking')}</div>}
        {error && <div className="alert">{error}</div>}
        <div ref={end} />
      </div>
      <Dock><div className="dock">
        {chat.length > 0 && !recording && <div className="chip-row">{suggestions.map(k => <button key={k} className="chip" onClick={() => go(t(k))}>{t(k)}</button>)}</div>}
        {recording && <div className="muted center">{t('listening')}</div>}
        <EntryBar value={q} onChange={setQ} onSend={() => go(q)} onMic={toggleMic} recording={recording} seconds={seconds} busy={busy || hearing}
          micLabel={recording ? t('listening') : t('micSpeak')} placeholder={hearing ? t('understanding') : t('askPlaceholder')} />
      </div></Dock>
    </main>
  )
}
