// Builds the weekly report message from the last 14 days of daily totals.
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmt = n => Math.round(Number(n)).toLocaleString('en-IN')

export function weeklyReportLink(days, store, t) {
  const at = off => { const d = new Date(); d.setDate(d.getDate() + off); return iso(d) }
  const by = Object.fromEntries((days || []).map(d => [d.date, d]))
  const cur = Array.from({ length: 7 }, (_, i) => by[at(i - 6)]).filter(Boolean)
  const prev = Array.from({ length: 7 }, (_, i) => by[at(i - 13)]).filter(Boolean)
  const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0)
  const profit = sum(cur, 'est_profit'), pp = sum(prev, 'est_profit')
  const delta = pp ? ` (${profit >= pp ? '▲' : '▼'} ${Math.abs(Math.round((profit - pp) / Math.abs(pp) * 100))}%)` : ''
  const best = cur.length ? cur.reduce((a, b) => (b.est_profit > a.est_profit ? b : a)) : null
  const bestTxt = best ? `${new Date(best.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })} ₹${fmt(best.est_profit)}` : '–'
  const msg = t('weekMsg', { store, a: fmt(profit), d: delta, b: fmt(sum(cur, 'sales')), c: fmt(sum(cur, 'purchases')), e: fmt(sum(cur, 'expenses')), f: bestTxt })
  return `https://wa.me/?text=${encodeURIComponent(msg)}`
}
