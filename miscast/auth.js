// ═══════════════════════════════════════════════════════════════
// MISCAST — Auth & API Client
// Integrates with DoneCast's Google OAuth for leaderboards
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // api.donecast.com hosts the backend; all routes are under /api
  const API_ORIGIN = window.MISCAST_API_ORIGIN || 'https://api.donecast.com'; // Use the origin directly from window or fallback
  // Append '/api' to the origin to form the base URL, ensuring it ends with /api
  const API_BASE = API_ORIGIN.replace(/\/$/, '') + '/api';

  const AUTH_TOKEN_KEY = 'miscast_auth_token';
  const REFRESH_TOKEN_KEY = 'miscast_refresh_token';
  const USER_KEY = 'miscast_user';
  // Shared hub key — set when user logs in at games.donecast.com
  const HUB_TOKEN_KEY = 'dc_games_token';

  // ─── Token Management ─────────────────────────────────────

  function getToken() {
    try {
      // Own token takes priority; fall back to hub SSO token
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
      // Token expired — try refresh
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${getToken()}`;
        const retryResp = await fetch(url, { ...options, headers });
        if (!retryResp.ok) throw new Error(`API error: ${retryResp.status}`);
        return retryResp.json();
      }
      clearAuth();
      window.MiscastAuth._notifyListeners();
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
    // Backend reads: return_to (origin) + return_path (path after auth)
    const origin = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/login/google?return_to=${origin}&return_path=/miscast/auth-callback.html`;
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
    window.MiscastAuth._notifyListeners();
  }

  // Handle the auth callback — tokens come back as a hash fragment: #access_token=...
  function handleAuthCallback() {
    // DoneCast returns tokens as hash fragment: #access_token=...&refresh_token=...
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const token = hashParams.get('access_token') || queryParams.get('access_token') || queryParams.get('token');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

    if (token) {
      // Store token immediately — do NOT call fetchProfile() here.
      // An API call from auth-callback.html can fail due to CORS and wipe the token.
      // Profile is loaded lazily on the main page after redirect.
      setToken(token);
      if (refreshToken) setRefreshToken(refreshToken);
      // Also write to shared hub key so all games on this domain share the session
      try { localStorage.setItem(HUB_TOKEN_KEY, token); } catch {}
      window.location.replace('/miscast/');
      return true;
    }
    return false;
  }

  async function fetchProfile() {
    try {
      const user = await apiCall('/auth/me');
      setUser(user);
      window.MiscastAuth._notifyListeners();
      return user;
    } catch {
      return null;
    }
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
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        // Also write to shared hub key so other games share this
        try { localStorage.setItem(HUB_TOKEN_KEY, data.access_token); } catch {}
        await fetchProfile();
        return true;
      }
    } catch (err) {
      console.debug('[SSO] No cookie session available');
    }
    return false;
  }

  // ─── Game API Calls ───────────────────────────────────────

  async function submitScore(scoreData) {
    return apiCall('/game/score', {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
  }

  async function getLeaderboard(difficulty, puzzleDate) {
    const params = new URLSearchParams({ difficulty });
    if (puzzleDate) params.set('puzzle_date', puzzleDate);
    return apiCall(`/game/leaderboard?${params}`);
  }

  async function getStats() {
    return apiCall('/game/stats');
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

  window.MiscastAuth = {
    isLoggedIn,
    getUser,
    getToken,
    loginWithGoogle,
    loginWithEmail,
    logout,
    handleAuthCallback,
    fetchProfile,
    checkCookieSession,
    submitScore,
    getLeaderboard,
    getStats,
    setUsername,
    checkUsername,

    // Listener management
    onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _notifyListeners() { listeners.forEach(fn => fn(isLoggedIn(), getUser())); },
  };

})();
