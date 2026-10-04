// Generates n8n/pm-api.json — ONE workflow serving every app action via POST /webhook/pm-api
// body.action: login | signup | reset_demo | profile_save | update_txn | delete_txn | transactions | home | transcribe | log | confirm | correct | summary | history | insights | ask   (run: node n8n/build_pm_api.mjs)
import { writeFileSync, mkdirSync } from 'node:fs'
const SUPABASE = 'https://jflybkfaeleehrhlnruz.supabase.co'
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'

const EXTRACT_SYS = `You turn a kirana shopkeeper's spoken or typed note into JSON. The input may be Hindi (Devanagari), English, or Hinglish (Hindi in Roman letters), and speech-to-text often makes spelling mistakes. Numerals may be spoken: pachaas=50, sau=100, hazaar=1000, dedh=1.5, dhai=2.5, 'k'=thousand. Output ONLY JSON. Do not guess: if an amount, quantity or name is unclear, add it to "uncertain" and use null.

APP LANGUAGE: the message ends with "(App language: en|hi|hinglish)". Write every customer name, supplier, item and note in that style: en = English (names in Roman letters like "Akhil"; items as English words like "oil", "rice", "flour"; keep "atta", "daal", "ghee" as is); hinglish = Roman-letter Hinglish ("tel", "chawal"); hi = Devanagari Hindi ("अखिल", "तेल"). Also return "translation": the whole input as one short natural sentence in the app language (en = English, hi = Devanagari Hindi, hinglish = Roman Hinglish). Keep numbers as digits.

CREDIT CUES (udhaar): udhaar, udhar, udhari, udaar, udaari, uddhar, उधार, उधारी, उदार, उदारी, उधर, loan, credit, baaki, baki, बाकी, khata, खाता, खाते में, "pay later", "baad mein dega", बाद में देगा, "will pay next week". Speech-to-text often writes उधार as उदार or उदारी (उदार normally means generous, but next to an amount, an item or "में/पर/par/mein" it means credit).

WHO DID WHAT (Hindi/Hinglish grammar): "X ne ... liya" = X took/bought (the shop SOLD to X). "X ko ... becha/diya" = the shop sold/gave to X. "X ne ... diye / wapas kiye / chuka diye" = X paid money back. "maine X se ... liya" = the shop bought from supplier X.

SALES ("sales"): every sale has "customer" (the buyer's name if said, else null) and "on_credit" (boolean). A named buyer alone is NOT credit: "sold atta for 1000 to Kaushik" is a cash sale (customer "Kaushik", on_credit false). Set on_credit true ONLY when a credit cue is said about that sale. A credit sale is still a sale: put it in sales and never also in udhaar_given. If on_credit is true and no buyer name is said, set customer null and add to uncertain with the reason "customer name missing".
UDHAAR LEDGER: udhaar_given is ONLY for cash lent, or a plain "X ka N udhaar" / "X ne N udhaar liya" with NO goods or item mentioned (assumed already inside the day's sales). If an item or goods are mentioned together with a credit cue, it is a credit sale, not udhaar_given. udhaar_received = a customer paid back money they owed.
PURCHASES: "maal liya / kharida / bought" are purchases from a supplier. Buying stock on credit from a supplier is still a purchase, never a sale or udhaar_given. Expense category is one of electricity|rent|salary|transport|other.

JSON shape: {"language_detected":"hindi|english|hinglish","translation":string,"sales":[{"amount_inr":number,"note":string,"customer":string|null,"on_credit":boolean}],"purchases":[{"item":string,"qty":number|null,"unit":string,"total_inr":number|null,"supplier":string|null}],"expenses":[{"category":string,"amount_inr":number,"note":string}],"udhaar_given":[{"customer":string,"amount_inr":number}],"udhaar_received":[{"customer":string,"amount_inr":number}],"uncertain":[{"field":"e.g. purchases[0].qty","reason":string}],"confidence":number 0-1}

Input: "अखिल ने तेल लिया 500 का उदार में. (App language: en)"
Output: {"language_detected":"hindi","translation":"Akhil took oil worth 500 on credit.","sales":[{"amount_inr":500,"note":"oil","customer":"Akhil","on_credit":true}],"purchases":[],"expenses":[],"udhaar_given":[],"udhaar_received":[],"uncertain":[],"confidence":0.95}
Input: "अखिल ने तेल लिया 500 का उदार में. (App language: hi)"
Output: {"language_detected":"hindi","translation":"अखिल ने 500 का तेल उधार में लिया।","sales":[{"amount_inr":500,"note":"तेल","customer":"अखिल","on_credit":true}],"purchases":[],"expenses":[],"udhaar_given":[],"udhaar_received":[],"uncertain":[],"confidence":0.95}
Input: "Ramesh ko 500 ka tel udhaar pe becha (App language: hinglish)"
Output: {"language_detected":"hinglish","translation":"Ramesh ko 500 ka tel udhaar pe becha.","sales":[{"amount_inr":500,"note":"tel","customer":"Ramesh","on_credit":true}],"purchases":[],"expenses":[],"udhaar_given":[],"udhaar_received":[],"uncertain":[],"confidence":0.95}
Input: "I sold atta for 1000 rupees to Kaushik (App language: en)"
Output: {"language_detected":"english","translation":"I sold atta for 1000 rupees to Kaushik.","sales":[{"amount_inr":1000,"note":"atta","customer":"Kaushik","on_credit":false}],"purchases":[],"expenses":[],"udhaar_given":[],"udhaar_received":[],"uncertain":[],"confidence":0.95}
Input: "sold 800 rupees of rice on credit (App language: en)"
Output: {"language_detected":"english","translation":"Sold 800 rupees of rice on credit.","sales":[{"amount_inr":800,"note":"rice","customer":null,"on_credit":true}],"purchases":[],"expenses":[],"udhaar_given":[],"udhaar_received":[],"uncertain":[{"field":"sales[0].customer","reason":"customer name missing"}],"confidence":0.8}
Input: "रमेश का 300 उधार (App language: en)"
Output: {"language_detected":"hindi","translation":"Ramesh's 300 udhaar.","sales":[],"purchases":[],"expenses":[],"udhaar_given":[{"customer":"Ramesh","amount_inr":300}],"udhaar_received":[],"uncertain":[],"confidence":0.9}
Input: "सुरेश ने 200 वापस दिए (App language: hi)"
Output: {"language_detected":"hindi","translation":"सुरेश ने 200 रुपये वापस दिए।","sales":[],"purchases":[],"expenses":[],"udhaar_given":[],"udhaar_received":[{"customer":"सुरेश","amount_inr":200}],"uncertain":[],"confidence":0.9}
Input: "Aaj 8000 ki bikri, Sharma distributor se 50 kilo atta 2000 ka liya, bijli ka 300, Ramesh ka 300 udhaar (App language: hinglish)"
Output: {"language_detected":"hinglish","translation":"Aaj 8000 ki bikri, Sharma Distributor se 50 kilo atta 2000 ka liya, bijli ka 300, Ramesh ka 300 udhaar.","sales":[{"amount_inr":8000,"note":"total day sales","customer":null,"on_credit":false}],"purchases":[{"item":"atta","qty":50,"unit":"kg","total_inr":2000,"supplier":"Sharma Distributor"}],"expenses":[{"category":"electricity","amount_inr":300,"note":""}],"udhaar_given":[{"customer":"Ramesh","amount_inr":300}],"udhaar_received":[],"uncertain":[],"confidence":0.95}`
const FIX_SYS = `You fix a kirana shopkeeper's draft entry. You get the current draft JSON and a spoken/typed correction (Hindi, English or Hinglish, e.g. "nahi, atta 2500 ka tha"). Apply ONLY the correction, keep everything else unchanged, and return the full updated draft as JSON in exactly the same shape. Remove an "uncertain" entry once the correction resolves it. Write any new or changed name, item or note in the style given by "(App language: en|hi|hinglish)": en = English with Roman-letter names, hi = Devanagari Hindi, hinglish = Roman Hinglish. Keep "translation" and every other field as they are unless the correction changes them. Output ONLY JSON.`
const ASK_SYS = `You are Profi AI, a friendly assistant for a small kirana shop owner. Answer ONLY from the JSON shop data provided. If the data does not contain the answer, say so briefly and suggest logging more entries. Never invent numbers. Use ₹. Keep it to 2-3 short, simple sentences. The message ends with "(App language: en|hi|hinglish)". Reply STRICTLY in that language: en = plain English only, no Hindi words; hi = Devanagari Hindi only, no English or Roman letters (write amounts as ₹ numbers); hinglish = natural Hindi-English mix in Roman letters. Item and customer names from the data may be kept as they are. Never mention or repeat the app-language note in your answer.`

