import { useRef, useState, useCallback } from 'react'

const MAX_SECONDS = 60

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const rec = useRef(null), chunks = useRef([]), timer = useRef(null), resolveStop = useRef(null)

  const stop = useCallback(() => {
    clearInterval(timer.current)
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
  }, [])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks.current = []
    rec.current = new MediaRecorder(stream)
    rec.current.ondataavailable = e => chunks.current.push(e.data)
    rec.current.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      setRecording(false)
      resolveStop.current?.(new Blob(chunks.current, { type: rec.current.mimeType }))
    }
    rec.current.start()
    setSeconds(0); setRecording(true)
    timer.current = setInterval(() => setSeconds(s => { if (s + 1 >= MAX_SECONDS) stop(); return s + 1 }), 1000)
  }, [stop])

  // Resolves with the audio Blob once recording stops.
  const finished = useCallback(() => new Promise(r => { resolveStop.current = r }), [])
  return { recording, seconds, start, stop, finished }
}
