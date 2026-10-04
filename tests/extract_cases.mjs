// Live edge-case check of entry extraction against the deployed n8n workflow (nothing is saved: only the "log" step runs).
// Run: node tests/extract_cases.mjs        (reads N8N_BASE_URL from app/.env)
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync(new URL('../app/.env', import.meta.url), 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]))
const url = env.N8N_BASE_URL + '/webhook/pm-api'
const sleep = ms => new Promise(r => setTimeout(r, ms))
// the model API occasionally answers "Error in workflow" under rapid-fire calls, so pace requests and retry
const post = async (text, lang) => {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'log', shop_id: 'sharma-general-store', date: '2026-10-03', text, lang }) })
    let j = await r.json(); j = Array.isArray(j) ? j[0] : j
    if (j.draft) return j.draft
    await sleep(1500 * attempt)
  }
  throw new Error('no draft after 4 tries')
}

const cash = d => d.sales.length === 1 && !d.sales[0].on_credit && !d.udhaar_given.length
const credit = name => d => d.sales.length === 1 && d.sales[0].on_credit === true && (name === undefined || (d.sales[0].customer || '').toLowerCase() === name.toLowerCase()) && !d.udhaar_given.length
const cases = [
  ['I sold atta for 1000 rupees to Kaushik', d => cash(d) && d.sales[0].amount_inr === 1000, 'named buyer, no credit word = cash'],
  ['Kaushik ko atta becha 1000 ka', cash, 'hinglish named buyer = cash'],
  ['Sold 3 packets of biscuits to Anil for 30', cash, 'small named cash sale'],
  ['Sold milk for 60 to Meena, she paid cash', cash, 'explicit cash'],
  ['Aaj 8000 ki bikri', d => cash(d) && d.sales[0].amount_inr === 8000 && !d.sales[0].customer, 'plain day total'],
  ['I sold 500 rupees worth of oil to Ramesh as loan', credit('Ramesh'), 'loan = credit'],
  ['Ramesh ko 500 ka tel udhaar pe becha', credit('Ramesh'), 'hinglish udhaar pe becha'],
  ['रमेश को 500 का तेल उधार में बेचा', d => credit()(d), 'devanagari credit sale'],
  ['Kaushik ne 1000 ka atta liya, paise baad mein dega', credit('Kaushik'), 'pay later'],
  ['Sold 2000 of rice to Gupta, he will pay next week', credit('Gupta'), 'pay next week'],
  ['sold 800 rupees of rice on credit', d => credit()(d) && !d.sales[0].customer && d.uncertain.length > 0, 'credit without a name is flagged'],
  ['Ramesh ka 300 udhaar', d => d.sales.length === 0 && d.udhaar_given.length === 1 && d.udhaar_given[0].amount_inr === 300, 'plain udhaar = ledger only'],
  ['Gave Suresh 200 rupees cash loan', d => d.sales.length === 0 && d.udhaar_given.length === 1, 'cash lent = ledger only'],
  ['Ramesh paid back 300', d => d.sales.length === 0 && d.udhaar_received.length === 1, 'repayment is not a sale'],
  ['Meena ne 500 wapas diye', d => d.sales.length === 0 && d.udhaar_received.length === 1, 'hinglish repayment'],
  ['Bought 50 kg atta for 2000 from Sharma distributor', d => d.purchases.length === 1 && !d.sales.length && !d.udhaar_given.length, 'purchase'],
  ['Kharid 50 kilo atta 2000 ka, udhaar mein', d => d.purchases.length === 1 && !d.sales.length && !d.udhaar_given.length, 'stock bought on credit is a purchase, not a customer udhaar'],
  ['Electricity bill 300 and transport 120', d => d.expenses.length === 2 && !d.sales.length, 'expenses'],
  // Hindi / Devanagari, including the speech-to-text spelling "उदार" for "उधार"
  ['अखिल ने तेल लिया 500 का उदार में', d => credit('Akhil')(d) && d.sales[0].amount_inr === 500 && !/[\u0900-\u097F]/.test(d.translation), 'Hindi speech, English app: Akhil, 500, on credit, English translation'],
  ['अखिल ने तेल लिया 500 का उदार में', d => credit()(d) && /[\u0900-\u097F]/.test(d.sales[0].customer) && !/[A-Za-z]/.test(d.sales[0].customer + d.sales[0].note + d.translation), 'Hindi app: names, items and translation all in Devanagari', 'hi'],
  ['अखिल ने तेल लिया 500 का उधार में', credit('Akhil'), 'correct spelling उधार'],
  ['अखिल ने तेल लिया 500 का', d => cash(d) && d.sales[0].customer, 'no credit word = cash'],
  ['अखिल ने 500 का तेल नकद लिया', cash, 'explicit नकद = cash'],
  ['सुरेश को 300 उधार दिए', d => d.sales.length === 0 && d.udhaar_given.length === 1, 'plain udhaar given, no goods'],
  ['सुरेश ने 300 उधार लिया', d => d.sales.length === 0 && d.udhaar_given.length === 1, 'plain udhaar taken, no goods'],
  ['रमेश ने 300 उधारी चुकाई', d => d.sales.length === 0 && d.udhaar_received.length === 1, 'repayment in Hindi'],
  ['Akhil ne 500 ka tel udhaar liya', credit('Akhil'), 'hinglish credit sale with item', 'hinglish'],
  ['Akhil ne 500 udhaar liya', d => d.sales.length === 0 && d.udhaar_given.length === 1, 'hinglish plain udhaar, no goods', 'hinglish'],
  ['Aaj 5000 ki bikri, Ramesh ko 500 ka tel udhaar pe becha, Suresh ne 200 wapas diye', d => d.sales.some(s => s.on_credit && /ramesh/i.test(s.customer || '')) && d.udhaar_received.length === 1, 'mixed day'],
]
let bad = 0
for (const [text, ok, label, lang = 'en'] of cases) {
  let d, pass = false, err = ''
  try { d = await post(text, lang); pass = !!ok(d) } catch (e) { err = e.message }
  await sleep(700)
  if (!pass) bad++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  | "${text}" [${lang}]${pass ? '' : '\n      got: ' + (err || JSON.stringify({ sales: d.sales, udhaar_given: d.udhaar_given, udhaar_received: d.udhaar_received, purchases: d.purchases?.length, expenses: d.expenses?.length }))}`)
}
console.log(bad ? `\n${bad} of ${cases.length} failed` : `\nall ${cases.length} passed`); process.exit(bad ? 1 : 0)