const prepare = `const body = $('Webhook').first().json.body || {};
const a = body.action;
const hasAudio = Object.keys($input.first().binary || {}).length > 0;
const databaseActions = {
  confirm: ['confirm_draft', { p_shop: body.shop_id, p_date: body.date, p_draft: body.draft }],
  profile_save: ['save_profile', { p_shop: body.shop_id, p_data: body.profile }],
  update_txn: ['update_txn', { p_shop: body.shop_id, p_id: Number(body.id), p_amount: Number(body.amount) }],
  delete_txn: ['delete_txn', { p_shop: body.shop_id, p_id: Number(body.id) }],
  transactions: ['get_transactions', { p_shop: body.shop_id, p_from: body.from, p_to: body.to }],
  home: ['get_home', { p_shop: body.shop_id, p_date: body.date }],
  summary: ['get_summary', { p_shop: body.shop_id, p_date: body.date }],
  history: ['get_history', { p_shop: body.shop_id, p_days: 7 }],
  insights: ['get_insights', { p_shop: body.shop_id }],
  ask: ['get_snapshot', { p_shop: body.shop_id }],
  login: ['auth_login', { p_email: body.email, p_password: body.password }],
  signup: ['auth_signup', { p_email: body.email, p_password: body.password, p_store: body.store_name, p_name: body.owner_name }],
  reset_demo: ['reset_demo_newuser', {}],
};
let out;
if (a === 'transcribe') { if (!hasAudio) throw new Error('No audio received'); out = { next: 'voice' }; }
else if (a === 'log') out = { next: hasAudio ? 'voice' : 'ai' };
else if (a === 'correct') out = { next: 'ai' };
else if (databaseActions[a]) out = { next: 'database', fn: databaseActions[a][0], databaseBody: databaseActions[a][1] };
else throw new Error('Unknown action: ' + a);
return [{ json: out, binary: $input.first().binary }];`

