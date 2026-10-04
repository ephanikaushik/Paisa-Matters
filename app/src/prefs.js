// Tiny on-device preferences (safe if storage is blocked).
export const getPref = (k, fallback = '') => { try { return localStorage.getItem('pm_' + k) ?? fallback } catch { return fallback } }
export const setPref = (k, v) => { try { localStorage.setItem('pm_' + k, v) } catch { /* ignore */ } }
