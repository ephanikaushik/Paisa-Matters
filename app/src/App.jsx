import { useEffect, useMemo, useState } from 'react'
import Frame from './Frame.jsx'
import { DockSlot } from './Dock.jsx'
import Auth from './Auth.jsx'
import Tour from './Tour.jsx'
import { getSession, setSession, tourSeen, markTourSeen } from './session.js'
import { I18nProvider, useI18n } from './i18n.jsx'
import { useHome } from './useHome.js'
import { readHidden, writeHidden, visibleInsights } from './insightText.js'
import Icon from './Icons.jsx'
import Home from './screens/Home.jsx'
import Udhaar from './screens/Udhaar.jsx'
import Insights from './screens/Insights.jsx'
import Ask from './screens/Ask.jsx'
import Reports from './screens/Reports.jsx'
import SettingsSheet from './screens/SettingsSheet.jsx'
import ProfileDrawer from './ProfileDrawer.jsx'
import InsightOverlay from './InsightOverlay.jsx'

const TABS = ['home', 'udhaar', 'insights', 'ask']

function Shell({ session, onSwitch, onLogout }) {
  const { t } = useI18n()
  const home = useHome()
  const [tab, setTab] = useState(() => (TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home'))
  const [report, setReport] = useState(() => (location.hash === '#week' ? { range: 'week' } : location.hash === '#day' ? { range: 'day', type: 'purchase' } : null))
  const [panel, setPanel] = useState(location.hash === '#profile' ? 'profile' : location.hash === '#settings' ? 'settings' : location.hash === '#bulb' ? 'insight' : null) // profile | settings | insight
  const [hidden, setHidden] = useState(readHidden)
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('pm_theme') || 'light' } catch { return 'light' } })
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('pm_theme', theme) } catch { /* ignore */ } }, [theme])

  const [slot, setSlot] = useState(null)
  const [tour, setTour] = useState(false)
  const [closing, setClosing] = useState(false)
  const endTour = () => { setTour(false); markTourSeen(session.shop_id) }
  const startTour = () => { setPanel(null); setTab('home'); setTimeout(() => setTour(true), 350) }
  // a brand-new account gets the guided tour once, as soon as Home has rendered
  useEffect(() => {
    if (!session.fresh || tourSeen(session.shop_id) || home.loading) return
    const id = setTimeout(() => { setTab('home'); setTour(true) }, 600)
    return () => clearTimeout(id)
  }, [session, home.loading])

  const closePanel = () => { setClosing(true); setTimeout(() => { setPanel(null); setClosing(false) }, 300) }

  const hide = key => { const n = [...hidden, key]; setHidden(n); writeHidden(n) }
  const restore = () => { setHidden([]); writeHidden([]) }
  const list = useMemo(() => visibleInsights(home.data?.insights, hidden), [home.data, hidden])
  const profile = home.data?.profile
  const storeName = profile?.store_name || t('myShop')
  const initial = (profile?.first_name || storeName)[0].toUpperCase()
  const owed = home.data?.udhaar?.length || 0

  const tabs = [['home', 'home', t('navHome')], ['udhaar', 'people', t('navUdhaar')], ['insights', 'bulb', t('navInsights')], ['ask', 'spark', t('navAsk')]]
  return (
    <DockSlot.Provider value={slot}>
        <div className="app">
          <header className="appbar">
            <button className="shop" data-tour="profile" onClick={() => setPanel('profile')} aria-label={t('profile')}>
              <span className="avatar">{initial}</span><span className="shop-name">{storeName}</span>
            </button>
            <div className="bar-actions">
              <button className="icon-btn bulb-btn" data-tour="bulb" onClick={() => setPanel('insight')} aria-label={t('overlayTitle')}>
                <Icon name="bulb" />{list.length > 0 && <i className="dot-badge">{list.length}</i>}
              </button>
              <button className="icon-btn" data-tour="settings" onClick={() => setPanel('settings')} aria-label={t('settings')}><Icon name="gear" /></button>
            </div>
          </header>

          <div className="scroll">
          {tab === 'home' && <Home home={home} goTab={setTab} openReport={setReport} />}
          {tab === 'udhaar' && <Udhaar home={home} />}
          {tab === 'insights' && <Insights home={home} list={list} hiddenCount={hidden.length} onHide={hide} onRestore={restore} />}
          {tab === 'ask' && <Ask />}
          </div>
          <div className="dock-slot" ref={setSlot} />

          <nav className="tabbar">
            {tabs.map(([id, ico, label]) => (
              <button key={id} data-tour={`tab-${id}`} className={`${tab === id ? 'active' : ''} ${id === 'ask' ? 'ai' : ''}`} onClick={() => setTab(id)}>
                <span className="pill"><Icon name={ico} />{id === 'udhaar' && owed > 0 && <i className="badge">{owed}</i>}</span>{label}{id === 'ask' && <i className="ai-tag">{t('aiBadge')}</i>}
              </button>
            ))}
          </nav>
        </div>

        {report && <Reports initial={report} onClose={() => setReport(null)} onChanged={home.refresh} />}
        {panel === 'profile' && <ProfileDrawer home={home} closing={closing} onClose={closePanel} />}
        {panel === 'settings' && <SettingsSheet theme={theme} setTheme={setTheme} home={home} session={session} onSwitch={onSwitch} onLogout={onLogout} onReplayTour={startTour} onClose={() => setPanel(null)} />}
        {panel === 'insight' && <InsightOverlay list={list} onClose={() => setPanel(null)} onDone={hide} onSeeAll={() => { setPanel(null); setTab('insights') }} />}
        {tour && <Tour onClose={endTour} />}
    </DockSlot.Provider>
  )
}

function Root() {
  const [session, setSess] = useState(getSession)
  const enter = s => { setSession(s); setSess(s) }
  const leave = () => { setSession(null); setSess(null) }
  return <Frame>{session ? <Shell key={session.shop_id} session={session} onSwitch={enter} onLogout={leave} /> : <Auth onAuthed={enter} />}</Frame>
}
export default function App() { return <I18nProvider><Root /></I18nProvider> }