const formatDatabaseResult = `const body = $('Webhook').first().json.body || {};
const r = $input.first().json;
let out;
switch (body.action) {
  case 'confirm': out = { ok: true, saved: r.saved, summary: r.summary, alerts: r.alerts || [] }; break;
  case 'summary': out = { ok: true, summary: r }; break;
  case 'ask': out = { ok: true, needsAi: true, snapshot: r }; break;
  default: out = { ok: true, ...r };
}
return [{ json: out }];`

const prepareAiRequest = `const body = $('Webhook').first().json.body || {};
const input = $input.first().json;
let system, user, extra = {}, cfg = { temperature: 0, responseMimeType: 'application/json' };
if (body.action === 'log') {
  const transcript = String(input.text ?? body.text ?? '').trim();
  if (!transcript) throw new Error('No audio or text received');
  system = ${JSON.stringify(EXTRACT_SYS)}; user = transcript + ' (App language: ' + (body.lang || 'en') + ')'; extra = { transcript };
} else if (body.action === 'correct') {
  system = ${JSON.stringify(FIX_SYS)};
  user = 'DRAFT:\\n' + JSON.stringify(body.draft) + '\\n\\nCORRECTION: ' + body.correction_text + ' (App language: ' + (body.lang || 'en') + ')';
} else {
  system = ${JSON.stringify(ASK_SYS)};
  user = 'SHOP DATA:\\n' + JSON.stringify(input.snapshot) + '\\n\\nQUESTION: ' + body.question + (body.lang ? '\\n(App language: ' + body.lang + ')' : '');
  cfg = { temperature: 0.2 };
}
return [{ json: { ...extra, gemini: { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: cfg } } }];`

const formatVoiceTranscript = `const body = $('Webhook').first().json.body || {};
const text = String($input.first().json.text || '').trim();
if (body.action === 'transcribe') return [{ json: { ok: true, text, needsAi: false } }];
return [{ json: { text, needsAi: true } }];`

