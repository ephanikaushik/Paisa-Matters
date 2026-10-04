import { getPref } from './prefs.js'
// Turns structured facts from the backend into plain-language, localized sentences.
// Numbers always come from the database, never from the LLM.
const fmt = n => Math.round(Number(n)).toLocaleString('en-IN')
const num = n => (Math.round(Number(n) * 10) / 10).toString()
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)
const wa = text => `https://wa.me/?text=${encodeURIComponent(text)}`

// -> { icon, tone: 'bad'|'warn'|'info', title, body, money, action?: {label, href} }
export function describeInsight(i, t) {
  const m = i.meta || {}
  const u = m.unit || 'kg'
  switch (i.type) {
    case 'price_creep': return {
      icon: 'up', tone: 'bad',
      title: t('cardCreepTitle', { a: cap(m.item) }),
      body: t('cardCreepBody', { b: num(m.latest), c: num(m.avg), u }),
      money: t('cardCreepMoney', { d: fmt(i.impact_inr) }),
      action: { label: t('iCreepAction'), href: wa(t('rateMsg', { a: m.item, b: num(m.latest) })) } }
    case 'better_supplier': return {
      icon: 'cart', tone: 'warn',
      title: t('cardBetterTitle', { a: cap(m.item), b: m.best_supplier }),
      body: t('cardBetterBody', { b: m.best_supplier, c: num(m.best_price), e: m.cur_supplier, d: num(m.cur_price), u }),
      money: t('cardBetterMoney', { m: fmt(i.impact_inr) }),
      action: { label: t('iBetterAction', { a: m.best_supplier }), href: wa(t('bestMsg', { a: m.best_supplier, b: m.item, c: num(m.best_price) })) } }
    case 'udhaar_risk': return {
      icon: 'people', tone: 'bad',
      title: t('cardUdhaarTitle', { a: m.customer, n: m.days }),
      body: t('cardUdhaarBody', { b: fmt(m.balance) }),
      money: t('cardUdhaarMoney'),
      action: { label: t('remind'), href: wa(t('remindMsg', { name: m.customer, amt: fmt(m.balance), store: getPref('store', '') })) } }
    case 'top_cost': return {
      icon: 'coin', tone: 'info',
      title: t('cardTopTitle', { a: cap(m.item) }),
      body: t('cardTopBody', { c: m.share }),
      money: t('cardTopMoney') }
    default: return { icon: 'bulb', tone: 'info', title: i.title, body: i.detail, money: '' }
  }
}

// Day-summary coaching: what went well / where money leaked / what to do tomorrow.
export function buildCoach(s, alerts, owed, t) {
  const profit = s.est_profit, avg = s.avg_profit_prev
  let well
  if (profit < 0) well = t('cwLoss')
  else if (avg == null) well = t('cwFirst')
  else if (profit >= avg * 1.1) well = t('cwBetter', { a: fmt(profit), b: fmt(avg) })
  else if (profit >= avg * 0.9) well = t('cwSame', { b: fmt(avg) })
  else well = t('cwLower', { b: fmt(avg) })

  const alert = (alerts || [])[0]
  const leaked = alert ? (d => `${d.title}. ${d.body}`)(describeInsight(alert, t))
    : s.top_purchase ? t('clTop', { a: cap(s.top_purchase), b: fmt(s.top_purchase_spend), c: s.top_purchase_share })
    : t('clNone')

  const late = (owed || []).find(p => p.days_since >= 14) || (owed || [])[0]
  const tomorrow = late ? t('ctRemind', { a: late.customer, b: fmt(late.balance_inr) })
    : alert?.meta?.item ? t('ctCompare', { a: cap(alert.meta.item) })
    : t('ctStreak')
  return { well, leaked, tomorrow }
}

export const insightKey = i => `${i.type}:${i.meta?.item || i.meta?.customer || i.id}`
export const readHidden = () => { try { return JSON.parse(localStorage.getItem('pm_hidden_insights') || '[]') } catch { return [] } }
export const writeHidden = list => { try { localStorage.setItem('pm_hidden_insights', JSON.stringify(list)) } catch { /* ignore */ } }
// not dismissed, biggest ₹ impact first; "top cost" (no ₹ impact) always last
export const visibleInsights = (list, hidden) => (list || []).filter(i => !hidden.includes(insightKey(i))).sort((a, b) => b.impact_inr - a.impact_inr)
