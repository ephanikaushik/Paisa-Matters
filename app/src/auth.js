import { login, resetDemoNewUser } from './api.js'
import { DEMO, markTourSeen } from './session.js'
import { writeHidden } from './insightText.js'

// Demo profiles for showing both home screens quickly.
//  fresh    → the shared blank shop, wiped each time, with the first-run tour
//  existing → the seeded Sharma General Store, as a returning user
export async function enterDemo(kind) {
  if (kind === 'fresh') {
    const r = await resetDemoNewUser()
    try { localStorage.removeItem('pm_home_' + r.shop_id) } catch { /* ignore */ }
    markTourSeen(r.shop_id, false); writeHidden([])
    return { shop_id: r.shop_id, email: r.email, store_name: r.store_name, fresh: true, demo: 'fresh' }
  }
  const r = await login(DEMO.existing.email, DEMO.existing.password)
  writeHidden([])
  return { shop_id: r.shop_id, email: r.email, store_name: r.store_name, demo: 'existing' }
}