const finish = `const body = $('Webhook').first().json.body || {};
const ctx = $('Prepare AI Request').first().json;
const raw = ($input.first().json.candidates?.[0]?.content?.parts || []).map(p => p.text).join('');
if (body.action === 'ask') return [{ json: { ok: true, answer_text: raw.replace(/\\s*\\(\\s*app language[^)]*\\)\\s*$/i, '').trim() } }];
let d; try { d = JSON.parse(raw); } catch (e) { throw new Error('AI returned invalid JSON'); }
const arr = x => Array.isArray(x) ? x : [];
const num = v => (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
const unitPrice = p => (num(p.qty) && num(p.total_inr)) ? Math.round(p.total_inr / p.qty * 100) / 100 : null;
if (body.action === 'correct') {
  arr(d.purchases).forEach(p => { p.unit_price_inr = unitPrice(p); });
  d.date = body.draft.date; d.uncertain = arr(d.uncertain);
  return [{ json: { ok: true, draft: d } }];
}
const CREDIT_WORDS = /udhaar|udhar|udhari|udaar|udaari|uddhar|loan|credit|baaki|baki|khata|khate|on account|pay later|later|baad mein|baad me|next week|tomorrow|kal dega|kal dungi|dega|degi|due|pending|उधार|उधारी|उदार|उदारी|उधर|बाकी|खाता|खाते|लोन|बाद में|बाद मे|कल दे/i;
const unc = arr(d.uncertain);
const flag = (field, reason) => unc.push({ field, reason });
const draft = {
  date: body.date, language_detected: d.language_detected || 'unknown', translation: typeof d.translation === 'string' ? d.translation.trim() : '',
  sales: arr(d.sales).map((s, i) => { const a = num(s.amount_inr); if (a === null) flag('sales['+i+'].amount_inr', 'missing or invalid amount'); const name = (typeof s.customer === 'string' && s.customer.trim()) ? s.customer.trim() : null;
    // Safeguard: a sale counts as credit only if the model says so AND the words actually spoken contain a credit cue.
    const credit = s.on_credit === true && CREDIT_WORDS.test(ctx.transcript || '');
    if (credit && !name) flag('sales['+i+'].customer', 'customer name missing');
    return { amount_inr: a, note: s.note || '', customer: name, on_credit: credit }; }),
  purchases: arr(d.purchases).map((p, i) => {
    const qty = num(p.qty), total = num(p.total_inr);
    if (qty === null) flag('purchases['+i+'].qty', 'quantity unclear');
    if (total === null) flag('purchases['+i+'].total_inr', 'amount unclear');
    return { item: p.item, qty, unit: p.unit || '', total_inr: total, unit_price_inr: unitPrice({ qty, total_inr: total }), supplier: p.supplier || null };
  }),
  expenses: arr(d.expenses).map((e, i) => { const a = num(e.amount_inr); if (a === null) flag('expenses['+i+'].amount_inr', 'invalid amount'); return { category: e.category || 'other', amount_inr: a, note: e.note || '' }; }),
  udhaar_given: arr(d.udhaar_given).map((u, i) => { const a = num(u.amount_inr); if (a === null) flag('udhaar_given['+i+'].amount_inr', 'invalid amount'); return { customer: u.customer, amount_inr: a }; }),
  udhaar_received: arr(d.udhaar_received).map((u, i) => { const a = num(u.amount_inr); if (a === null) flag('udhaar_received['+i+'].amount_inr', 'invalid amount'); return { customer: u.customer, amount_inr: a }; }),
  uncertain: unc, confidence: typeof d.confidence === 'number' ? d.confidence : 0
};
return [{ json: { ok: true, transcript: ctx.transcript, draft } }];`

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, type, typeVersion, position, parameters, ...extra })
const eq = (id, expr, val) => ({ id, leftValue: expr, rightValue: val, operator: { type: 'string', operation: 'equals' } })
const rule = (key) => ({ conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, combinator: 'and', conditions: [eq(key, '={{ $json.next }}', key)] }, renameOutput: true, outputKey: key })

