import { useState } from 'react'
import { login, signup } from './api.js'
import { enterDemo } from './auth.js'
import { useI18n, LANGS } from './i18n.jsx'
import Icon from './Icons.jsx'

const ERR = { invalid_credentials: 'errInvalid', email_taken: 'errEmailTaken', weak_password: 'errWeak', invalid_email: 'errEmail', store_required: 'errStore' }

export default function Auth({ onAuthed }) {
  const { t, lang, setLang } = useI18n()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', store: '', name: '' })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const set = k => e => { setErr(''); setF(v => ({ ...v, [k]: e.target.value })) }

  async function run(kind, fn) {
    setErr(''); setBusy(kind)
    try { onAuthed(await fn()) } catch (e) { setErr(t(ERR[e.code] || 'errNetwork')) }
    setBusy('')
  }
  const submit = e => {
    e.preventDefault()
    run('form', async () => {
      if (mode === 'login') { const r = await login(f.email, f.password); return { shop_id: r.shop_id, email: r.email, store_name: r.store_name } }
      const r = await signup(f.email, f.password, f.store, f.name)
      return { shop_id: r.shop_id, email: r.email, store_name: r.store_name, fresh: true }
    })
  }
  const field = (k, label, props = {}) => (
    <div className="fld"><label className="label" htmlFor={'au-' + k}>{label}</label>
      <input id={'au-' + k} className="input" value={f[k]} onChange={set(k)} required disabled={!!busy} {...props} /></div>
  )

  return (
    <main className="auth scroll">
      <div className="auth-lang seg compact">{LANGS.map(([id, name]) => <button key={id} className={lang === id ? 'on' : ''} onClick={() => setLang(id)}>{name}</button>)}</div>

      <div className="auth-hero">
        <span className="auth-logo">₹</span>
        <h1>{t('brand')}</h1>
        <p className="muted">{t('appTagline')}</p>
      </div>

      <div className="seg auth-tabs" role="tablist">
        {[['login', 'tabLogin'], ['signup', 'tabSignup']].map(([id, k]) => <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => { setMode(id); setErr('') }}>{t(k)}</button>)}
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && <>{field('name', t('ownerName'), { autoComplete: 'name' })}{field('store', t('storeNameLabel'), { autoComplete: 'organization' })}</>}
        {field('email', t('email'), { type: 'email', autoComplete: 'email', inputMode: 'email', autoCapitalize: 'none' })}
        {field('password', t('password'), { type: 'password', autoComplete: mode === 'login' ? 'current-password' : 'new-password', minLength: mode === 'signup' ? 6 : undefined, placeholder: mode === 'signup' ? t('passwordHint') : '' })}
        {err && <div className="alert" role="alert">{err}</div>}
        <button className="primary big-btn" type="submit" disabled={!!busy}>{busy === 'form' ? t('working') : mode === 'login' ? t('btnLogin') : t('btnSignup')}</button>
      </form>

      <div className="auth-demo">
        <div className="divider"><span>{t('demoTitle')}</span></div>
        <button className="demo-card" disabled={!!busy} onClick={() => run('existing', () => enterDemo('existing'))}>
          <span className="ins-ico"><Icon name="chart" /></span>
          <span className="grow-text"><b>{t('demoExisting')}</b><span className="muted">{t('demoExistingSub')}</span></span>
          <Icon name="chevron" />
        </button>
        <button className="demo-card" disabled={!!busy} onClick={() => run('fresh', () => enterDemo('fresh'))}>
          <span className="ins-ico warn"><Icon name="spark" /></span>
          <span className="grow-text"><b>{t('demoNew')}</b><span className="muted">{t('demoNewSub')}</span></span>
          <Icon name="chevron" />
        </button>
        <span className="muted center">{t('demoCreds')}</span>
      </div>
    </main>
  )
}
