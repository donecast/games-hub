// ═══════════════════════════════════════════════════════════════
// GAMES HUB — Shared Auth
// games.donecast.com — same origin = shared localStorage
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const API_BASE = 'https://api.donecast.com/api';

  // Shared keys — readable by all pages on games.donecast.com
  const TOKEN_KEY  = 'dc_games_token';
  const REFRESH_KEY = 'dc_games_refresh';
  const USER_KEY   = 'dc_games_user';

  // ─── Storage ──────────────────────────────────────────────

  function getToken()        { try { return localStorage.getItem(TOKEN_KEY); }   catch { return null; } }
  function getRefreshToken() { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } }
  function getUser()         { try { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; } catch { return null; } }

  function setToken(t)   { try { localStorage.setItem(TOKEN_KEY, t); }         catch {} }
  function setRefresh(t) { try { localStorage.setItem(REFRESH_KEY, t); }       catch {} }
  function setUser(u)    { try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {} }

  function clearAuth() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }

  function isLoggedIn() { return !!getToken(); }

  // ─── Auth Flows ───────────────────────────────────────────

  function loginWithGoogle() {
    const origin = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/login/google?return_to=${origin}&return_path=/auth-callback.html`;
  }

  function logout() {
    clearAuth();
    window.GamesHubAuth._notifyListeners();
  }

  function handleAuthCallback() {
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const token   = hashParams.get('access_token')  || queryParams.get('access_token')  || queryParams.get('token');
    const refresh = hashParams.get('refresh_token') || queryParams.get('refresh_token');

    if (token) {
      setToken(token);
      if (refresh) setRefresh(refresh);
      // Redirect to hub root — games will inherit the session via localStorage
      window.location.replace('/');
      return true;
    }
    return false;
  }

  async function fetchProfile() {
    const token = getToken();
    if (!token) return null;
    try {
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) { clearAuth(); return null; }
      const user = await resp.json();
      setUser(user);
      window.GamesHubAuth._notifyListeners();
      return user;
    } catch { return null; }
  }

  async function checkCookieSession() {
    if (isLoggedIn()) return true;
    try {
      // Call the SSO session endpoint with credentials included (cookies)
      const resp = await fetch(`${API_BASE}/auth/session`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.access_token) {
        setToken(data.access_token);
        if (data.refresh_token) setRefresh(data.refresh_token);
        await fetchProfile();
        return true;
      }
    } catch (err) {
      console.debug('[SSO] No cookie session available');
    }
    return false;
  }

  // ─── Listener System ──────────────────────────────────────

  const listeners = new Set();

  // ─── Public API ───────────────────────────────────────────

  window.GamesHubAuth = {
    isLoggedIn,
    getToken,
    getRefreshToken,
    getUser,
    loginWithGoogle,
    logout,
    handleAuthCallback,
    fetchProfile,
    checkCookieSession,
    // Token key exposed so games can bootstrap their own auth from hub session
    TOKEN_KEY,
    onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _notifyListeners() { listeners.forEach(fn => fn(isLoggedIn(), getUser())); },
  };

})();