const nodes = [
  node('Webhook', 'n8n-nodes-base.webhook', 2, [0, 300], { httpMethod: 'POST', path: 'pm-api', responseMode: 'responseNode', options: {} }),
  node('Prepare', 'n8n-nodes-base.code', 2, [220, 300], { jsCode: prepare }),
  node('Route', 'n8n-nodes-base.switch', 3.2, [440, 300], { rules: { values: [rule('voice'), rule('database'), rule('ai')] }, options: {} }),
  node('Groq Whisper', 'n8n-nodes-base.httpRequest', 4.2, [680, 100], {
    method: 'POST', url: 'https://api.groq.com/openai/v1/audio/transcriptions', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendBody: true, contentType: 'multipart-form-data',
    bodyParameters: { parameters: [
      { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'audio' },
      { name: 'model', value: 'whisper-large-v3-turbo' }, { name: 'temperature', value: '0' }, { name: 'response_format', value: 'verbose_json' },
      { name: 'prompt', value: 'किराना दुकान: आटा, दाल, चावल, तेल, उधार, बाकी, बिक्री, माल, खाता। kirana shop: atta, daal, chawal, udhaar, baaki, bikri, maal.' }] } }),
  node('Format Voice Transcript', 'n8n-nodes-base.code', 2, [900, 100], { jsCode: formatVoiceTranscript }),
  node('Supabase Database Call', 'n8n-nodes-base.httpRequest', 4.2, [680, 300], {
    method: 'POST', url: `=${SUPABASE}/rest/v1/rpc/{{ $json.fn }}`, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.databaseBody) }}' }),
  node('Format Database Result', 'n8n-nodes-base.code', 2, [900, 300], { jsCode: formatDatabaseResult }),
  node('Needs AI?', 'n8n-nodes-base.if', 2.2, [1120, 300], { conditions: { options: { caseSensitive: true, typeValidation: 'loose' }, combinator: 'and', conditions: [eq('n', '={{ $json.needsAi === true ? "yes" : "no" }}', 'yes')] } }),
  node('Prepare AI Request', 'n8n-nodes-base.code', 2, [1340, 500], { jsCode: prepareAiRequest }),
  node('Gemini', 'n8n-nodes-base.httpRequest', 4.2, [1560, 500], {
    method: 'POST', url: GEMINI, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.gemini) }}' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 }),
  node('Finish', 'n8n-nodes-base.code', 2, [1780, 500], { jsCode: finish }),
  node('Respond', 'n8n-nodes-base.respondToWebhook', 1.1, [2000, 300], { respondWith: 'firstIncomingItem', options: {} }),
]
const to = (n, i = 0) => ({ node: n, type: 'main', index: i })
const connections = {
  Webhook: { main: [[to('Prepare')]] },
  Prepare: { main: [[to('Route')]] },
  Route: { main: [[to('Groq Whisper')], [to('Supabase Database Call')], [to('Prepare AI Request')]] },
  'Groq Whisper': { main: [[to('Format Voice Transcript')]] },
  'Format Voice Transcript': { main: [[to('Needs AI?')]] },
  'Supabase Database Call': { main: [[to('Format Database Result')]] },
  'Format Database Result': { main: [[to('Needs AI?')]] },
  'Needs AI?': { main: [[to('Prepare AI Request')], [to('Respond')]] },
  'Prepare AI Request': { main: [[to('Gemini')]] },
  Gemini: { main: [[to('Finish')]] },
  Finish: { main: [[to('Respond')]] },
}
writeFileSync(new URL('./pm-api.json', import.meta.url), JSON.stringify({ name: 'pm-api', nodes, connections, settings: { executionOrder: 'v1' } }, null, 2))
console.log('wrote n8n/pm-api.json')

// Human-readable copy of the prompts, so reviewers can read them without opening n8n.
mkdirSync(new URL('../prompts/', import.meta.url), { recursive: true })
const fence = text => '~~~text\n' + text + '\n~~~\n'
writeFileSync(new URL('../prompts/prompts.md', import.meta.url), `# Prompts used by the n8n workflow

Generated by \`n8n/build_pm_api.mjs\` (edit the prompts there, then run \`node n8n/build_pm_api.mjs\`). Model: Gemini, temperature 0 for extraction and correction, 0.2 for answers.
The model only reads and writes words. Every number that is shown or saved is re-checked or computed in code (see \`Finish\` in the workflow and \`db/functions.sql\`).

## 1. Entry extraction (\`log\`)
Input: the transcript (typed, or Whisper output) followed by \`(App language: en|hi|hinglish)\`. Output: the draft JSON.

${fence(EXTRACT_SYS)}
## 2. Correction (\`correct\`)
Input: the current draft, the spoken or typed correction and the app language.

${fence(FIX_SYS)}
## 3. Profi AI answers (\`ask\`)
Input: a JSON snapshot of the shop's data (computed by \`get_snapshot\` in the database), the question and the app language.

${fence(ASK_SYS)}`)
console.log('wrote prompts/prompts.md')
