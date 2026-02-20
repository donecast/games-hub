// ═══════════════════════════════════════════════════════════════
// PODIUM — Auth & API Client
// Integrates with DoneCast's Google OAuth for leaderboards
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const API_ORIGIN = window.PODIUM_API_ORIGIN || 'https://api.donecast.com';
  const API_BASE = API_ORIGIN.replace(/\/$/, '') + '/api';

  const AUTH_TOKEN_KEY = 'podium_auth_token';
  const REFRESH_TOKEN_KEY = 'podium_refresh_token';
  const USER_KEY = 'podium_user';
  const HUB_TOKEN_KEY = 'dc_games_token';

  // ─── Token Management ─────────────────────────────────────

  function getToken() {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(HUB_TOKEN_KEY) || null;
    } catch { return null; }
  }

  function setToken(token) {
    try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
  }

  function getRefreshToken() {
    try { return localStorage.getItem(REFRESH_TOKEN_KEY); } catch { return null; }
  }

  function setRefreshToken(token) {
    try { localStorage.setItem(REFRESH_TOKEN_KEY, token); } catch {}
  }

  function getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  }

  function setUser(user) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
  }

  function clearAuth() {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // ─── API Client ───────────────────────────────────────────

  async function apiCall(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = `${API_BASE}${path}`;
    const resp = await fetch(url, { ...options, headers });

    if (resp.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${getToken()}`;
        const retryResp = await fetch(url, { ...options, headers });
        if (!retryResp.ok) throw new Error(`API error: ${retryResp.status}`);
        return retryResp.json();
      }
      clearAuth();
      window.PodiumAuth._notifyListeners();
      throw new Error('Session expired');
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `API error: ${resp.status}`);
    }

    return resp.json();
  }

  async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.access_token) {
        setToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        return true;
      }
    } catch {}
    return false;
  }

  // ─── Auth Flow ────────────────────────────────────────────

  function loginWithGoogle() {
    const origin = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/login/google?return_to=${origin}&return_path=/podium/auth-callback.html`;
  }

  async function loginWithEmail(email, password) {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Incorrect email or password');
    }

    const data = await resp.json();
    if (!data.access_token) throw new Error('Login failed');

    setToken(data.access_token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);

    await fetchProfile();
    return getUser();
  }

  function logout() {
    clearAuth();
    window.PodiumAuth._notifyListeners();
  }

  function handleAuthCallback() {
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const token = hashParams.get('access_token') || queryParams.get('access_token') || queryParams.get('token');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

    if (token) {
      setToken(token);
      if (refreshToken) setRefreshToken(refreshToken);
      try { localStorage.setItem(HUB_TOKEN_KEY, token); } catch {}
      window.location.replace('/podium/');
      return true;
    }
    return false;
  }

  async function fetchProfile() {
    try {
      const user = await apiCall('/auth/me');
      setUser(user);
      window.PodiumAuth._notifyListeners();
      return user;
    } catch {
      return null;
    }
  }

  // ─── Game API Calls ───────────────────────────────────────

  async function getPuzzleToday() {
    return apiCall('/game/podium/puzzle/today');
  }

  async function getPuzzleReveal(puzzleDate) {
    return apiCall(`/game/podium/puzzle/reveal?puzzle_date=${puzzleDate}`);
  }

  async function submitScore(scoreData) {
    return apiCall('/game/podium/score', {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
  }

  async function getLeaderboard(puzzleDate) {
    const params = new URLSearchParams();
    if (puzzleDate) params.set('puzzle_date', puzzleDate);
    return apiCall(`/game/podium/leaderboard?${params}`);
  }

  async function getStats() {
    return apiCall('/game/podium/stats');
  }

  async function setUsername(username) {
    return apiCall('/game/username', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async function checkUsername(username) {
    return apiCall(`/game/username/check?username=${encodeURIComponent(username)}`);
  }

  // ─── Event System ─────────────────────────────────────────

  const listeners = new Set();

  // ─── Public API ───────────────────────────────────────────

  window.PodiumAuth = {
    isLoggedIn,
    getUser,
    getToken,
    loginWithGoogle,
    loginWithEmail,
    logout,
    handleAuthCallback,
    fetchProfile,
    getPuzzleToday,
    getPuzzleReveal,
    submitScore,
    getLeaderboard,
    getStats,
    setUsername,
    checkUsername,

    onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _notifyListeners() { listeners.forEach(fn => fn(isLoggedIn(), getUser())); },
  };

})();
