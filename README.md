# Paisa Matters

**An AI profit coach for kirana stores and street vendors. Say your day in one line; know your profit in seconds.**

---

## The problem
Most kirana owners cannot answer "did I make a profit today?" without counting cash. Purchase prices creep up unnoticed, credit (udhaar) sits in the books as if it were profit, and existing ledger apps (Khatabook, OkCredit, Vyapar) are form-heavy record-keepers rather than advisers.

## The solution
Paisa Matters turns a spoken or typed sentence into a structured entry and a plain-language profit answer, with under 30 seconds of effort a day.

> "कौशिक ने तेल लिया 500 का उधार में"  →  *Sale · Oil · Kaushik · ₹500 · On credit*  →  one tap to confirm  →  *Estimated profit today*, with ₹500 shown as still to collect.

### What it does
- **Voice or text entry** in Hindi, English or Hinglish. The AI proposes sales, purchases, expenses and udhaar. The owner checks one sheet and confirms. **Nothing is saved before confirmation.**
- **Credit-aware profit.** A sale on credit counts as a sale and as money still to collect. A plain "Ramesh ka 300 udhaar" goes only to the udhaar ledger. A repayment never counts as a sale again.
- **Profit card** with three coach lines (what went well, what leaked, what to do tomorrow), readable aloud.
- **Insights** with ₹ impact: price creep, a cheaper supplier, overdue udhaar, top cost. One tap sends a WhatsApp message to the supplier or customer.
- **Udhaar tab:** who owes you, since when, remind on WhatsApp, record a payment.
- **Reports:** day and week views, tap Sales / Bought / Expenses to filter, edit or delete entries.
- **Profi AI:** ask about your shop by voice or text; it answers only from your own numbers.
- **English, Hindi and Hinglish** across the app and the AI, with strict language rules. Light and dark themes.
- **Accounts and a guided tour:** sign up gives an empty shop and a spotlight tour; a one-tap demo switch shows the new-user and returning-user screens.

## Architecture

```
React PWA (Vite)  ──►  n8n: one webhook  POST /webhook/pm-api  { action, ... }
                          ├─ voice     Groq Whisper (speech → text)
                          ├─ database  Supabase Postgres (profit, insights, accounts)
                          └─ LLM       Gemini Flash-Lite (extract · correct · answer)
                        then a code step validates and normalises every AI result
```

**Design choices worth knowing**
- *The AI never computes a number.* Profit, balances and insights are SQL. The model only reads and writes words.
- *Confirm before save.* Every AI result is a draft the owner can edit.
- *Defence in depth for credit.* A sale is credit only if the model says so **and** the spoken words contain a credit cue (including known speech-to-text misspellings such as "उदार"). Every sale also has a Paid / On credit toggle.
- *Language follows the app.* Names, items and answers come back in the app language; the confirm sheet shows what was said and, when the language differs, what it means.

## Tech
React 18 + Vite (PWA, mobile-first) · n8n (workflow backend) · Supabase Postgres · Groq `whisper-large-v3-turbo` · Google Gemini `gemini-3.5-flash-lite`.

## Repository layout
```
README.md                 this file
app/                      React + Vite front end
db/                       schema.sql · functions.sql · seed_demo.sql · seed_demo_cleanup.sql
n8n/                      build_pm_api.mjs (generator) · pm-api.json (import this)
prompts/prompts.md        the three prompts, generated from the workflow source
tests/                    finish_unit.mjs (offline) · extract_cases.mjs (live)
```

## Setup

### 1. Supabase
In the SQL editor, run in this order:
1. `db/schema.sql`
2. `db/functions.sql` (safe to re-run any time)
3. `db/seed_demo.sql` (28 days of demo data for Sharma General Store)

`db/seed_demo_cleanup.sql` removes only the demo rows.

### 2. n8n
1. In `n8n/build_pm_api.mjs`, set `SUPABASE` to your project URL (and change `GEMINI` if you use another model). Run `node n8n/build_pm_api.mjs` to regenerate `n8n/pm-api.json` and `prompts/prompts.md`.
2. Import `n8n/pm-api.json` as a new workflow.
3. Create three **Header Auth** credentials and attach them: **Groq Whisper** (`Authorization: Bearer <groq key>`), **Gemini** (`x-goog-api-key: <key>`) and **Supabase Database Call** (`apikey` and `Authorization: Bearer <service key>`).
4. Activate the workflow. The webhook is `POST /webhook/pm-api`.

### 3. App
```bash
cd app
cp .env.example .env        # set N8N_BASE_URL to your n8n host
npm install
npm run dev                 # http://localhost:5175
```
Open it in Chrome with mobile emulation, or on a phone on the same network. Real microphone use needs `localhost` or HTTPS.

## Try it

| Do this | To see |
|---|---|
| Log in with `demo@paisamatters.in` / `demo123` | The seeded shop: profit, week chart, overdue udhaar, price-creep and cheaper-supplier insights, Reports |
| Settings → **Demo profile → New user** | A blank shop and the guided tour; type an example from the start card |
| Say or type: *"I sold 500 rupees worth of oil to Ramesh on credit"* | A credit sale: counted as a sale, added to Ramesh's udhaar |
| Say or type: *"I sold atta for 1000 rupees to Kaushik"* | A cash sale; the buyer's name is kept, nothing goes to udhaar |
| Say or type: *"कौशिक ने तेल लिया 500 का उधार में"* | Kaushik, ₹500, On credit (with an English translation shown) |
| Switch language in Settings | Everything, including AI answers, changes language |
| Open the **Profi AI** tab | Ask "Who owes me udhaar?" |

## Tests
```bash
node tests/finish_unit.mjs      # 14 offline checks of the credit safeguard
node tests/extract_cases.mjs    # 29 live edge cases against your imported workflow (saves nothing)
```

## Assumptions and limitations
- **Estimated profit** = sales − purchases − expenses for the day (cash-basis; stock is not counted) and is labelled "Estimated".
- **Prototype login:** the shop id is kept on the device. A production version needs real authentication (Supabase Auth or OTP) and a token check on every call.
- **Names and items** are stored in the language they were logged in. A canonical name with translated display is the first follow-up.
- **Insights** compare a shop only with its own history and suppliers; there are no invented peer benchmarks.
- **Cron flows** (evening nudge, weekly report, nightly price scan) were cut; insights are computed when the app loads.
