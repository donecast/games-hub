// ═══════════════════════════════════════════════════════════════
// MISCAST — Game Engine (v2: difficulty, timer, enhanced stats)
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const STATE_KEY = 'miscast_state_v2';
  const STATS_KEY = 'miscast_stats_v2';

  let todayStr = getTodayDateStr();
  let dayState = null;    // Per-day state (all difficulties)
  let activeGame = null;  // Current active game for selected difficulty
  let activeDifficulty = null;
  let currentPuzzle = null;
  let puzzleNumber = 0;
  let tokens = [];
  let selectedWordIdx = null;
  let errorMap = {};

  // Timer
  let timerInterval = null;
  let timerStart = null;
  let timerElapsed = 0;   // ms accumulated (for pause/resume)

  // ─── Boot ─────────────────────────────────────────────────────

  function init() {
    loadDayState();
    showScreen('menu');
    renderMenu();
    bindGlobalEvents();
    updateAuthUI();

    // Show auth gate unless already logged in or explicitly chose anon
    if (MiscastAuth.isLoggedIn()) {
      // Logged in — fetch profile lazily (may be missing after OAuth redirect)
      if (!MiscastAuth.getUser()) {
        MiscastAuth.fetchProfile().catch(() => {});
      }
      if (!localStorage.getItem('miscast_visited_v2')) {
        showHowToPlay();
      }
    } else if (!localStorage.getItem('miscast_anon_choice')) {
      showAuthGate();
    } else if (!localStorage.getItem('miscast_visited_v2')) {
      showHowToPlay();
    }
  }

  // ─── State ────────────────────────────────────────────────────

  function loadDayState() {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === todayStr) {
        dayState = parsed;
        return;
      }
    }
    dayState = { date: todayStr, games: {} };
    saveDayState();
  }

  function saveDayState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(dayState));
  }

  function getGameState(difficulty) {
    return dayState.games[difficulty] || null;
  }

  function initGameState(difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty];
    dayState.games[difficulty] = {
      found: [],
      misses: [],
      clickOrder: [],
      takesLeft: config.takes,
      gameOver: false,
      won: false,
      timeMs: 0
    };
    saveDayState();
    return dayState.games[difficulty];
  }

  // Stats
  function getStats() {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) return JSON.parse(saved);
    return {
      easy: { played: 0, won: 0, bestTimeMs: null, currentStreak: 0, maxStreak: 0, lastWinDate: null },
      medium: { played: 0, won: 0, bestTimeMs: null, currentStreak: 0, maxStreak: 0, lastWinDate: null },
      hard: { played: 0, won: 0, bestTimeMs: null, currentStreak: 0, maxStreak: 0, lastWinDate: null },
      totalPlayed: 0,
      totalWon: 0,
      overallStreak: 0,
      maxOverallStreak: 0,
      lastPlayedDate: null,
      leaderboardWins: 0,
      topThreeFinishes: 0
    };
  }

  function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function recordGameEnd(difficulty, won, timeMs) {
    const stats = getStats();
    const ds = stats[difficulty];

    ds.played++;
    stats.totalPlayed++;

    if (won) {
      ds.won++;
      stats.totalWon++;

      if (ds.bestTimeMs === null || timeMs < ds.bestTimeMs) {
        ds.bestTimeMs = timeMs;
      }

      // Streak: consecutive days winning this difficulty
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

      if (ds.lastWinDate === yesterdayStr || ds.lastWinDate === todayStr) {
        if (ds.lastWinDate !== todayStr) ds.currentStreak++;
      } else {
        ds.currentStreak = 1;
      }
      ds.maxStreak = Math.max(ds.maxStreak, ds.currentStreak);
      ds.lastWinDate = todayStr;
    } else {
      if (ds.lastWinDate !== todayStr) {
        ds.currentStreak = 0;
      }
    }

    // Overall streak (any difficulty won today)
    if (won) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

      if (stats.lastPlayedDate === yesterdayStr || stats.lastPlayedDate === todayStr) {
        if (stats.lastPlayedDate !== todayStr) stats.overallStreak++;
      } else {
        stats.overallStreak = 1;
      }
      stats.maxOverallStreak = Math.max(stats.maxOverallStreak, stats.overallStreak);
    }
    stats.lastPlayedDate = todayStr;

    saveStats(stats);
  }

  // ─── Screens ──────────────────────────────────────────────────

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + name);
    if (screen) screen.classList.add('active');

    // Show/hide back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.style.display = name === 'game' ? 'flex' : 'none';
  }

  // ─── Menu ─────────────────────────────────────────────────────

  function renderMenu() {
    const stats = getStats();

    // Render difficulty cards with completion status
    ['easy', 'medium', 'hard'].forEach(diff => {
      const card = document.querySelector(`.diff-card[data-difficulty="${diff}"]`);
      if (!card) return;
      const game = getGameState(diff);
      if (game && game.gameOver) {
        card.classList.add('completed');
      } else {
        card.classList.remove('completed');
      }
    });

    // Today's progress dots
    const progContainer = document.getElementById('today-progress');
    if (progContainer) {
      let html = '';
      ['easy', 'medium', 'hard'].forEach(diff => {
        const game = getGameState(diff);
        const done = game && game.gameOver && game.won;
        const config = DIFFICULTY_CONFIG[diff];
        html += `<div class="prog-item ${done ? 'done' : ''}"><span class="prog-dot"></span>${config.label}</div>`;
      });
      progContainer.innerHTML = html;
    }

    // Streak
    const streakEl = document.getElementById('menu-streak');
    if (streakEl) {
      if (stats.overallStreak >= 2) {
        streakEl.innerHTML = `<span class="fire">🔥 ${stats.overallStreak}-day streak!</span>`;
        streakEl.style.display = 'block';
      } else if (stats.totalPlayed > 0) {
        streakEl.textContent = `${stats.totalPlayed} games played · ${stats.totalWon} won`;
        streakEl.style.display = 'block';
      } else {
        streakEl.style.display = 'none';
      }
    }

    puzzleNumber = getPuzzleDay() + 1;
    const numEl = document.getElementById('menu-puzzle-num');
    if (numEl) numEl.textContent = puzzleNumber;
  }

  // ─── Start Game ───────────────────────────────────────────────

  async function startGame(difficulty) {
    activeDifficulty = difficulty;

    // Load puzzle from vault (with embedded fallback)
    const { puzzle, number } = await fetchVaultPuzzle(difficulty);
    currentPuzzle = puzzle;
    puzzleNumber = number;

    // Check if already played today
    let game = getGameState(difficulty);
    if (game && game.gameOver) {
      activeGame = game;
      loadPuzzleTokens();
      showScreen('game');
      renderGameUI();
      renderPassage();
      updateStatusBar();
      setTimeout(() => showGameOver(), 300);
      return;
    }

    // Start new or resume
    if (!game) {
      game = initGameState(difficulty);
    }
    activeGame = game;
    loadPuzzleTokens();

    showScreen('game');
    renderGameUI();
    renderPassage();
    updateStatusBar();

    // Start/resume timer
    timerElapsed = activeGame.timeMs || 0;
    startTimer();
  }

  function loadPuzzleTokens() {
    tokens = tokenize(currentPuzzle.text);
    errorMap = {};
    // Match each error's wrong word to its token index
    for (const error of currentPuzzle.errors) {
      const wrongLower = error.wrong.toLowerCase();
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].word.toLowerCase() === wrongLower && !errorMap[i]) {
          errorMap[i] = error;
          break;
        }
      }
    }
  }

  function renderGameUI() {
    const config = DIFFICULTY_CONFIG[activeDifficulty];
    document.getElementById('game-puzzle-num').textContent = puzzleNumber;
    document.getElementById('game-puzzle-theme').textContent = currentPuzzle.theme;

    const badge = document.getElementById('game-diff-badge');
    badge.textContent = config.label;
    badge.className = 'puzzle-diff-badge ' + activeDifficulty;
  }

  // ─── Token Parsing ────────────────────────────────────────────

  function tokenize(text) {
    return text.split(/\s+/).map((raw, i) => {
      const match = raw.match(/^([^a-zA-Z''\u2019-]*)(.+?)([^a-zA-Z''\u2019-]*)$/);
      if (match) return { index: i, prefix: match[1], word: match[2], suffix: match[3], raw };
      return { index: i, prefix: '', word: raw, suffix: '', raw };
    });
  }

  // ─── Render Passage ───────────────────────────────────────────

  function renderPassage() {
    const passage = document.getElementById('passage');
    passage.innerHTML = '';

    tokens.forEach((token, i) => {
      if (i > 0) passage.appendChild(document.createTextNode(' '));
      if (token.prefix) passage.appendChild(document.createTextNode(token.prefix));

      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.index = token.index;

      const isError = errorMap.hasOwnProperty(token.index);
      const isFound = activeGame.found.includes(token.index);

      if (isFound) {
        span.classList.add('found');
        const error = errorMap[token.index];
        span.innerHTML = `<span class="wrong-text">${esc(token.word)}</span><span class="correct-text">${esc(error.right[0])}</span>`;
      } else if (activeGame.gameOver && isError) {
        span.classList.add('revealed');
        const error = errorMap[token.index];
        span.innerHTML = `<span class="wrong-text">${esc(token.word)}</span><span class="correct-text">${esc(error.right[0])}</span>`;
      } else if (activeGame.gameOver) {
        span.classList.add('game-over');
        span.textContent = token.word;
      } else {
        span.textContent = token.word;
      }

      passage.appendChild(span);
      if (token.suffix) passage.appendChild(document.createTextNode(token.suffix));
    });
  }

  function updateStatusBar() {
    const config = DIFFICULTY_CONFIG[activeDifficulty];
    const takesEl = document.getElementById('takes');
    let html = '';
    for (let i = 0; i < config.takes; i++) {
      html += i < activeGame.takesLeft ? '🎙️' : '<span class="take-used">🎙️</span>';
    }
    takesEl.innerHTML = html;

    document.getElementById('found-count').textContent =
      `${activeGame.found.length}/${currentPuzzle.errors.length} found`;
  }

  // ─── Timer ────────────────────────────────────────────────────

  function startTimer() {
    timerStart = Date.now();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 250);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    if (timerStart) {
      timerElapsed += Date.now() - timerStart;
      timerStart = null;
    }
    return timerElapsed;
  }

  function updateTimerDisplay() {
    const total = timerElapsed + (timerStart ? Date.now() - timerStart : 0);
    const secs = Math.floor(total / 1000);
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    document.getElementById('timer').textContent = `${mins}:${String(rem).padStart(2, '0')}`;
  }

  function formatTime(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  }

  // ─── Input Panel ──────────────────────────────────────────────

  function showInputPanel(wordIdx) {
    if (activeGame.gameOver) return;
    const token = tokens[wordIdx];
    if (!token) return;

    selectedWordIdx = wordIdx;

    document.querySelectorAll('#passage .word.selected').forEach(el => el.classList.remove('selected'));
    const wordEl = document.querySelector(`#passage .word[data-index="${wordIdx}"]`);
    if (wordEl) wordEl.classList.add('selected');

    document.querySelector('#selected-word-display').innerHTML =
      `<div class="label">Is this word miscast?</div><div class="word-highlight">${esc(token.word)}</div>`;

    const input = document.getElementById('correction-input');
    input.value = '';
    document.getElementById('input-feedback').textContent = '';
    document.getElementById('input-feedback').className = '';

    document.getElementById('input-panel').classList.add('visible');
    setTimeout(() => input.focus(), 100);
  }

  function hideInputPanel() {
    selectedWordIdx = null;
    document.querySelectorAll('#passage .word.selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('input-panel').classList.remove('visible');
    document.getElementById('correction-input').blur();
  }

  function submitCorrection() {
    if (selectedWordIdx === null || activeGame.gameOver) return;

    const input = document.getElementById('correction-input');
    const guess = input.value.trim().toLowerCase();

    if (!guess) {
      showInputFeedback('Type what the word should be!', 'error');
      return;
    }

    const isError = errorMap.hasOwnProperty(selectedWordIdx);

    if (isError) {
      const error = errorMap[selectedWordIdx];
      const isCorrect = error.right.some(r => r.toLowerCase() === guess);

      if (isCorrect) {
        // FOUND IT
        activeGame.found.push(selectedWordIdx);
        activeGame.clickOrder.push({ idx: selectedWordIdx, correct: true });

        const wordEl = document.querySelector(`#passage .word[data-index="${selectedWordIdx}"]`);
        if (wordEl) {
          wordEl.classList.remove('selected');
          wordEl.classList.add('found', 'found-flash');
          const token = tokens[selectedWordIdx];
          wordEl.innerHTML = `<span class="wrong-text">${esc(token.word)}</span><span class="correct-text">${esc(error.right[0])}</span>`;
        }

        hideInputPanel();
        updateStatusBar();
        showToast('🟢 Found!');

        // Check win
        if (activeGame.found.length === currentPuzzle.errors.length) {
          const finalTime = stopTimer();
          activeGame.timeMs = finalTime;
          activeGame.gameOver = true;
          activeGame.won = true;
          saveDayState();
          recordGameEnd(activeDifficulty, true, finalTime);
          markAllGameOver();
          setTimeout(() => showGameOver(), 600);
        } else {
          saveDayState();
        }
      } else {
        // Right word, wrong correction
        showInputFeedback('Right word — wrong fix! Try again.', 'hint');
        input.value = '';
        input.focus();
      }
    } else {
      // MISS — costs a take
      activeGame.misses.push(selectedWordIdx);
      activeGame.takesLeft--;
      activeGame.clickOrder.push({ idx: selectedWordIdx, correct: false });

      const wordEl = document.querySelector(`#passage .word[data-index="${selectedWordIdx}"]`);
      if (wordEl) {
        wordEl.classList.remove('selected');
        wordEl.classList.add('miss-flash');
        setTimeout(() => wordEl.classList.remove('miss-flash'), 500);
      }

      hideInputPanel();
      updateStatusBar();
      showToast('🔴 That word is fine!');

      // Check lose
      if (activeGame.takesLeft <= 0) {
        const finalTime = stopTimer();
        activeGame.timeMs = finalTime;
        activeGame.gameOver = true;
        activeGame.won = false;
        saveDayState();
        recordGameEnd(activeDifficulty, false, finalTime);
        renderPassage(); // Reveal answers
        setTimeout(() => showGameOver(), 600);
      } else {
        saveDayState();
      }
    }
  }

  function markAllGameOver() {
    document.querySelectorAll('#passage .word:not(.found)').forEach(el => el.classList.add('game-over'));
  }

  function showInputFeedback(msg, type) {
    const el = document.getElementById('input-feedback');
    el.textContent = msg;
    el.className = type;
  }

  // ─── Game Over / Results ──────────────────────────────────────

  function showGameOver() {
    stopTimer();
    const config = DIFFICULTY_CONFIG[activeDifficulty];
    const modal = document.getElementById('game-over-modal');
    const totalErrors = currentPuzzle.errors.length;

    // Title
    document.getElementById('result-title').textContent =
      activeGame.won ? 'Nailed It! 🎉' : 'Better Luck Tomorrow 😬';

    // Emoji sequence
    let emojiStr = '';
    activeGame.clickOrder.forEach(c => { emojiStr += c.correct ? '🟢' : '🔴'; });
    document.getElementById('result-emoji').textContent = emojiStr;

    // Time
    document.getElementById('result-time').textContent = `⏱️ ${formatTime(activeGame.timeMs)}`;

    // Details
    if (activeGame.won) {
      const misses = config.takes - activeGame.takesLeft;
      if (misses === 0) {
        document.getElementById('result-details').textContent =
          `Perfect! All ${totalErrors} found with no misses.`;
      } else {
        document.getElementById('result-details').textContent =
          `Found all ${totalErrors} with ${misses} miss${misses === 1 ? '' : 'es'}. ${activeGame.takesLeft} take${activeGame.takesLeft === 1 ? '' : 's'} remaining.`;
      }
    } else {
      document.getElementById('result-details').textContent =
        `Found ${activeGame.found.length} of ${totalErrors} before running out of takes.`;
    }

    // Corrections list
    let html = '<h3>All Corrections</h3>';
    currentPuzzle.errors.forEach(error => {
      // Find the token index for this error
      let errIdx = -1;
      for (const [idx, e] of Object.entries(errorMap)) {
        if (e === error) { errIdx = parseInt(idx); break; }
      }
      const wasFound = activeGame.found.includes(errIdx);
      html += `<div class="correction-item">
        <span class="status-dot ${wasFound ? 'found' : 'missed'}"></span>
        <span class="wrong">${esc(error.wrong)}</span>
        <span class="arrow">→</span>
        <span class="right ${wasFound ? 'found-text' : 'missed-text'}">${esc(error.right[0])}</span>
      </div>`;
    });
    document.getElementById('corrections-reveal').innerHTML = html;

    // Countdown
    startCountdown();

    modal.classList.add('visible');

    // Submit score to leaderboard (fire-and-forget, don't block UI)
    maybeSubmitScore();
  }

  function startCountdown() {
    const timerEl = document.getElementById('next-puzzle-timer');
    function update() {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diff = tomorrow - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      timerEl.textContent = `Next puzzle in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    update();
    setInterval(update, 1000);
  }

  // ─── Share ────────────────────────────────────────────────────

  function generateShareText() {
    const config = DIFFICULTY_CONFIG[activeDifficulty];
    const stats = getStats();
    const ds = stats[activeDifficulty];

    let text = `MISCAST #${puzzleNumber} ${config.emoji} ${config.label.toUpperCase()}\n`;

    activeGame.clickOrder.forEach(c => { text += c.correct ? '🟢' : '🔴'; });
    text += ` ${activeGame.found.length}/${currentPuzzle.errors.length}`;
    text += ` ⏱️ ${formatTime(activeGame.timeMs)}\n`;

    if (activeGame.won) {
      text += '🎙️'.repeat(activeGame.takesLeft) + '⬛'.repeat(config.takes - activeGame.takesLeft);
    } else {
      text += '💀';
    }

    if (ds.currentStreak > 1) {
      text += `\n🔥 ${ds.currentStreak}-day streak`;
    }

    text += '\nmiscast.donecast.com';
    return text;
  }

  function shareResults() {
    const text = generateShareText();
    if (navigator.share) {
      navigator.share({ text }).catch(() => copyToClipboard(text));
    } else {
      copyToClipboard(text);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied to clipboard!');
    });
  }

  // ─── Stats Modal ──────────────────────────────────────────────

  function showStatsModal() {
    const stats = getStats();
    const winRate = stats.totalPlayed > 0 ? Math.round((stats.totalWon / stats.totalPlayed) * 100) : 0;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-item"><div class="stat-value">${stats.totalPlayed}</div><div class="stat-label">Played</div></div>
      <div class="stat-item"><div class="stat-value">${winRate}%</div><div class="stat-label">Win Rate</div></div>
      <div class="stat-item"><div class="stat-value">${stats.overallStreak}</div><div class="stat-label">Streak</div></div>
      <div class="stat-item"><div class="stat-value">${stats.maxOverallStreak}</div><div class="stat-label">Best Streak</div></div>
    `;

    let diffHtml = '';
    ['easy', 'medium', 'hard'].forEach(diff => {
      const ds = stats[diff];
      const config = DIFFICULTY_CONFIG[diff];
      const rate = ds.played > 0 ? Math.round((ds.won / ds.played) * 100) : 0;
      const best = ds.bestTimeMs ? formatTime(ds.bestTimeMs) : '—';
      diffHtml += `<div class="stats-diff-row">
        <span class="diff-name">${config.emoji} ${config.label}</span>
        <span class="diff-stats">${ds.won}/${ds.played} · ${rate}% · Best: ${best} · 🔥${ds.currentStreak}</span>
      </div>`;
    });

    document.getElementById('stats-difficulty-breakdown').innerHTML = diffHtml;
    document.getElementById('stats-modal').classList.add('visible');
  }

  // ─── Score Submission ─────────────────────────────────────────

  async function maybeSubmitScore() {
    if (!window.MiscastAuth || !MiscastAuth.isLoggedIn()) return;
    const game = activeGame;
    if (!game || !game.gameOver) return;

    // Build puzzle date string from today
    const puzzleDateStr = todayStr;

    try {
      const result = await MiscastAuth.submitScore({
        puzzle_date: puzzleDateStr,
        difficulty: activeDifficulty,
        found: game.found.length,
        total_errors: currentPuzzle.errors.length,
        takes_remaining: game.takesLeft,
        time_ms: game.timeMs,
        click_order: game.clickOrder,
        won: game.won,
      });

      if (result.rank) {
        const rankEl = document.getElementById('result-details');
        rankEl.innerHTML += `<br><span class="rank-badge">🏆 Rank #${result.rank} of ${result.total_players}</span>`;

        // Update local stats with leaderboard win
        if (result.rank === 1) {
          const stats = getStats();
          stats.leaderboardWins = (stats.leaderboardWins || 0) + 1;
          saveStats(stats);
        }
        if (result.rank <= 3) {
          const stats = getStats();
          stats.topThreeFinishes = (stats.topThreeFinishes || 0) + 1;
          saveStats(stats);
        }
      }

      // Prompt username setup if none yet
      const user = MiscastAuth.getUser();
      if (user && !user.game_username) {
        setTimeout(() => promptUsername(), 1200);
      }
    } catch (err) {
      console.warn('Score submission failed:', err.message);
    }
  }

  // ─── Leaderboard ──────────────────────────────────────────────

  let lbCurrentDiff = 'easy';

  function openLeaderboard() {
    const modal = document.getElementById('leaderboard-modal');
    modal.classList.add('visible');

    // Show/hide auth prompt
    const authPrompt = document.getElementById('lb-auth-prompt');
    if (MiscastAuth && MiscastAuth.isLoggedIn()) {
      authPrompt.style.display = 'none';
    } else {
      authPrompt.style.display = 'block';
    }

    loadLeaderboard(lbCurrentDiff);
  }

  async function loadLeaderboard(difficulty) {
    lbCurrentDiff = difficulty;

    // Update tab styles
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.diff === difficulty);
    });

    const loadingEl = document.getElementById('lb-loading');
    const entriesEl = document.getElementById('lb-entries');
    const emptyEl = document.getElementById('lb-empty');
    const errorEl = document.getElementById('lb-error');
    const rankEl = document.getElementById('lb-your-rank');

    loadingEl.style.display = 'block';
    entriesEl.innerHTML = '';
    emptyEl.style.display = 'none';
    errorEl.style.display = 'none';
    rankEl.style.display = 'none';

    try {
      const data = await MiscastAuth.getLeaderboard(difficulty);

      loadingEl.style.display = 'none';

      // Update date label
      const d = new Date(data.date + 'T00:00:00');
      document.getElementById('lb-date-label').textContent =
        `Results for ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;

      if (!data.entries || data.entries.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      const diffColors = { easy: 'var(--easy)', medium: 'var(--medium)', hard: 'var(--hard)' };
      const color = diffColors[difficulty];

      entriesEl.innerHTML = data.entries.map(e => {
        const time = formatTime(e.time_ms);
        const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
        const youStyle = e.is_you ? 'background:rgba(255,71,87,0.1);border:1px solid var(--accent);' : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;margin-bottom:4px;${youStyle}">
          <span style="font-size:1.1rem;min-width:28px;text-align:center">${medal}</span>
          <span style="flex:1;font-weight:${e.is_you ? '700' : '500'};color:${e.is_you ? 'var(--text-primary)' : 'var(--text-secondary)'}">${esc(e.username)}${e.is_you ? ' 👈' : ''}</span>
          <span style="color:${e.won ? color : 'var(--text-muted)'};font-size:0.85rem">${e.found}/${e.total_errors}</span>
          <span style="color:var(--text-muted);font-size:0.8rem;min-width:42px;text-align:right">${e.won ? time : '—'}</span>
        </div>`;
      }).join('');

      if (data.your_rank && !data.entries.some(e => e.is_you)) {
        rankEl.innerHTML = `Your rank: <strong>#${data.your_rank}</strong> of ${data.total_players} players`;
        rankEl.style.display = 'block';
      }
    } catch (err) {
      loadingEl.style.display = 'none';
      errorEl.textContent = err.message.includes('403')
        ? "Today's leaderboard isn't ready yet — come back tomorrow!"
        : 'Could not load leaderboard right now.';
      errorEl.style.display = 'block';
    }
  }

  // ─── Username Setup ───────────────────────────────────────────

  let usernameCheckTimeout = null;

  function promptUsername() {
    // Don't show if they already set one
    const user = MiscastAuth && MiscastAuth.getUser();
    if (user && user.game_username) return;
    if (!MiscastAuth || !MiscastAuth.isLoggedIn()) return;

    document.getElementById('username-modal').classList.add('visible');
  }

  function bindUsernameModal() {
    const input = document.getElementById('username-input');
    const feedback = document.getElementById('username-feedback');
    const saveBtn = document.getElementById('username-save-btn');
    const skipBtn = document.getElementById('username-skip-btn');

    if (!input) return;

    input.addEventListener('input', () => {
      clearTimeout(usernameCheckTimeout);
      const val = input.value.trim();

      if (val.length < 3) {
        feedback.textContent = val.length > 0 ? 'Too short (3 minimum)' : '';
        feedback.style.color = 'var(--accent)';
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(val)) {
        feedback.textContent = 'Letters, numbers, _ and - only';
        feedback.style.color = 'var(--accent)';
        return;
      }

      feedback.textContent = 'Checking...';
      feedback.style.color = 'var(--text-muted)';

      usernameCheckTimeout = setTimeout(async () => {
        try {
          const result = await MiscastAuth.checkUsername(val);
          if (result.available) {
            feedback.textContent = '✓ Available!';
            feedback.style.color = 'var(--correct)';
          } else {
            feedback.textContent = '✗ Already taken';
            feedback.style.color = 'var(--accent)';
          }
        } catch {
          feedback.textContent = '';
        }
      }, 400);
    });

    saveBtn.addEventListener('click', async () => {
      const val = input.value.trim();
      if (val.length < 3) return;

      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      try {
        await MiscastAuth.setUsername(val);
        await MiscastAuth.fetchProfile(); // Refresh user
        document.getElementById('username-modal').classList.remove('visible');
        showToast(`Username set: ${val} 🎉`);
      } catch (err) {
        feedback.textContent = err.message || 'Failed to save';
        feedback.style.color = 'var(--accent)';
        saveBtn.textContent = 'Save Username';
        saveBtn.disabled = false;
      }
    });

    skipBtn.addEventListener('click', () => {
      document.getElementById('username-modal').classList.remove('visible');
    });
  }

  // ─── Auth UI ──────────────────────────────────────────────────

  function updateAuthUI() {
    const isLoggedIn = MiscastAuth && MiscastAuth.isLoggedIn();
    const user = MiscastAuth && MiscastAuth.getUser();

    // Stats modal auth section
    const authSection = document.getElementById('stats-auth-section');
    if (authSection) {
      if (isLoggedIn) {
        const username = user && user.game_username;
        authSection.innerHTML = username
          ? `<div style="text-align:center;padding:12px;color:var(--text-secondary);font-size:0.85rem">Signed in as <strong style="color:var(--text-primary)">${esc(username)}</strong> · <a href="#" id="stats-logout" style="color:var(--accent)">Sign out</a></div>`
          : `<div style="text-align:center;padding:12px"><button id="set-username-btn" style="background:var(--accent);color:white;border:none;border-radius:var(--radius);padding:8px 20px;font-weight:700;cursor:pointer;font-family:var(--font);font-size:0.85rem">Set Username</button><span style="color:var(--text-muted);font-size:0.8rem;margin-left:10px">· <a href="#" id="stats-logout" style="color:var(--text-muted)">Sign out</a></span></div>`;

        document.getElementById('stats-logout')?.addEventListener('click', (e) => {
          e.preventDefault();
          MiscastAuth.logout();
          updateAuthUI();
        });
        document.getElementById('set-username-btn')?.addEventListener('click', () => {
          document.getElementById('stats-modal').classList.remove('visible');
          promptUsername();
        });
      } else {
        authSection.innerHTML = `<div style="text-align:center;padding:16px 0 4px">
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:10px">Sign in to track your stats &amp; join the leaderboard</p>
          <button id="stats-login-btn" style="background:white;color:#333;border:1px solid #dadce0;border-radius:var(--radius);padding:10px 20px;font-weight:500;cursor:pointer;font-family:var(--font);display:inline-flex;align-items:center;gap:8px;font-size:0.9rem">
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
            Sign in with Google
          </button>
        </div>`;
        document.getElementById('stats-login-btn')?.addEventListener('click', () => MiscastAuth.loginWithGoogle());
      }
    }

    // Leaderboard auth prompt
    const lbAuthPrompt = document.getElementById('lb-auth-prompt');
    if (lbAuthPrompt) {
      lbAuthPrompt.style.display = isLoggedIn ? 'none' : 'block';
    }
  }

  // ─── Auth Gate (first visit) ──────────────────────────────────

  function showAuthGate() {
    const overlay = document.createElement('div');
    overlay.id = 'auth-gate-overlay';
    overlay.className = 'auth-gate-overlay';
    overlay.innerHTML = `
      <div class="auth-gate-card">

        <div class="auth-gate-logo">MISCAST</div>
        <div class="auth-gate-tagline">🎙️ The Daily Podcast Puzzle</div>

        <p class="auth-gate-hook">Your AI transcription had a rough day.<br>Find the sound-alike imposters hiding in the transcript.</p>

        <div class="auth-gate-how">
          <div class="auth-gate-step"><span>👆</span><span>Tap a word you think is <strong>miscast</strong></span></div>
          <div class="auth-gate-step"><span>✏️</span><span>Type what it <strong>should</strong> be</span></div>
          <div class="auth-gate-step"><span>⏱️</span><span>Beat the clock · climb the leaderboard</span></div>
        </div>

        <div class="auth-gate-actions">

          <!-- Google -->
          <button id="auth-gate-google" class="auth-gate-google-btn">
            <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
            Sign in with Google
          </button>

          <!-- Divider -->
          <div class="auth-gate-divider"><span>or sign in with your DoneCast account</span></div>

          <!-- Email/password form -->
          <div class="auth-gate-form" id="auth-gate-form">
            <div class="auth-gate-donecast-note">Already have a DoneCast account? Same login works here.</div>
            <input type="email" id="auth-gate-email" placeholder="Email" autocomplete="email" autocapitalize="off">
            <input type="password" id="auth-gate-password" placeholder="Password" autocomplete="current-password">
            <div id="auth-gate-error" class="auth-gate-error" style="display:none"></div>
            <button id="auth-gate-submit" class="auth-gate-submit-btn">Sign In</button>
          </div>

          <div class="auth-gate-benefits">Save your scores · join the leaderboard · track your streak</div>
          <button id="auth-gate-anon" class="auth-gate-anon-btn">Play without an account →</button>
        </div>

        <div class="auth-gate-footer">Free daily puzzle by <a href="https://donecast.com" target="_blank">DoneCast</a></div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('auth-gate-google').addEventListener('click', () => {
      MiscastAuth.loginWithGoogle();
    });

    // Email/password login
    const submitBtn = document.getElementById('auth-gate-submit');
    const emailInput = document.getElementById('auth-gate-email');
    const passInput = document.getElementById('auth-gate-password');
    const errorEl = document.getElementById('auth-gate-error');

    async function doEmailLogin() {
      const email = emailInput.value.trim();
      const pass = passInput.value;
      if (!email || !pass) return;

      submitBtn.textContent = 'Signing in...';
      submitBtn.disabled = true;
      errorEl.style.display = 'none';

      try {
        await MiscastAuth.loginWithEmail(email, pass);
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          overlay.remove();
          updateAuthUI();
          renderMenu();
          if (!localStorage.getItem('miscast_visited_v2')) {
            showHowToPlay();
          }
        }, 300);
      } catch (err) {
        errorEl.textContent = err.message || 'Sign in failed';
        errorEl.style.display = 'block';
        submitBtn.textContent = 'Sign In';
        submitBtn.disabled = false;
        passInput.value = '';
        passInput.focus();
      }
    }

    submitBtn.addEventListener('click', doEmailLogin);
    passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doEmailLogin(); });
    emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passInput.focus(); });

    document.getElementById('auth-gate-anon').addEventListener('click', () => {
      localStorage.setItem('miscast_anon_choice', 'true');
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        overlay.remove();
        if (!localStorage.getItem('miscast_visited_v2')) {
          showHowToPlay();
        }
      }, 300);
    });
  }

  function showHowToPlay() {
    // Lightweight how-to-play on first actual game visit (after auth gate)
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.add('visible');
      localStorage.setItem('miscast_visited_v2', 'true');
      document.getElementById('help-close').addEventListener('click', () => {
        modal.classList.remove('visible');
      }, { once: true });
    }
  }

  // ─── Toast ────────────────────────────────────────────────────

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  // ─── Helpers ──────────────────────────────────────────────────

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Event Binding ────────────────────────────────────────────

  function bindGlobalEvents() {
    // Difficulty cards
    document.querySelectorAll('.diff-card').forEach(card => {
      card.addEventListener('click', () => {
        const diff = card.dataset.difficulty;
        if (diff) startGame(diff);
      });
    });

    // Title → back to menu
    document.querySelector('header h1').addEventListener('click', goToMenu);

    // Back button
    document.getElementById('back-btn').addEventListener('click', goToMenu);

    // Word clicks
    document.getElementById('passage').addEventListener('click', (e) => {
      const wordEl = e.target.closest('.word');
      if (!wordEl || !activeGame || activeGame.gameOver) return;
      if (wordEl.classList.contains('found')) return;

      const idx = parseInt(wordEl.dataset.index);
      if (isNaN(idx)) return;
      if (activeGame.misses.includes(idx)) {
        showToast('Already checked — this word is fine.');
        return;
      }
      showInputPanel(idx);
    });

    // Submit correction
    document.getElementById('submit-btn').addEventListener('click', submitCorrection);
    document.getElementById('correction-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitCorrection(); }
      if (e.key === 'Escape') hideInputPanel();
    });

    // Input panel backdrop
    document.querySelector('.panel-backdrop').addEventListener('click', hideInputPanel);
    document.getElementById('cancel-input').addEventListener('click', hideInputPanel);

    // Help
    document.getElementById('help-btn').addEventListener('click', () => {
      document.getElementById('help-modal').classList.add('visible');
    });
    document.getElementById('help-close').addEventListener('click', () => {
      document.getElementById('help-modal').classList.remove('visible');
    });

    // Stats
    document.getElementById('stats-btn').addEventListener('click', showStatsModal);
    document.getElementById('stats-close').addEventListener('click', () => {
      document.getElementById('stats-modal').classList.remove('visible');
    });

    // Share
    document.getElementById('share-btn').addEventListener('click', shareResults);

    // Results → back to menu
    document.getElementById('results-back-btn').addEventListener('click', () => {
      document.getElementById('game-over-modal').classList.remove('visible');
      goToMenu();
    });

    // Leaderboard button
    document.getElementById('lb-btn').addEventListener('click', openLeaderboard);
    document.getElementById('lb-close').addEventListener('click', () => {
      document.getElementById('leaderboard-modal').classList.remove('visible');
    });
    document.getElementById('lb-login-btn').addEventListener('click', () => MiscastAuth.loginWithGoogle());

    // Leaderboard difficulty tabs
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => loadLeaderboard(tab.dataset.diff));
    });

    // Username modal
    bindUsernameModal();

    // Close modals on backdrop
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('visible');
      });
    });

    // Auth change → update UI
    if (window.MiscastAuth) {
      MiscastAuth.onAuthChange(() => updateAuthUI());
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideInputPanel();
        document.querySelectorAll('.modal.visible').forEach(m => m.classList.remove('visible'));
      }
    });
  }

  function goToMenu() {
    stopTimer();
    hideInputPanel();
    document.querySelectorAll('.modal.visible').forEach(m => m.classList.remove('visible'));
    showScreen('menu');
    renderMenu();
  }

  // ─── Launch ───────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
