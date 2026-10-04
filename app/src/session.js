// Who is signed in on this device. Stored locally; the shop_id it holds is sent with every request.
const KEY = 'pm_session'
const DEMO_PASSWORD = 'demo123'
export const DEMO = {
  existing: { email: 'demo@paisamatters.in', password: DEMO_PASSWORD },
  fresh: { email: 'newuser@demo.in', password: DEMO_PASSWORD },
}

export const getSession = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
export const setSession = s => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* ignore */ } }
export const getShopId = () => getSession()?.shop_id || ''

const tourKey = shop => 'pm_tour_' + shop
export const tourSeen = shop => { try { return localStorage.getItem(tourKey(shop)) === '1' } catch { return true } }
export const markTourSeen = (shop, seen = true) => { try { seen ? localStorage.setItem(tourKey(shop), '1') : localStorage.removeItem(tourKey(shop)) } catch { /* ignore */ } }
