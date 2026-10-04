import { useEffect, useState } from 'react'

function StatusBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id) }, [])
  return (
    <div className="statusbar" aria-hidden="true">
      <span>{now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: false })}</span>
      <span />
      <span className="sb-icons"><i className="sig" /><i className="wifi" /><i className="batt" /></span>
    </div>
  )
}

// Phone frame on desktop, full screen on a real phone. Everything (login, app, tour) lives inside it.
export default function Frame({ children }) {
  return (
    <div className="stage">
      <div className="device">
        <span className="island" aria-hidden="true" />
        <StatusBar />
        {children}
      </div>
    </div>
  )
}
