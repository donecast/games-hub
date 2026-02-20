// ═══════════════════════════════════════════════════════════════
// PODIUM — Game Engine
// Daily podcast ranking puzzle
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const STATE_KEY = 'podium_state_v1';
  const STATS_KEY = 'podium_stats_v1';
  const ANON_KEY = 'podium_anon_choice';
  const VISITED_KEY = 'podium_visited_v1';

  // ─── State ──────────────────────────────────────────────────

  let puzzle = null;           // Server puzzle data
  let state = {                // Today's play state
    date: null,
    submitted: false,
    score: null,
    timeSec: 0,
    userRanking: null,         // Array of item IDs in player's final order
    revealData: null,          // Full reveal from server
  };
  let stats = {                // All-time local stats
    gamesPlayed: 0,
    totalScore: 0,
    perfectScores: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
  };
  let timerInterval = null;
  let timerStarted = false;

  // Drag state
  let dragSrcIdx = null;
  let touchDragState = null;

  // ─── Persistence ───────────────────────────────────────────

  function loadState() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = getTodayStr();
        if (parsed.date === today) {
          state = parsed;
        }
      }
    } catch {}
  }

  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
  }

  function loadStats() {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      if (saved) stats = { ...stats, ...JSON.parse(saved) };
    } catch {}
  }

  function saveStats() {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
  }

  // ─── Utilities ─────────────────────────────────────────────

  function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast${type ? ' ' + type : ''}`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // ─── Scoring ───────────────────────────────────────────────

  /**
   * Pair-based Kendall tau scoring.
   * userOrder: array of item IDs in player's order
   * correctOrder: array of item IDs in correct order
   * Returns number of correct pairs (0-10 for 5 items)
   */
  function scorePairs(userOrder, correctOrder) {
    let correctPairs = 0;
    const n = userOrder.length; // 5
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ci = correctOrder.indexOf(userOrder[i]);
        const cj = correctOrder.indexOf(userOrder[j]);
        if (ci < cj) correctPairs++;
      }
    }
    return correctPairs;
  }

  /**
   * Get position diff for each item to determine emoji color.
   * Returns array of diffs in PLAYER's order.
   */
  function getPositionDiffs(userOrder, correctOrder) {
    return userOrder.map(id => {
      const playerPos = userOrder.indexOf(id);
      const correctPos = correctOrder.indexOf(id);
      return Math.abs(playerPos - correctPos);
    });
  }

  function diffToEmoji(diff) {
    if (diff === 0) return '🟩';
    if (diff === 1) return '🟨';
    if (diff === 2) return '🟧';
    return '🟥';
  }

  function scoreMedal(score) {
    if (score === 10) return '🥇';
    if (score >= 8) return '🥈';
    if (score >= 6) return '🥉';
    return '📻';
  }

  function scoreLabel(score) {
    if (score === 10) return 'Perfect PODIUM!';
    if (score >= 8) return 'Silver — Nearly there!';
    if (score >= 6) return 'Bronze — Good effort!';
    return 'Keep listening! 📻';
  }

  // ─── Timer ─────────────────────────────────────────────────

  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    timerInterval = setInterval(() => {
      state.timeSec++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateTimerDisplay() {
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatTime(state.timeSec);
  }

  // ─── Screens ───────────────────────────────────────────────

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${id}`);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
  }

  // ─── Auth Gate ─────────────────────────────────────────────

  function renderAuthGate() {
    showScreen('auth');
    // Attach listeners (only once)
    const gBtn = document.getElementById('btn-google-login');
    if (gBtn && !gBtn._bound) {
      gBtn._bound = true;
      gBtn.addEventListener('click', () => PodiumAuth.loginWithGoogle());
    }
    const anonBtn = document.getElementById('btn-play-anon');
    if (anonBtn && !anonBtn._bound) {
      anonBtn._bound = true;
      anonBtn.addEventListener('click', () => {
        localStorage.setItem(ANON_KEY, '1');
        initGame();
      });
    }
    const emailForm = document.getElementById('email-login-form');
    if (emailForm && !emailForm._bound) {
      emailForm._bound = true;
      emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-pass').value;
        const errEl = document.getElementById('auth-error');
        const submitBtn = emailForm.querySelector('button[type=submit]');
        errEl.textContent = '';
        submitBtn.disabled = true;
        try {
          await PodiumAuth.loginWithEmail(email, pass);
          initGame();
        } catch (err) {
          errEl.textContent = err.message || 'Login failed';
        } finally {
          submitBtn.disabled = false;
        }
      });
    }
  }

  // ─── How to Play ────────────────────────────────────────────

  function showHowToPlay() {
    document.getElementById('modal-howtoplay').classList.add('open');
  }

  function hideHowToPlay() {
    document.getElementById('modal-howtoplay').classList.remove('open');
    localStorage.setItem(VISITED_KEY, '1');
  }

  // ─── Menu Screen ────────────────────────────────────────────

  function renderMenu() {
    showScreen('menu');
    if (!puzzle) return;

    document.getElementById('menu-puzzle-number').textContent = `#${puzzle.puzzle_number}`;
    document.getElementById('menu-puzzle-emoji').textContent = puzzle.emoji;
    document.getElementById('menu-puzzle-question').textContent = puzzle.question;
    document.getElementById('menu-puzzle-direction').textContent = puzzle.direction;

    const playBtn = document.getElementById('btn-play-today');
    if (playBtn && !playBtn._bound) {
      playBtn._bound = true;
      playBtn.addEventListener('click', renderGameScreen);
    }
  }

  // ─── Game Screen ────────────────────────────────────────────

  function renderGameScreen() {
    if (!puzzle) return;
    showScreen('game');

    // Update puzzle info in header
    document.getElementById('game-puzzle-number').textContent = `#${puzzle.puzzle_number}`;
    document.getElementById('game-puzzle-date').textContent = formatDateDisplay(puzzle.date);
    document.getElementById('game-question-text').textContent = puzzle.question;
    document.getElementById('game-direction-label').textContent = puzzle.direction;

    // Populate rank anchors — split "Oldest → Newest" into start/end labels
    const dirParts = (puzzle.direction || '').split(/\s*[→\-–—>]+\s*/);
    const anchorStart = dirParts[0] || '';
    const anchorEnd = dirParts[1] || '';
    const topLbl = document.getElementById('anchor-top-label');
    const botLbl = document.getElementById('anchor-bottom-label');
    if (topLbl) topLbl.textContent = anchorStart ? `← ${anchorStart} goes here` : '';
    if (botLbl) botLbl.textContent = anchorEnd ? `${anchorEnd} goes here →` : '';

    // Restore timer
    updateTimerDisplay();

    if (state.submitted) {
      // Already played today — show results directly
      renderResults();
      return;
    }

    renderCards();
  }

  function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ─── Card Rendering ─────────────────────────────────────────

  function getItemOrder() {
    // Current order of item IDs based on card DOM order
    const cards = document.querySelectorAll('.card[data-id]');
    return Array.from(cards).map(c => c.dataset.id);
  }

  function renderCards() {
    const list = document.getElementById('cards-list');
    if (!list) return;
    list.innerHTML = '';

    const items = puzzle.items; // Already shuffled by server

    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = item.id;
      card.dataset.idx = idx;
      card.draggable = true;
      card.innerHTML = `
        <div class="card-handle" aria-label="Drag to reorder">⠿</div>
        <div class="card-name">${escapeHtml(item.name)}</div>
        <div class="card-value" id="val-${item.id}"></div>
        <div class="card-correct-indicator" id="ind-${item.id}"></div>
        <div class="card-rank">${idx + 1}</div>
      `;

      attachDragHandlers(card);
      list.appendChild(card);
    });

    updateRankNumbers();
  }

  function updateRankNumbers() {
    const cards = document.querySelectorAll('.card[data-id]');
    cards.forEach((card, idx) => {
      const rankEl = card.querySelector('.card-rank');
      if (rankEl) rankEl.textContent = idx + 1;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── Desktop Drag & Drop ─────────────────────────────────────

  function attachDragHandlers(card) {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('drop', onDrop);
    card.addEventListener('dragend', onDragEnd);
    card.addEventListener('dragenter', onDragEnter);
    card.addEventListener('dragleave', onDragLeave);

    // Touch events on the handle only
    const handle = card.querySelector('.card-handle');
    if (handle) {
      handle.addEventListener('touchstart', onTouchStart, { passive: false });
    }
  }

  function onDragStart(e) {
    if (state.submitted) { e.preventDefault(); return; }
    startTimer();
    dragSrcIdx = getCardIndex(e.currentTarget);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcIdx);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragEnter(e) {
    e.preventDefault();
    if (!e.currentTarget.classList.contains('dragging')) {
      e.currentTarget.classList.add('drag-over');
    }
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    const targetIdx = getCardIndex(target);

    if (dragSrcIdx !== null && dragSrcIdx !== targetIdx) {
      moveCard(dragSrcIdx, targetIdx);
    }
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
    dragSrcIdx = null;
  }

  function getCardIndex(card) {
    const list = document.getElementById('cards-list');
    return Array.from(list.children).indexOf(card);
  }

  function moveCard(fromIdx, toIdx) {
    const list = document.getElementById('cards-list');
    const cards = Array.from(list.children);
    const moving = cards[fromIdx];
    const reference = cards[toIdx];

    if (fromIdx < toIdx) {
      list.insertBefore(moving, reference.nextSibling);
    } else {
      list.insertBefore(moving, reference);
    }
    updateRankNumbers();
  }

  // ─── Touch Drag ──────────────────────────────────────────────

  function onTouchStart(e) {
    if (state.submitted) return;
    e.preventDefault();
    startTimer();

    const touch = e.touches[0];
    const card = e.currentTarget.closest('.card');
    const cardRect = card.getBoundingClientRect();

    touchDragState = {
      card,
      startY: touch.clientY,
      offsetY: touch.clientY - cardRect.top,
      startIndex: getCardIndex(card),
      lastY: touch.clientY,
    };

    card.classList.add('dragging');

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
  }

  function onTouchMove(e) {
    if (!touchDragState) return;
    e.preventDefault();

    const touch = e.touches[0];
    touchDragState.lastY = touch.clientY;

    // Find card under touch
    const list = document.getElementById('cards-list');
    const cards = Array.from(list.children);
    const currentIdx = getCardIndex(touchDragState.card);

    // Determine target by Y position relative to other cards
    let targetIdx = currentIdx;
    const y = touch.clientY;

    for (let i = 0; i < cards.length; i++) {
      if (cards[i] === touchDragState.card) continue;
      const rect = cards[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (i < currentIdx && y < mid) {
        targetIdx = i;
        break;
      }
      if (i > currentIdx && y > mid) {
        targetIdx = i;
      }
    }

    // Clear previous indicators
    cards.forEach(c => c.classList.remove('drag-over'));

    if (targetIdx !== currentIdx) {
      moveCard(currentIdx, targetIdx);
    }
  }

  function onTouchEnd(e) {
    if (!touchDragState) return;
    touchDragState.card.classList.remove('dragging');
    touchDragState = null;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchEnd);
    document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
  }

  // ─── Submit ──────────────────────────────────────────────────

  async function submitRanking() {
    if (state.submitted || !puzzle) return;

    stopTimer();
    state.submitted = true;
    state.date = getTodayStr();
    state.userRanking = getItemOrder();

    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    // ── Step 1: For anonymous players, fetch reveal first (no server-side state needed)
    // ── For logged-in players, submit score FIRST, then fetch reveal (API enforces this)
    let revealData = null;
    let score = 0;

    if (!PodiumAuth.isLoggedIn()) {
      // Anonymous: fetch reveal first (backend allows anon access), then calc score
      try {
        revealData = await PodiumAuth.getPuzzleReveal(state.date);
      } catch {}

      if (revealData && revealData.correct_order) {
        score = scorePairs(state.userRanking, revealData.correct_order);
      }

    } else {
      // Authenticated: fetch preliminary reveal to calculate score, then submit, then get full reveal
      try {
        const preReveal = await PodiumAuth.getPuzzleReveal(state.date);
        if (preReveal && preReveal.correct_order) {
          score = scorePairs(state.userRanking, preReveal.correct_order);
        }
      } catch {}

      // Submit score to server
      try {
        await PodiumAuth.submitScore({
          puzzle_date: state.date,
          score: score,
          time_ms: state.timeSec * 1000,
          user_ranking: state.userRanking,
        });
      } catch (err) {
        console.warn('Score submission failed:', err.message);
        // Continue anyway — player should still see their result
      }

      // Now fetch full reveal (auth user has submitted, so API allows it)
      try {
        revealData = await PodiumAuth.getPuzzleReveal(state.date);
      } catch (err) {
        console.warn('Reveal fetch failed:', err.message);
      }

      // Recalculate score from authoritative reveal
      if (revealData && revealData.correct_order) {
        score = scorePairs(state.userRanking, revealData.correct_order);
      }
    }

    state.revealData = revealData;
    state.score = score;

    // Update local stats
    updateLocalStats(score, state.date);
    saveState();

    // Reveal animation, then show results
    await runRevealAnimation(revealData);
    renderResults();
  }

  function updateLocalStats(score, dateStr) {
    const today = dateStr;
    const yesterday = (() => {
      const d = new Date(today + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    stats.gamesPlayed++;
    stats.totalScore += score;
    if (score === 10) stats.perfectScores++;

    if (stats.lastPlayedDate === yesterday) {
      stats.currentStreak++;
    } else if (stats.lastPlayedDate !== today) {
      stats.currentStreak = 1;
    }

    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
    stats.lastPlayedDate = today;
    saveStats();
  }

  // ─── Reveal Animation ────────────────────────────────────────

  async function runRevealAnimation(revealData) {
    return new Promise(resolve => {
      const list = document.getElementById('cards-list');
      if (!list) { resolve(); return; }

      const cards = Array.from(list.querySelectorAll('.card'));

      if (!revealData || !revealData.correct_order) {
        // No reveal data — just freeze cards
        resolve();
        return;
      }

      const correctOrder = revealData.correct_order;
      const correctItems = revealData.items; // items in correct order with values
      const userOrder = state.userRanking;

      // Build a map: id → item info
      const itemMap = {};
      correctItems.forEach((item, idx) => {
        itemMap[item.id] = { ...item, correctRank: idx + 1 };
      });

      // Reorder cards to correct positions with animation
      // Step 1: freeze cards visually for 300ms
      cards.forEach(c => {
        c.draggable = false;
        c.style.transition = 'none';
      });

      setTimeout(() => {
        // Step 2: rebuild list in correct order
        correctOrder.forEach((id, correctIdx) => {
          const card = list.querySelector(`.card[data-id="${id}"]`);
          if (card) {
            card.style.transition = 'all 0.4s ease';
            list.appendChild(card);
          }
        });

        // Step 3: update rank numbers and reveal values
        setTimeout(() => {
          const orderedCards = Array.from(list.querySelectorAll('.card'));
          orderedCards.forEach((card, idx) => {
            const id = card.dataset.id;
            const item = itemMap[id];
            if (!item) return;

            // Position diff
            const playerPos = userOrder.indexOf(id);
            const diff = Math.abs(playerPos - idx);

            // Color class
            card.classList.add('revealed');
            if (diff === 0) card.classList.add('reveal-correct');
            else if (diff === 1) card.classList.add('reveal-off1');
            else if (diff === 2) card.classList.add('reveal-off2');
            else card.classList.add('reveal-off3');

            // Update rank
            const rankEl = card.querySelector('.card-rank');
            if (rankEl) rankEl.textContent = idx + 1;

            // Reveal value with delay
            setTimeout(() => {
              const valEl = card.querySelector('.card-value');
              const indEl = card.querySelector('.card-correct-indicator');
              if (valEl) {
                valEl.textContent = item.display_value;
                valEl.classList.add('visible');
              }
              if (indEl) {
                indEl.textContent = diff === 0 ? '🟩' : diff === 1 ? '🟨' : diff === 2 ? '🟧' : '🟥';
                indEl.classList.add('visible');
              }
              if (diff === 0) {
                card.classList.add('pulse-correct');
              }
            }, idx * 120 + 100);
          });

          // Done after all reveals
          setTimeout(() => resolve(), correctOrder.length * 120 + 600);
        }, 150);
      }, 300);
    });
  }

  // ─── Results Screen ──────────────────────────────────────────

  function renderResults() {
    showScreen('results');

    const score = state.score !== null ? state.score : 0;
    const timeSec = state.timeSec;
    const revealData = state.revealData;
    const puzzle_ = puzzle;

    // Score display
    document.getElementById('results-puzzle-number').textContent =
      puzzle_ ? `PODIUM #${puzzle_.puzzle_number}` : 'PODIUM';
    document.getElementById('results-medal').textContent = scoreMedal(score);
    document.getElementById('results-score').textContent = `${score}/10`;
    document.getElementById('results-label').textContent = scoreLabel(score);
    document.getElementById('results-time').textContent = formatTime(timeSec);

    // Generate share text
    const shareText = buildShareText(score, timeSec, puzzle_, revealData);
    const shareEl = document.getElementById('share-text');
    if (shareEl) shareEl.textContent = shareText;

    // Fun fact
    if (revealData && revealData.fun_fact) {
      const ffEl = document.getElementById('fun-fact-text');
      if (ffEl) {
        ffEl.textContent = revealData.fun_fact;
        document.getElementById('fun-fact-box').style.display = 'block';
      }
    }

    // Animate score
    const scoreEl = document.getElementById('results-score');
    scoreEl.classList.add('animate');
    setTimeout(() => scoreEl.classList.remove('animate'), 500);

    // Wire up action buttons
    const shareBtn = document.getElementById('btn-share');
    if (shareBtn && !shareBtn._bound) {
      shareBtn._bound = true;
      shareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareText).then(() => {
          showToast('Copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Share text ready — copy it above!');
        });
      });
    }

    const lbBtn = document.getElementById('btn-view-leaderboard');
    if (lbBtn && !lbBtn._bound) {
      lbBtn._bound = true;
      lbBtn.addEventListener('click', renderLeaderboard);
    }
  }

  function buildShareText(score, timeSec, puzzleData, revealData) {
    const puzzleNum = puzzleData ? puzzleData.puzzle_number : '?';
    const direction = puzzleData ? puzzleData.direction : '';
    const category = puzzleData ? (puzzleData.category || '') : '';

    let emojiRow = '';
    if (revealData && revealData.correct_order && state.userRanking) {
      const diffs = getPositionDiffs(state.userRanking, revealData.correct_order);
      emojiRow = diffs.map(d => diffToEmoji(d)).join('');
    } else {
      emojiRow = '⬜⬜⬜⬜⬜';
    }

    const timeStr = formatTime(timeSec);
    const dirLine = direction ? `${direction}${category ? ': ' + category : ''}` : '';

    let text = `PODIUM #${puzzleNum} 🏆\n`;
    if (dirLine) text += `${dirLine}\n\n`;
    else text += '\n';
    text += `${emojiRow} — ${score}/10\n`;
    text += `⏱️ ${timeStr}\n`;
    text += `podium.donecast.com`;
    return text;
  }

  // ─── Leaderboard Screen ──────────────────────────────────────

  async function renderLeaderboard() {
    showScreen('leaderboard');
    document.getElementById('lb-loading').style.display = 'block';
    document.getElementById('lb-list').innerHTML = '';
    document.getElementById('lb-your-rank').style.display = 'none';

    try {
      const data = await PodiumAuth.getLeaderboard(state.date || getTodayStr());
      document.getElementById('lb-loading').style.display = 'none';

      if (!data.entries || data.entries.length === 0) {
        document.getElementById('lb-empty').style.display = 'block';
        return;
      }

      const list = document.getElementById('lb-list');
      data.entries.forEach(entry => {
        const el = document.createElement('div');
        el.className = `lb-entry${entry.is_you ? ' is-you' : ''}`;
        const rankLabel = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
        el.innerHTML = `
          <div class="lb-rank">${rankLabel}</div>
          <div class="lb-username">${escapeHtml(entry.username)}${entry.is_you ? ' <span style="color:var(--gold);font-size:0.75rem">(you)</span>' : ''}</div>
          <div class="lb-score">${entry.score}/10</div>
          <div class="lb-time">${formatTime(Math.round(entry.time_ms / 1000))}</div>
        `;
        list.appendChild(el);
      });

      if (data.your_rank && data.total_players) {
        const yrEl = document.getElementById('lb-your-rank');
        yrEl.style.display = 'block';
        yrEl.innerHTML = `Your rank: <strong>#${data.your_rank}</strong> of ${data.total_players} players`;
      }

      document.getElementById('lb-total').textContent = `${data.total_players} players today`;

    } catch (err) {
      document.getElementById('lb-loading').style.display = 'none';
      document.getElementById('lb-error').style.display = 'block';
      document.getElementById('lb-error').textContent = PodiumAuth.isLoggedIn()
        ? 'Could not load leaderboard.'
        : 'Sign in to see the leaderboard!';
    }
  }

  // ─── Stats Screen ────────────────────────────────────────────

  async function renderStats() {
    showScreen('stats');

    // Start with local stats
    document.getElementById('stat-played').textContent = stats.gamesPlayed;
    const localAvg = stats.gamesPlayed > 0
      ? (stats.totalScore / stats.gamesPlayed).toFixed(1)
      : '—';
    document.getElementById('stat-avg').textContent = localAvg;
    document.getElementById('stat-perfect').textContent = stats.perfectScores;
    document.getElementById('stat-streak').textContent = stats.currentStreak;
    document.getElementById('stat-max-streak').textContent = stats.maxStreak;

    // If logged in, fetch server stats (more accurate)
    if (PodiumAuth.isLoggedIn()) {
      try {
        const serverStats = await PodiumAuth.getStats();
        document.getElementById('stat-played').textContent = serverStats.games_played;
        document.getElementById('stat-avg').textContent =
          serverStats.avg_score > 0 ? serverStats.avg_score.toFixed(1) : '—';
        document.getElementById('stat-perfect').textContent = serverStats.perfect_scores;
        document.getElementById('stat-streak').textContent = serverStats.current_streak;
        document.getElementById('stat-max-streak').textContent = serverStats.max_streak;
        if (serverStats.best_time_ms) {
          document.getElementById('stat-best-time').textContent =
            formatTime(Math.round(serverStats.best_time_ms / 1000));
        }
      } catch {}
    }
  }

  // ─── Username Modal ───────────────────────────────────────────

  function showUsernameModal() {
    document.getElementById('modal-username').classList.add('open');
    const input = document.getElementById('username-input');
    if (input) {
      const user = PodiumAuth.getUser();
      if (user && user.game_username) input.value = user.game_username;
      input.focus();
    }
  }

  function hideUsernameModal() {
    document.getElementById('modal-username').classList.remove('open');
  }

  // ─── Init ────────────────────────────────────────────────────

  async function initGame() {
    // Load today's puzzle
    showScreen('loading');

    try {
      puzzle = await PodiumAuth.getPuzzleToday();
    } catch (err) {
      // Show error
      document.getElementById('loading-msg').textContent =
        'No puzzle available today. Check back tomorrow!';
      return;
    }

    // Load saved state
    loadState();

    if (state.submitted && state.date === getTodayStr()) {
      // Already played today — go to results
      renderResults();
      return;
    }

    // First visit — show how to play
    if (!localStorage.getItem(VISITED_KEY)) {
      showHowToPlay();
    }

    renderMenu();
  }

  // ─── Bootstrap ───────────────────────────────────────────────

  async function boot() {
    loadState();
    loadStats();

    // Check if already authed or anon
    const isAnon = localStorage.getItem(ANON_KEY);

    if (PodiumAuth.isLoggedIn()) {
      // Load profile lazily
      PodiumAuth.fetchProfile().catch(() => {});
      await initGame();
    } else if (isAnon) {
      await initGame();
    } else {
      renderAuthGate();
    }
  }

  // ─── Event Wiring ─────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    // How to play
    document.getElementById('btn-howtoplay')?.addEventListener('click', showHowToPlay);
    document.getElementById('btn-howtoplay-close')?.addEventListener('click', hideHowToPlay);
    document.getElementById('btn-howtoplay-got-it')?.addEventListener('click', hideHowToPlay);
    document.getElementById('modal-howtoplay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideHowToPlay();
    });

    // Stats button in header
    document.getElementById('btn-stats')?.addEventListener('click', () => {
      renderStats();
    });

    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target || 'menu';
        if (target === 'menu' && puzzle) renderMenu();
        else if (target === 'results') renderResults();
        else showScreen(target);
      });
    });

    // Submit button
    document.getElementById('btn-submit')?.addEventListener('click', submitRanking);

    // Username modal
    document.getElementById('btn-set-username')?.addEventListener('click', showUsernameModal);
    document.getElementById('btn-username-close')?.addEventListener('click', hideUsernameModal);
    document.getElementById('modal-username')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideUsernameModal();
    });

    const usernameForm = document.getElementById('username-form');
    if (usernameForm) {
      usernameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('username-input');
        const errEl = document.getElementById('username-error');
        const username = input.value.trim();
        errEl.textContent = '';

        if (!username || username.length < 2) {
          errEl.textContent = 'Username must be at least 2 characters';
          return;
        }
        if (username.length > 20) {
          errEl.textContent = 'Username must be 20 characters or less';
          return;
        }

        try {
          await PodiumAuth.setUsername(username);
          showToast('Username saved!', 'success');
          hideUsernameModal();
          PodiumAuth.fetchProfile().catch(() => {});
        } catch (err) {
          errEl.textContent = err.message || 'Could not set username';
        }
      });
    }

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      PodiumAuth.logout();
      localStorage.removeItem(ANON_KEY);
      location.reload();
    });

    // Sign in from results/other screens
    document.querySelectorAll('.btn-sign-in-now').forEach(btn => {
      btn.addEventListener('click', () => PodiumAuth.loginWithGoogle());
    });

    // Start the game
    boot();
  });

})();
