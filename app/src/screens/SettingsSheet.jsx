import { useState } from 'react'
import { enterDemo } from '../auth.js'
import { useI18n, LANGS } from '../i18n.jsx'
import { telemetryStats } from '../api.js'
import { getPref, setPref } from '../prefs.js'
import { weeklyReportLink } from '../shareText.js'
import Icon from '../Icons.jsx'

export default function SettingsSheet({ theme, setTheme, home, session, onSwitch, onLogout, onReplayTour, onClose }) {
  const { t, lang, setLang } = useI18n()
  const [aloud, setAloud] = useState(getPref('readaloud') === '1')
  const st = telemetryStats()
  const dark = theme === 'dark'
  const store = home.data?.profile?.store_name || t('myShop')
  const [switching, setSwitching] = useState('')
  const [swErr, setSwErr] = useState('')
  const current = session.shop_id === 'demo-new-shop' ? 'fresh' : session.shop_id === 'sharma-general-store' ? 'existing' : ''
  async function switchTo(kind) {
    if (switching || (kind === current && kind !== 'fresh')) return
    setSwErr(''); setSwitching(kind)
    try { onSwitch(await enterDemo(kind)) } catch { setSwErr(t('errNetwork')); setSwitching('') }
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('settings')}>
        <div className="sheet-head"><h2>{t('settings')}</h2><button className="icon-btn" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button></div>
        <div className="sheet-body">
          <div className="demo-box">
            <div className="row"><b>{t('demoProfile')}</b><span className="tag soft">{t('demoTag')}</span></div>
            <span className="muted">{t('demoSub')}</span>
            <div className="seg">
              {[['fresh', 'demoNewShort'], ['existing', 'demoExistingShort']].map(([k, label]) => (
                <button key={k} className={current === k ? 'on' : ''} disabled={!!switching} onClick={() => switchTo(k)}>{switching === k ? t('switching') : t(label)}</button>))}
            </div>
            {swErr && <div className="alert">{swErr}</div>}
          </div>

          <div className="label">{t('language')}</div>
          <div className="seg">{LANGS.map(([id, name]) => <button key={id} className={lang === id ? 'on' : ''} onClick={() => setLang(id)}>{name}</button>)}</div>

          <div className="setting-row">
            <span>{t('themeLabel')}</span>
            <button role="switch" aria-checked={dark} aria-label={t('theme')} className={`theme-toggle ${dark ? 'dark' : ''}`} onClick={() => setTheme(dark ? 'light' : 'dark')}>
              <span className="tt-icon sun"><Icon name="sun" size={16} /></span><span className="tt-icon moon"><Icon name="moon" size={16} /></span>
              <span className="tt-thumb"><Icon name={dark ? 'moon' : 'sun'} size={16} /></span>
            </button>
          </div>

          <div className="setting-row">
            <div className="grow-text"><span>{t('readAloud')}</span><span className="muted">{t('readAloudSub')}</span></div>
            <button role="switch" aria-checked={aloud} aria-label={t('readAloud')} className={`switch ${aloud ? 'on' : ''}`} onClick={() => { setAloud(!aloud); setPref('readaloud', !aloud ? '1' : '0') }}><i /></button>
          </div>

          <a className="setting-link" href={weeklyReportLink(home.data?.days, store, t)} target="_blank" rel="noreferrer">
            <span className="ins-ico"><Icon name="share" size={20} /></span>
            <span className="grow-text"><b>{t('shareWeek')}</b><span className="muted">{t('shareWeekSub')}</span></span>
            <Icon name="chevron" size={18} />
          </a>

          <div className="label">{t('howTo')}</div>
          <ol className="tips"><li>{t('tip1')}</li><li>{t('tip2')}</li><li>{t('tip3')}</li></ol>

          <button className="btn-outline-wide" onClick={onReplayTour}><Icon name="spark" size={18} />{t('replayTour')}</button>

          <details className="about"><summary>{t('about')}</summary>
            <div className="kv"><span>{t('brand')}</span><b>v0.1</b></div>
            <div className="kv"><span>{t('protoMetrics')}: {t('medianTime')}</span><b>{st.median == null ? '–' : `${st.median}${t('secondsShort')}`}</b></div>
            <div className="kv"><span>{t('entries')}</span><b>{st.count}</b></div>
          </details>

          <div className="signed-in"><span className="muted">{t('signedInAs', { a: session.email || store })}</span>
            <button className="danger" onClick={onLogout}>{t('logout')}</button></div>
        </div>
      </div>
    </div>
  )
}
