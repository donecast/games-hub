// ═══════════════════════════════════════════════════════════════
// GAMES HUB — Shared Auth
// SSO layer for games.donecast.com
// Sets a .donecast.com cookie so all games can share one session
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const API_BASE = 'https://api.donecast.com/api';

  // Shared cookie key — readable by all *.donecast.com subdomains
  const COOKIE_KEY = 'dc_games_token';
  const LS_USER_KEY = 'games_hub_user';

  // ─── Cookie Helpers ───────────────────────────────────────

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    const maxAge = days ? days * 86400 : 86400;
    // domain=.donecast.com shares across all subdomains
    document.cookie = `${name}=${encodeURIComponent(value)}; domain=.donecast.com; path=/; secure; samesite=lax; max-age=${maxAge}`;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; domain=.donecast.com; path=/; max-age=0`;
  }

  // ─── Token Management ─────────────────────────────────────

  function getToken() {
    return getCookie(COOKIE_KEY) || null;
  }

  function setToken(token) {
    setCookie(COOKIE_KEY, token, 7); // 7-day shared session
  }

  function clearAuth() {
    deleteCookie(COOKIE_KEY);
    try { localStorage.removeItem(LS_USER_KEY); } catch {}
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // ─── User Profile ─────────────────────────────────────────

  function getUser() {
    try {
      const u = localStorage.getItem(LS_USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  }

  function setUser(user) {
    try { localStorage.setItem(LS_USER_KEY, JSON.stringify(user)); } catch {}
  }

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

    const token = hashParams.get('access_token') || queryParams.get('access_token') || queryParams.get('token');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

    if (token) {
      setToken(token);
      // Also store refresh token in localStorage for hub use
      if (refreshToken) {
        try { localStorage.setItem('games_hub_refresh', refreshToken); } catch {}
      }
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
      if (!resp.ok) return null;
      const user = await resp.json();
      setUser(user);
      window.GamesHubAuth._notifyListeners();
      return user;
    } catch {
      return null;
    }
  }

  // ─── Listener System ──────────────────────────────────────

  const listeners = new Set();

  // ─── Public API ───────────────────────────────────────────

  window.GamesHubAuth = {
    isLoggedIn,
    getToken,
    getUser,
    loginWithGoogle,
    logout,
    handleAuthCallback,
    fetchProfile,
    onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _notifyListeners() { listeners.forEach(fn => fn(isLoggedIn(), getUser())); },
  };

})();
