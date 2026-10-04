// Offline check of the safeguard in the n8n "Finish" node: runs its real code against simulated model outputs.
// Run: node tests/finish_unit.mjs
import { readFileSync } from 'node:fs'
const wf = JSON.parse(readFileSync(new URL('../n8n/pm-api.json', import.meta.url)))
const code = wf.nodes.find(n => n.name === 'Finish').parameters.jsCode
const run = (transcript, modelJson) => {
  const $ = name => ({ first: () => ({ json: name === 'Webhook' ? { body: { action: 'log', date: '2026-10-03' } } : { transcript } }) })
  const $input = { first: () => ({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(modelJson) }] } }] } }) }
  return new Function('$', '$input', code)($, $input)[0].json.draft
}
const sale = (amount, customer, on_credit, note = 'x') => ({ amount_inr: amount, note, customer, on_credit })
const mk = sales => ({ language_detected: 'english', translation: 'x', sales, purchases: [], expenses: [], udhaar_given: [], udhaar_received: [], uncertain: [], confidence: 1 })

const cases = [
  ['I sold atta for 1000 rupees to Kaushik', mk([sale(1000, 'Kaushik', false)]), 'cash sale to a named buyer', d => !d.sales[0].on_credit && d.sales[0].customer === 'Kaushik'],
  ['I sold atta for 1000 rupees to Kaushik', mk([sale(1000, 'Kaushik', true)]), 'model wrongly says credit, no credit word spoken -> stays cash', d => !d.sales[0].on_credit],
  ['I sold atta for 1000 rupees to Kaushik', mk([{ amount_inr: 1000, note: 'atta', customer: 'Kaushik' }]), 'older model output without on_credit -> stays cash', d => !d.sales[0].on_credit],
  ['I sold 500 rupees worth of oil to Ramesh as loan', mk([sale(500, 'Ramesh', true)]), 'loan -> credit', d => d.sales[0].on_credit && d.sales[0].customer === 'Ramesh'],
  ['Ramesh ko 500 ka tel udhaar pe becha', mk([sale(500, 'Ramesh', true)]), 'hinglish udhaar -> credit', d => d.sales[0].on_credit],
  ['रमेश को 500 का तेल उधार में बेचा', mk([sale(500, 'रमेश', true)]), 'devanagari उधार -> credit', d => d.sales[0].on_credit],
  ['Kaushik ne 1000 ka atta liya, paise baad mein dega', mk([sale(1000, 'Kaushik', true)]), 'pay later -> credit', d => d.sales[0].on_credit],
  ['sold 800 rupees of rice on credit', mk([sale(800, null, true)]), 'credit with no name -> flagged', d => d.sales[0].on_credit && d.uncertain.some(u => u.field === 'sales[0].customer')],
  ['Aaj 8000 ki bikri', mk([sale(8000, null, false, 'total day sales')]), 'plain day sales', d => !d.sales[0].on_credit && d.sales[0].customer === null],
  ['Sold milk for 60 to Meena, she paid cash', mk([sale(60, 'Meena', true)]), 'paid cash but model says credit -> cash', d => !d.sales[0].on_credit],
  ['अखिल ने तेल लिया 500 का उदार में', mk([sale(500, 'Akhil', true, 'oil')]), 'speech-to-text spelling उदार is treated as credit', d => d.sales[0].on_credit && d.sales[0].customer === 'Akhil'],
  ['अखिल ने तेल लिया 500 का', mk([sale(500, 'Akhil', true, 'oil')]), 'no credit word at all -> cash even if model says credit', d => !d.sales[0].on_credit],
  ['Akhil ne 500 ka tel udhari mein liya', mk([sale(500, 'Akhil', true, 'tel')]), 'udhari spelling', d => d.sales[0].on_credit],
  ['Ramesh took 300 udhaar', { ...mk([]), udhaar_given: [{ customer: 'Ramesh', amount_inr: 300 }] }, 'plain udhaar stays ledger-only', d => d.sales.length === 0 && d.udhaar_given.length === 1],
]
let bad = 0
for (const [text, model, label, ok] of cases) {
  const d = run(text, model); const pass = ok(d)
  if (!pass) bad++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  | "${text}"`)
}
console.log(bad ? `\n${bad} failed` : '\nall passed'); process.exit(bad ? 1 : 0)
