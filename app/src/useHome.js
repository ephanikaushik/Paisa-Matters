import { useCallback, useEffect, useState } from 'react'
import { getHome, todayStr } from './api.js'
import { getShopId } from './session.js'
import { setPref } from './prefs.js'

// One request feeds Home, Udhaar and Insights. The last response is cached per day and painted instantly
// (stale-while-revalidate), so the screen never flashes an empty state while the server wakes up.
const key = () => 'pm_home_' + getShopId()
const readCache = () => { try { const c = JSON.parse(localStorage.getItem(key())); return c && c.date === todayStr() ? c.data : null } catch { return null } }

export function useHome() {
  const [data, setData] = useState(readCache)
  const [error, setError] = useState(false)
  const [fetching, setFetching] = useState(true)

  const refresh = useCallback(async () => {
    setFetching(true)
    try {
      const r = await getHome()
      setData(r); setError(false)
      setPref('store', r.profile?.store_name || '')
      try { localStorage.setItem(key(), JSON.stringify({ date: todayStr(), data: r })) } catch { /* ignore */ }
    } catch { setError(true) } finally { setFetching(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  // show a fresh summary immediately after confirming, before the background refresh returns
  const patchSummary = useCallback(s => setData(d => (d ? { ...d, summary: s } : d)), [])
  const patchProfile = useCallback(profile => setData(d => {
    if (!d) return d
    const next = { ...d, profile }
    try { localStorage.setItem(key(), JSON.stringify({ date: todayStr(), data: next })) } catch { /* ignore */ }
    return next
  }), [])
  return { data, loading: !data && !error, error, fetching, refresh, patchSummary, patchProfile }
}
