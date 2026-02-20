# PODIUM 🏆

**The Daily Podcast Ranking Game**  
Live at: `podium.donecast.com`

---

## What is PODIUM?

Players rank 5 podcast-related items on a given dimension (oldest to newest, cheapest to most expensive, etc.). Scoring is pair-based (Kendall tau): 10 possible pairs, +1 for each correct relative ordering. Perfect score = 10/10.

---

## Structure

```
podium/
├── index.html              # Full SPA (auth gate, game, results, leaderboard, stats)
├── style.css               # Warm gold theme (#f5c518)
├── game.js                 # Game engine (drag-drop, scoring, reveal animation)
├── auth.js                 # DoneCast OAuth + API client
├── auth-callback.html      # OAuth return page
├── SPEC.md                 # Full game design specification
└── scripts/
    ├── seed_puzzles.py      # Seed 7-day launch buffer (idempotent)
    ├── generate_puzzle.py   # Daily AI puzzle generator (cron at 4 AM PT)
    ├── validate_puzzle.py   # Daily puzzle validator (cron at 5 AM PT)
    └── GENERATION_PROMPT.md # Cron agent instructions
```

Backend files in `donecast/`:
```
backend/api/models/podium.py                # DB models + Pydantic schemas
backend/api/routers/game/podium_puzzles.py  # GET /game/podium/puzzle/{today,reveal}
backend/api/routers/game/podium_scores.py   # POST /game/podium/score, GET leaderboard/stats
backend/api/routers/game/__init__.py        # Updated to include PODIUM routers
backend/migrations/142_podium_game.py       # Creates podium_puzzle, podium_score, podium_stat
```

---

## Deployment

### 1. Run the migration

```bash
cd donecast/backend
PYTHONPATH=. python3 migrations/142_podium_game.py
```

### 2. Seed launch buffer (7 days)

```bash
PYTHONPATH=. python3 /path/to/podium/scripts/seed_puzzles.py --start-date 2026-03-01
```

### 3. Deploy backend

Backend deploys automatically with main branch pushes to GCS.

### 4. Deploy frontend

Deploy to Cloudflare Pages (`podium` project), custom domain `podium.donecast.com`.

### 5. Activate crons

Crons are already in `scott-dashboard/data/crons.json` (both `enabled: true`):
- **PODIUM Daily Puzzle Generation** — 4 AM PT
- **PODIUM Puzzle Validation** — 5 AM PT

---

## API Endpoints

All prefixed with `/api/game/podium/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/puzzle/today` | Today's puzzle (shuffled, no answers) |
| GET | `/puzzle/reveal?puzzle_date=YYYY-MM-DD` | Full reveal with values (post-submit for auth users) |
| POST | `/score` | Submit score (auth required; idempotent) |
| GET | `/leaderboard?puzzle_date=YYYY-MM-DD` | Top 20 for given date |
| GET | `/stats` | Personal stats (auth required) |
| POST | `/game/username` | Set display name (shared with MISCAST) |

---

## Scoring

```javascript
// Kendall tau pair scoring
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
  return correctPairs; // 0-10
}
```

| Score | Medal |
|-------|-------|
| 10/10 | 🥇 Perfect PODIUM |
| 8-9   | 🥈 Silver |
| 6-7   | 🥉 Bronze |
| 0-5   | 📻 Keep Listening |

---

## Puzzle Generation

Puzzles are generated daily at 4 AM PT using Google Gemini (via DoneCast's Vertex AI):

```bash
cd donecast/backend
PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py --verbose
PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py --date 2026-03-01 --dry-run
PYTHONPATH=. python3 ../podium/scripts/validate_puzzle.py
```

The generator:
- Queries recent categories to avoid repetition  
- Retries up to 4 times with self-correcting prompts on validation failures
- Sends openclaw alert if all attempts fail
