import { getShopId } from './session.js'
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const appLang = () => { try { return localStorage.getItem('pm_lang') || 'en' } catch { return 'en' } }

// One n8n workflow serves everything: POST /webhook/pm-api with { action, ... }
async function api(body, { form } = {}) {
  const res = await fetch('/api/pm-api', form
    ? { method: 'POST', body: form }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop_id: getShopId(), ...body }) })
  if (!res.ok) throw new Error(`${body?.action || 'request'} failed (${res.status})`)
  let json = await res.json()
  if (Array.isArray(json)) json = json[0]
  if (json.ok === false) throw new Error(json.error || 'request failed')
  return json
}

export async function logEntry({ audio, text }) {
  if (audio) {
    const fd = new FormData()
    fd.append('action', 'log'); fd.append('lang', appLang()); fd.append('audio', audio, 'note.webm'); fd.append('shop_id', getShopId()); fd.append('date', todayStr())
    return api({ action: 'log' }, { form: fd })
  }
  return api({ action: 'log', text, date: todayStr(), lang: appLang() })
}
export const confirmDraft = draft => api({ action: 'confirm', date: draft.date, draft })
export const correctDraft = (draft, correction_text) => api({ action: 'correct', draft, correction_text, lang: appLang() })
export const getHome = () => api({ action: 'home', date: todayStr() })
export const getTransactions = (from, to) => api({ action: 'transactions', from, to })
export const saveProfile = profile => api({ action: 'profile_save', profile })
export const updateTxn = (id, amount) => api({ action: 'update_txn', id, amount })
export const deleteTxn = id => api({ action: 'delete_txn', id })
export const saveUdhaar = (kind, customer, amount) => confirmDraft({
  date: todayStr(), sales: [], purchases: [], expenses: [], uncertain: [],
  udhaar_given: kind === 'give' ? [{ customer, amount_inr: amount }] : [],
  udhaar_received: kind === 'receive' ? [{ customer, amount_inr: amount }] : [],
})
export async function transcribe(audio) {
  const fd = new FormData()
  fd.append('action', 'transcribe'); fd.append('audio', audio, 'note.webm'); fd.append('shop_id', getShopId())
  return (await api({ action: 'transcribe' }, { form: fd })).text
}
// Accounts: the server answers { error } for bad input instead of failing the request
async function auth(body) { const r = await api(body); if (r.error) { const e = new Error(r.error); e.code = r.error; throw e } return r }
export const login = (email, password) => auth({ action: 'login', email, password })
export const signup = (email, password, store_name, owner_name) => auth({ action: 'signup', email, password, store_name, owner_name })
export const resetDemoNewUser = () => auth({ action: 'reset_demo' })
export const ask = (question, lang) => api({ action: 'ask', question, lang })

// Time-to-log telemetry (first keystroke / record start → confirm tap), kept on this device for the deck metric.
const KEY = 'pm_telemetry'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
export function logTelemetry(seconds) { try { localStorage.setItem(KEY, JSON.stringify([...read(), { seconds, at: Date.now() }])) } catch { /* storage unavailable */ } }
export function telemetryStats() {
  const a = read().map(x => x.seconds).sort((x, y) => x - y)
  return { count: a.length, median: a.length ? a[Math.floor(a.length / 2)] : null }
}
