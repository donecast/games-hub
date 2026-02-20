Build the PODIUM game — a daily podcast ranking puzzle. Full spec is in SPEC.md in this directory. Read it first.

## Summary of what to build

PODIUM is a daily game where players rank 5 podcast-related items on a given dimension (oldest to newest, shortest to longest, etc.). Score = number of correct pairs out of 10 (Kendall tau distance). Different skill set from MISCAST (estimation + reasoning vs phonetics). Deployed at podium.donecast.com.

## Files to create

### In /home/scott/.openclaw/workspace/podium/ (the CURRENT directory):
- index.html
- style.css  
- game.js
- auth.js
- auth-callback.html
- scripts/seed_puzzles.py
- scripts/generate_puzzle.py

### In /home/scott/.openclaw/workspace/donecast/ (DoneCast project):
- backend/api/models/podium.py
- backend/api/routers/game/podium_puzzles.py
- backend/api/routers/game/podium_scores.py
- backend/api/routers/game/__init__.py  (UPDATE this to include podium routers)
- backend/migrations/142_podium_game.py

## Reference files to study first
- /home/scott/.openclaw/workspace/miscast/auth.js  → adapt into podium/auth.js (change keys, URLs, game name)
- /home/scott/.openclaw/workspace/miscast/auth-callback.html → adapt for podium
- /home/scott/.openclaw/workspace/donecast/backend/api/models/game.py → reference for DB model patterns
- /home/scott/.openclaw/workspace/donecast/backend/api/routers/game/puzzles.py → reference for API pattern
- /home/scott/.openclaw/workspace/donecast/backend/api/routers/game/__init__.py → need to update this
- /home/scott/.openclaw/workspace/donecast/backend/migrations/140_miscast_game_tables.py → reference for migration pattern

## Key implementation details

### Frontend (index.html + style.css + game.js)

**Color palette (warm gold — distinct from MISCAST's cool navy):**
```
--bg-deep: #0a0800
--bg-card: #1a1300
--bg-card-hover: #2a2100
--bg-surface: #241c00
--gold: #f5c518
--amber: #ff9500
--gold-light: #ffe47a
--text-main: #f0e6cc
--text-dim: #a89060
--border: #3d2e00
```

**Game flow:**
1. Auth gate (if not logged in) — same UX as MISCAST
2. How-to-play modal (first visit)
3. Game screen: 5 draggable cards + question + timer (counts up)
4. Submit button → reveal animation → score + share

**Scoring (CRITICAL — implement correctly):**
```javascript
function scorePairs(userOrder, correctOrder) {
  // userOrder and correctOrder are arrays of item IDs
  // correctOrder[0] = correct first, correctOrder[4] = correct last
  let correctPairs = 0;
  const n = userOrder.length; // 5
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Find positions of userOrder[i] and userOrder[j] in correctOrder
      const ci = correctOrder.indexOf(userOrder[i]);
      const cj = correctOrder.indexOf(userOrder[j]);
      if (ci < cj) correctPairs++; // same relative order = correct pair
    }
  }
  return correctPairs; // 0–10
}
```

**Share format:**
```
PODIUM #42 🏆
Oldest → Newest: Podcast Launch Years
🟩🟨🟥🟩🟩 — 8/10
podium.donecast.com
```
Emoji key: 🟩=correct position, 🟨=1 off, 🟧=2 off, 🟥=3+ off (based on player's ordering)

**Drag and drop:**
- Desktop: HTML5 DnD API (dragstart, dragover, drop, dragend)
- Mobile: touchstart/touchmove/touchend on drag handle
- Drag handle: ⠿ icon (or 3 horizontal lines), min 48px touch target
- On drag lift: scale(1.05) + shadow
- Cards show rank number on right side (1-5)

**Reveal animation:**
- After submit: disable button, freeze cards
- Cards animate to correct positions with CSS transition
- Each card reveals its actual value (e.g., "2008") after settling
- Score counts up from 0 → final
- Fun fact appears at bottom

**LocalStorage keys:**
- `podium_state_v1` — today's play state (includes date, submitted, score, userRanking)
- `podium_stats_v1` — all-time stats
- `podium_anon_choice` — chose anonymous play
- `podium_visited_v1` — has seen how-to-play

**API base:** `https://api.donecast.com/api` (same as MISCAST)

### auth.js (adapt from MISCAST):
- Change `MiscastAuth` → `PodiumAuth`
- Change storage keys: `miscast_auth_token` → `podium_auth_token`, etc.
- Change game API calls: `/game/score` → `/game/podium/score`, `/game/leaderboard` → `/game/podium/leaderboard`, `/game/stats` → `/game/podium/stats`
- Change `/game/username` → `/game/podium/username`
- Export as `window.PodiumAuth`

### auth-callback.html:
- Same as MISCAST but change `MiscastAuth` → `PodiumAuth`
- Change title to "PODIUM — Logging In..."
- Use gold color theme (#f5c518) for spinner

### Backend models (podium.py):
```python
class PodiumPuzzle(SQLModel, table=True):
    __tablename__ = "podium_puzzle"
    id: Optional[int] = Field(default=None, primary_key=True)
    puzzle_date: date = Field(index=True, unique=True)
    puzzle_number: int
    question: str           # "Rank these podcasts OLDEST to NEWEST"
    direction: str          # "Oldest → Newest"
    category: Optional[str] = None   # "Launch Years"
    emoji: str = "🎙️"
    fun_fact: Optional[str] = None
    items_json: str         # JSON: [{"id":"a","name":"...","sort_value":2008,"display_value":"2008"}] CORRECT ORDER
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class PodiumScore(SQLModel, table=True):
    __tablename__ = "podium_score"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    puzzle_date: date
    score: int              # 0–10
    time_ms: int
    user_ranking_json: Optional[str] = None  # JSON: ["a","c","b","d","e"]
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    # Unique constraint: one score per user per day

class PodiumStat(SQLModel, table=True):
    __tablename__ = "podium_stat"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", unique=True, index=True)
    games_played: int = 0
    total_score: int = 0
    perfect_scores: int = 0
    current_streak: int = 0
    max_streak: int = 0
    best_time_ms: Optional[int] = None
    last_played_date: Optional[date] = None
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
```

### API endpoints (podium_puzzles.py):

```
GET /game/podium/puzzle/today
→ Returns shuffled items (same shuffle for all players, deterministic by date)
→ Shuffle: use date as seed, Fisher-Yates
→ Response: {date, puzzle_number, question, direction, emoji, category, items: [{id, name}]}
→ NOTE: items returned in SHUFFLED order, no sort_value or display_value (that's the puzzle!)

GET /game/podium/puzzle/reveal?puzzle_date=YYYY-MM-DD
→ Only return if score already submitted for this date (or date is in past)
→ Returns full items with sort_value and display_value, plus fun_fact
→ Returns correct order of IDs

POST /game/podium/score
→ Body: {puzzle_date, score, time_ms, user_ranking: ["a","c","b","d","e"]}
→ Requires auth (anonymous = skip leaderboard, return 200 with no rank)
→ One submission per user per day (return existing score if duplicate)
→ Returns {rank, total_players, your_score, avg_score}

GET /game/podium/leaderboard?puzzle_date=YYYY-MM-DD
→ Top 20 by score desc, time_ms asc
→ Include player's rank if authed
→ Entry: {rank, username, score, time_ms, is_you}

GET /game/podium/stats  (requires auth)
→ {games_played, avg_score, perfect_scores, current_streak, max_streak, best_time_ms}

POST /game/podium/username  (same as MISCAST, reuse that endpoint)
```

### Deterministic shuffle for puzzle items:
```python
import random
def shuffle_items(items: list, puzzle_date: date) -> list:
    """Deterministic shuffle by date so all players see same order."""
    seed = int(puzzle_date.strftime("%Y%m%d"))
    rng = random.Random(seed)
    shuffled = items.copy()
    rng.shuffle(shuffled)
    return shuffled
```

### Migration (142_podium_game.py):
Follow same pattern as 140_miscast_game_tables.py. Create the three tables above.
Add UniqueConstraint on (user_id, puzzle_date) for PodiumScore.

### Update __init__.py for game router:
Add podium routers — import and include them alongside existing MISCAST routers.

## Puzzle seed data (30 days)

In scripts/seed_puzzles.py, create a Python script that inserts these puzzles via SQLAlchemy/SQLModel directly. Use DATABASE_URL from environment. Start puzzle_number at 1.

The seed script should be IDEMPOTENT (don't insert if date already exists).

Here are all 30 puzzles:

```python
PUZZLES = [
    {
        "puzzle_number": 1,
        "question": "Rank these podcasts OLDEST to NEWEST (by first episode date)",
        "direction": "Oldest → Newest",
        "category": "Launch Years",
        "emoji": "📅",
        "fun_fact": "Stuff You Should Know launched in 2008 and has since released over 1,800 episodes — one of the most prolific podcasts ever made.",
        "items": [
            {"id": "a", "name": "Stuff You Should Know", "sort_value": 2008, "display_value": "2008"},
            {"id": "b", "name": "WTF with Marc Maron", "sort_value": 2009, "display_value": "2009"},
            {"id": "c", "name": "Serial", "sort_value": 2014, "display_value": "2014"},
            {"id": "d", "name": "Crime Junkie", "sort_value": 2017, "display_value": "2017"},
            {"id": "e", "name": "Conan O'Brien Needs a Friend", "sort_value": 2018, "display_value": "2018"},
        ]
    },
    {
        "puzzle_number": 2,
        "question": "Rank by AVERAGE episode length, SHORTEST to LONGEST",
        "direction": "Shortest → Longest",
        "category": "Episode Length",
        "emoji": "⏱️",
        "fun_fact": "Dan Carlin's Hardcore History episodes average around 6 hours each. His Blueprint for Armageddon WWI series clocks over 23 hours across 6 episodes.",
        "items": [
            {"id": "a", "name": "Up First (NPR)", "sort_value": 12, "display_value": "~12 min"},
            {"id": "b", "name": "The Daily (NYT)", "sort_value": 25, "display_value": "~25 min"},
            {"id": "c", "name": "Crime Junkie", "sort_value": 50, "display_value": "~50 min"},
            {"id": "d", "name": "Armchair Expert", "sort_value": 100, "display_value": "~100 min"},
            {"id": "e", "name": "Hardcore History", "sort_value": 360, "display_value": "~6 hours"},
        ]
    },
    {
        "puzzle_number": 3,
        "question": "Put these podcasting MILESTONES in chronological order",
        "direction": "Earliest → Latest",
        "category": "Podcast History",
        "emoji": "🏛️",
        "fun_fact": "When Apple added podcasts to iTunes in 2005, the word 'podcast' was so new that Steve Jobs had to explain what one was during the keynote announcement.",
        "items": [
            {"id": "a", "name": "iPodder (first podcast aggregator) launches", "sort_value": 2004, "display_value": "2004"},
            {"id": "b", "name": "Apple adds podcasts to iTunes 4.9", "sort_value": 2005, "display_value": "2005"},
            {"id": "c", "name": "Marc Maron interviews Obama in his garage", "sort_value": 2015, "display_value": "2015"},
            {"id": "d", "name": "Spotify acquires Gimlet Media (~$230M)", "sort_value": 2019, "display_value": "2019"},
            {"id": "e", "name": "Joe Rogan signs $100M Spotify exclusive", "sort_value": 2020, "display_value": "2020"},
        ]
    },
    {
        "puzzle_number": 4,
        "question": "Rank these podcast apps/platforms OLDEST to NEWEST (by launch year)",
        "direction": "Oldest → Newest",
        "category": "Podcast Apps",
        "emoji": "📱",
        "fun_fact": "Libsyn (Liberated Syndication), founded in 2004, is the oldest podcast hosting company still operating today.",
        "items": [
            {"id": "a", "name": "Libsyn (podcast hosting)", "sort_value": 2004, "display_value": "2004"},
            {"id": "b", "name": "Stitcher", "sort_value": 2008, "display_value": "2008"},
            {"id": "c", "name": "Pocket Casts", "sort_value": 2010, "display_value": "2010"},
            {"id": "d", "name": "Overcast", "sort_value": 2014, "display_value": "2014"},
            {"id": "e", "name": "Anchor (now Spotify for Podcasters)", "sort_value": 2015, "display_value": "2015"},
        ]
    },
    {
        "puzzle_number": 5,
        "question": "Rank these TRUE CRIME podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "True Crime",
        "emoji": "🔍",
        "fun_fact": "Crime Junkie became one of the fastest-growing podcasts ever, rocketing into the Apple Podcasts top 10 within just weeks of its 2017 launch.",
        "items": [
            {"id": "a", "name": "Sword and Scale", "sort_value": 2013, "display_value": "2013"},
            {"id": "b", "name": "My Favorite Murder", "sort_value": 2016, "display_value": "2016"},
            {"id": "c", "name": "Crime Junkie", "sort_value": 2017, "display_value": "2017"},
            {"id": "d", "name": "Dr. Death", "sort_value": 2018, "display_value": "2018"},
            {"id": "e", "name": "Your Own Backyard", "sort_value": 2019, "display_value": "2019"},
        ]
    },
    {
        "puzzle_number": 6,
        "question": "Rank these COMEDY podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Comedy",
        "emoji": "😂",
        "fun_fact": "When The Adam Carolla Show launched in February 2009, it broke the Guinness World Record for Most Downloaded Podcast with 1.6 million downloads in its first month.",
        "items": [
            {"id": "a", "name": "The Adam Carolla Show", "sort_value": 2009, "display_value": "2009"},
            {"id": "b", "name": "Comedy Bang Bang", "sort_value": 2009, "display_value": "2009 (Feb)"},
            {"id": "c", "name": "My Brother, My Brother and Me", "sort_value": 2010, "display_value": "2010"},
            {"id": "d", "name": "How Did This Get Made?", "sort_value": 2010, "display_value": "2010 (Apr)"},
            {"id": "e", "name": "Conan O'Brien Needs a Friend", "sort_value": 2018, "display_value": "2018"},
        ]
    },
    {
        "puzzle_number": 7,
        "question": "Rank these podcast microphones CHEAPEST to MOST EXPENSIVE (approximate retail price)",
        "direction": "Cheapest → Most Expensive",
        "category": "Gear",
        "emoji": "🎙️",
        "fun_fact": "The Shure SM7B became so synonymous with podcasting that it's often called 'the podcast mic' — even though it was designed for broadcast radio and Michael Jackson recorded Thriller with one.",
        "items": [
            {"id": "a", "name": "Audio-Technica AT2020", "sort_value": 99, "display_value": "~$99"},
            {"id": "b", "name": "Blue Yeti", "sort_value": 129, "display_value": "~$129"},
            {"id": "c", "name": "Rode NT-USB", "sort_value": 169, "display_value": "~$169"},
            {"id": "d", "name": "Shure SM7B", "sort_value": 399, "display_value": "~$399"},
            {"id": "e", "name": "Electro-Voice RE20", "sort_value": 449, "display_value": "~$449"},
        ]
    },
    {
        "puzzle_number": 8,
        "question": "Rank these podcast hosts OLDEST to YOUNGEST (by birth year)",
        "direction": "Oldest → Youngest",
        "category": "Host Ages",
        "emoji": "🎂",
        "fun_fact": "Terry Gross has hosted Fresh Air since 1975 — over 50 years. The show moved to podcast format in 2006, making her one of the longest-tenured podcast hosts in history.",
        "items": [
            {"id": "a", "name": "Terry Gross (Fresh Air)", "sort_value": 1951, "display_value": "b. 1951"},
            {"id": "b", "name": "Ira Glass (This American Life)", "sort_value": 1959, "display_value": "b. 1959"},
            {"id": "c", "name": "Marc Maron (WTF)", "sort_value": 1963, "display_value": "b. 1963"},
            {"id": "d", "name": "Joe Rogan (JRE)", "sort_value": 1967, "display_value": "b. 1967"},
            {"id": "e", "name": "Alex Cooper (Call Her Daddy)", "sort_value": 1994, "display_value": "b. 1994"},
        ]
    },
    {
        "puzzle_number": 9,
        "question": "Rank these podcast-to-TV/streaming ADAPTATIONS by premiere year",
        "direction": "Earliest → Latest",
        "category": "Podcast → Screen",
        "emoji": "🎬",
        "fun_fact": "Lore was the first major podcast-to-TV adaptation, premiering on Amazon Prime in 2017. Since then, podcasts have become one of Hollywood's hottest IP sources.",
        "items": [
            {"id": "a", "name": "Lore (Amazon Prime)", "sort_value": 2017, "display_value": "2017"},
            {"id": "b", "name": "Dirty John (Bravo)", "sort_value": 2018, "display_value": "2018"},
            {"id": "c", "name": "Limetown (Facebook Watch)", "sort_value": 2019, "display_value": "2019"},
            {"id": "d", "name": "Dr. Death (Peacock)", "sort_value": 2021, "display_value": "2021"},
            {"id": "e", "name": "The Shrink Next Door (Apple TV+)", "sort_value": 2021, "display_value": "2021 (Nov)"},
        ]
    },
    {
        "puzzle_number": 10,
        "question": "Rank these podcast EDITING TOOLS by year first released",
        "direction": "Oldest → Newest",
        "category": "Production Tools",
        "emoji": "🎛️",
        "fun_fact": "Descript, launched in 2017, introduced the revolutionary idea of editing audio by editing a text transcript — a concept that fundamentally changed podcast production.",
        "items": [
            {"id": "a", "name": "Audacity", "sort_value": 2000, "display_value": "2000"},
            {"id": "b", "name": "Adobe Audition", "sort_value": 2003, "display_value": "2003"},
            {"id": "c", "name": "GarageBand", "sort_value": 2004, "display_value": "2004"},
            {"id": "d", "name": "Hindenburg Journalist", "sort_value": 2008, "display_value": "2008"},
            {"id": "e", "name": "Descript", "sort_value": 2017, "display_value": "2017"},
        ]
    },
    {
        "puzzle_number": 11,
        "question": "Rank these NPR shows OLDEST to NEWEST as podcasts",
        "direction": "Oldest → Newest",
        "category": "NPR Shows",
        "emoji": "📻",
        "fun_fact": "This American Life was one of the first major radio programs to embrace podcasting, launching its RSS feed in 2006 and helping legitimize the medium.",
        "items": [
            {"id": "a", "name": "Fresh Air", "sort_value": 2006, "display_value": "2006"},
            {"id": "b", "name": "This American Life", "sort_value": 2006, "display_value": "2006 (Jun)"},
            {"id": "c", "name": "Radiolab", "sort_value": 2007, "display_value": "2007"},
            {"id": "d", "name": "Planet Money", "sort_value": 2008, "display_value": "2008"},
            {"id": "e", "name": "Up First", "sort_value": 2017, "display_value": "2017"},
        ]
    },
    {
        "puzzle_number": 12,
        "question": "Rank these podcast NETWORKS by year founded",
        "direction": "Oldest → Newest",
        "category": "Podcast Networks",
        "emoji": "🏢",
        "fun_fact": "Wondery, founded in 2016, grew so fast it was acquired by Amazon for a reported $300M in 2020 — just four years after launch.",
        "items": [
            {"id": "a", "name": "Earwolf", "sort_value": 2010, "display_value": "2010"},
            {"id": "b", "name": "Gimlet Media", "sort_value": 2014, "display_value": "2014"},
            {"id": "c", "name": "Wondery", "sort_value": 2016, "display_value": "2016"},
            {"id": "d", "name": "Exactly Right (Karen Kilgariff & Georgia Hardstark)", "sort_value": 2018, "display_value": "2018"},
            {"id": "e", "name": "SiriusXM Podcast Network", "sort_value": 2021, "display_value": "2021"},
        ]
    },
    {
        "puzzle_number": 13,
        "question": "Rank these BUSINESS & ENTREPRENEURSHIP podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Business Podcasts",
        "emoji": "💼",
        "fun_fact": "How I Built This has become the go-to show for startup origin stories. Host Guy Raz has interviewed nearly every major entrepreneur — from the founders of Instagram to Spanx.",
        "items": [
            {"id": "a", "name": "The Tim Ferriss Show", "sort_value": 2014, "display_value": "2014"},
            {"id": "b", "name": "How I Built This", "sort_value": 2016, "display_value": "2016"},
            {"id": "c", "name": "Masters of Scale", "sort_value": 2017, "display_value": "2017"},
            {"id": "d", "name": "The Diary of a CEO", "sort_value": 2017, "display_value": "2017 (Oct)"},
            {"id": "e", "name": "We Study Billionaires", "sort_value": 2018, "display_value": "2018"},
        ]
    },
    {
        "puzzle_number": 14,
        "question": "Rank these iconic podcast INTERVIEW MOMENTS by year they occurred",
        "direction": "Earliest → Latest",
        "category": "Famous Moments",
        "emoji": "⭐",
        "fun_fact": "When Marc Maron interviewed Obama in 2015, it marked the first time a sitting U.S. President appeared on a podcast recorded in someone's garage — a cultural milestone for the medium.",
        "items": [
            {"id": "a", "name": "WTF: Maron interviews Robin Williams", "sort_value": 2010, "display_value": "2010"},
            {"id": "b", "name": "Serial Season 1 goes viral (5M downloads in 1 month)", "sort_value": 2014, "display_value": "2014"},
            {"id": "c", "name": "WTF: Maron interviews Obama", "sort_value": 2015, "display_value": "2015"},
            {"id": "d", "name": "JRE: Elon Musk smokes marijuana on air", "sort_value": 2018, "display_value": "2018"},
            {"id": "e", "name": "JRE: Neil Young ultimatum forces Spotify standoff", "sort_value": 2022, "display_value": "2022"},
        ]
    },
    {
        "puzzle_number": 15,
        "question": "Rank these podcast hosts by TOTAL EPISODE COUNT on their show (fewest to most, as of 2026)",
        "direction": "Fewest → Most Episodes",
        "category": "Episode Counts",
        "emoji": "🔢",
        "fun_fact": "Stuff You Should Know has released over 1,800 episodes since 2008, meaning Josh and Chuck have tackled subjects ranging from how sunscreen works to the history of the Donner Party.",
        "items": [
            {"id": "a", "name": "SmartLess (Jason Bateman, Sean Hayes, Will Arnett)", "sort_value": 230, "display_value": "~230 eps"},
            {"id": "b", "name": "Huberman Lab (Andrew Huberman)", "sort_value": 180, "display_value": "~180 eps"},
            {"id": "c", "name": "My Favorite Murder", "sort_value": 380, "display_value": "~380 eps"},
            {"id": "d", "name": "WTF with Marc Maron", "sort_value": 1500, "display_value": "1,500+ eps"},
            {"id": "e", "name": "Stuff You Should Know", "sort_value": 1800, "display_value": "1,800+ eps"},
        ]
    },
    {
        "puzzle_number": 16,
        "question": "Rank these Spotify podcast ACQUISITION DEALS from SMALLEST to LARGEST reported value",
        "direction": "Smallest → Largest Deal",
        "category": "Spotify Deals",
        "emoji": "💰",
        "fun_fact": "Spotify spent over $1 billion acquiring podcast companies and signing exclusive deals between 2019 and 2021 alone, completely reshaping the podcasting industry's economics.",
        "items": [
            {"id": "a", "name": "The Ringer (Bill Simmons)", "sort_value": 195, "display_value": "~$195M"},
            {"id": "b", "name": "Gimlet Media", "sort_value": 230, "display_value": "~$230M"},
            {"id": "c", "name": "Anchor FM", "sort_value": 300, "display_value": "~$300M"},
            {"id": "d", "name": "Wondery (via Amazon, not Spotify)", "sort_value": 300, "display_value": "~$300M"},
            {"id": "e", "name": "Joe Rogan Experience (exclusive deal)", "sort_value": 200, "display_value": "~$200M"},
        ]
    },
    {
        "puzzle_number": 17,
        "question": "Rank these SCIENCE & EDUCATION podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Science Podcasts",
        "emoji": "🔬",
        "fun_fact": "Radiolab pioneered the 'audio documentary' style of podcasting — blending interviews, sound design, and storytelling to explore complex ideas in ways radio had never quite managed.",
        "items": [
            {"id": "a", "name": "Radiolab", "sort_value": 2002, "display_value": "2002"},
            {"id": "b", "name": "Stuff You Should Know", "sort_value": 2008, "display_value": "2008"},
            {"id": "c", "name": "Freakonomics Radio", "sort_value": 2010, "display_value": "2010"},
            {"id": "d", "name": "Science Vs", "sort_value": 2015, "display_value": "2015"},
            {"id": "e", "name": "Huberman Lab", "sort_value": 2021, "display_value": "2021"},
        ]
    },
    {
        "puzzle_number": 18,
        "question": "Rank these podcast-related Grammy categories by year they were FIRST AWARDED",
        "direction": "Earliest → Latest",
        "category": "Awards",
        "emoji": "🏆",
        "fun_fact": "The Grammy for Best Spoken Word Album (non-fiction) has often gone to audiobooks and spoken recordings — blurring the lines between podcasting, radio, and publishing.",
        "items": [
            {"id": "a", "name": "Grammy: Best Spoken Word Album established", "sort_value": 1959, "display_value": "1959"},
            {"id": "b", "name": "Podcast Awards (Podcast.co) first ceremony", "sort_value": 2005, "display_value": "2005"},
            {"id": "c", "name": "iHeartRadio Podcast Awards inaugural year", "sort_value": 2019, "display_value": "2019"},
            {"id": "d", "name": "Spotify Sound Up Amplification Program launched", "sort_value": 2018, "display_value": "2018"},
            {"id": "e", "name": "Signal Awards (podcast Oscars) inaugural year", "sort_value": 2021, "display_value": "2021"},
        ]
    },
    {
        "puzzle_number": 19,
        "question": "Rank these HEALTH & WELLNESS podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Health Podcasts",
        "emoji": "💪",
        "fun_fact": "Huberman Lab exploded in popularity despite launching in 2021 — reaching 3M+ subscribers faster than almost any other science-based podcast, driven partly by detailed protocol breakdowns that went viral on Twitter/X.",
        "items": [
            {"id": "a", "name": "The Rich Roll Podcast", "sort_value": 2012, "display_value": "2012"},
            {"id": "b", "name": "The Model Health Show", "sort_value": 2013, "display_value": "2013"},
            {"id": "c", "name": "Found My Fitness (Rhonda Patrick)", "sort_value": 2015, "display_value": "2015"},
            {"id": "d", "name": "Feel Better, Live More (Rangan Chatterjee)", "sort_value": 2017, "display_value": "2017"},
            {"id": "e", "name": "Huberman Lab", "sort_value": 2021, "display_value": "2021"},
        ]
    },
    {
        "puzzle_number": 20,
        "question": "Rank these PODCAST FIRSTS in chronological order",
        "direction": "Earliest → Latest",
        "category": "Podcast Firsts",
        "emoji": "🥇",
        "fun_fact": "The word 'podcast' was coined in 2004 by journalist Ben Hammersley in The Guardian, combining 'iPod' and 'broadcast' — even though podcasts were never exclusive to iPods.",
        "items": [
            {"id": "a", "name": "RSS 2.0 with audio enclosures invented (Dave Winer)", "sort_value": 2001, "display_value": "2001"},
            {"id": "b", "name": "First podcast recorded (Christopher Lydon)", "sort_value": 2003, "display_value": "2003"},
            {"id": "c", "name": "Word 'podcast' coined by Ben Hammersley (The Guardian)", "sort_value": 2004, "display_value": "2004"},
            {"id": "d", "name": "First podcast advertising network (Podtrac)", "sort_value": 2005, "display_value": "2005"},
            {"id": "e", "name": "First podcast to hit 1 billion downloads (How Stuff Works)", "sort_value": 2008, "display_value": "2008"},
        ]
    },
    {
        "puzzle_number": 21,
        "question": "Rank these INTERVIEW podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Interview Shows",
        "emoji": "🎤",
        "fun_fact": "Armchair Expert with Dax Shepard grew so quickly it became one of Spotify's anchor exclusive deals in 2021, reportedly worth $60M over multiple years.",
        "items": [
            {"id": "a", "name": "WTF with Marc Maron", "sort_value": 2009, "display_value": "2009"},
            {"id": "b", "name": "The Tim Ferriss Show", "sort_value": 2014, "display_value": "2014"},
            {"id": "c", "name": "You Made It Weird (Pete Holmes)", "sort_value": 2011, "display_value": "2011"},
            {"id": "d", "name": "Armchair Expert with Dax Shepard", "sort_value": 2018, "display_value": "2018"},
            {"id": "e", "name": "SmartLess", "sort_value": 2020, "display_value": "2020"},
        ]
    },
    {
        "puzzle_number": 22,
        "question": "Rank these STORYTELLING & NARRATIVE podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Narrative Podcasts",
        "emoji": "📖",
        "fun_fact": "S-Town, released in 2017 as a 7-episode limited series, was downloaded 40 million times in its first month — the fastest any podcast has ever grown to that scale.",
        "items": [
            {"id": "a", "name": "This American Life (as podcast)", "sort_value": 2006, "display_value": "2006"},
            {"id": "b", "name": "The Moth Radio Hour (as podcast)", "sort_value": 2008, "display_value": "2008"},
            {"id": "c", "name": "Serial", "sort_value": 2014, "display_value": "2014"},
            {"id": "d", "name": "S-Town", "sort_value": 2017, "display_value": "2017"},
            {"id": "e", "name": "Slow Burn (Slate)", "sort_value": 2017, "display_value": "2017 (Oct)"},
        ]
    },
    {
        "puzzle_number": 23,
        "question": "Rank these podcast platforms by APPROXIMATE NUMBER OF SHOWS (fewest to most, as of 2025)",
        "direction": "Fewest → Most Shows",
        "category": "Platform Scale",
        "emoji": "📊",
        "fun_fact": "Spotify hosts millions of podcasts after acquiring Anchor, making it the largest podcast distribution platform by show count — though Apple Podcasts has the longer history.",
        "items": [
            {"id": "a", "name": "iHeart Podcast Network (owned shows)", "sort_value": 750, "display_value": "~750 owned"},
            {"id": "b", "name": "Wondery (Amazon)", "sort_value": 40, "display_value": "~40 owned"},
            {"id": "c", "name": "NPR (public shows)", "sort_value": 25, "display_value": "~25 flagship"},
            {"id": "d", "name": "Gimlet Media (Spotify)", "sort_value": 30, "display_value": "~30 owned"},
            {"id": "e", "name": "Earwolf (SiriusXM)", "sort_value": 50, "display_value": "~50+ shows"},
        ]
    },
    {
        "puzzle_number": 24,
        "question": "Rank these famous podcast SPONSOR READS by approximate value (cheapest to most expensive CPM)",
        "direction": "Lowest CPM → Highest CPM",
        "category": "Podcast Economics",
        "emoji": "💵",
        "fun_fact": "Podcast advertising CPM rates can exceed $50 for highly engaged true crime or health audiences, compared to digital display ads which average $1-3 CPM. That's why podcasts are so valuable for advertisers.",
        "items": [
            {"id": "a", "name": "News/General Interest podcasts", "sort_value": 20, "display_value": "~$20 CPM"},
            {"id": "b", "name": "Comedy podcasts", "sort_value": 25, "display_value": "~$25 CPM"},
            {"id": "c", "name": "True Crime podcasts", "sort_value": 40, "display_value": "~$40 CPM"},
            {"id": "d", "name": "Health & Wellness podcasts", "sort_value": 45, "display_value": "~$45 CPM"},
            {"id": "e", "name": "Finance/Business podcasts", "sort_value": 50, "display_value": "~$50+ CPM"},
        ]
    },
    {
        "puzzle_number": 25,
        "question": "Rank these CELEB-HOSTED podcasts OLDEST to NEWEST",
        "direction": "Oldest → Newest",
        "category": "Celebrity Podcasts",
        "emoji": "🌟",
        "fun_fact": "Conan O'Brien's podcast has consistently ranked as one of Apple's most-downloaded comedy podcasts, proving that late-night hosts can reinvent themselves in the audio-first world.",
        "items": [
            {"id": "a", "name": "Jordan, Jesse, GO! (Jesse Thorn)", "sort_value": 2006, "display_value": "2006"},
            {"id": "b", "name": "You Made It Weird (Pete Holmes)", "sort_value": 2011, "display_value": "2011"},
            {"id": "c", "name": "Conan O'Brien Needs a Friend", "sort_value": 2018, "display_value": "2018"},
            {"id": "d", "name": "SmartLess (Bateman/Hayes/Arnett)", "sort_value": 2020, "display_value": "2020"},
            {"id": "e", "name": "Fly on the Wall (Dana Carvey & David Spade)", "sort_value": 2022, "display_value": "2022"},
        ]
    },
    {
        "puzzle_number": 26,
        "question": "Rank these podcast SUBSCRIPTION SERVICES by launch year",
        "direction": "Oldest → Newest",
        "category": "Podcast Subscriptions",
        "emoji": "🔐",
        "fun_fact": "Apple Podcasts Subscriptions launched in 2021 to compete with Patreon and Spotify, offering creators a direct subscription model — though adoption has been slower than Apple anticipated.",
        "items": [
            {"id": "a", "name": "Patreon (podcast tiers popularized)", "sort_value": 2013, "display_value": "2013"},
            {"id": "b", "name": "Luminary (podcast subscription service)", "sort_value": 2019, "display_value": "2019"},
            {"id": "c", "name": "Spotify Premium podcast features", "sort_value": 2020, "display_value": "2020"},
            {"id": "d", "name": "Apple Podcasts Subscriptions", "sort_value": 2021, "display_value": "2021"},
            {"id": "e", "name": "YouTube Podcasts dedicated section", "sort_value": 2022, "display_value": "2022"},
        ]
    },
    {
        "puzzle_number": 27,
        "question": "Rank these podcast GENRES by approximate average episode length (shortest to longest)",
        "direction": "Shortest → Longest average",
        "category": "Genre Lengths",
        "emoji": "⏰",
        "fun_fact": "True crime podcasts tend to run longer than other genres — listeners are so invested in the story they'll sit through 90+ minute deep dives. News shows, by contrast, are edited tightly to 10-20 minutes to fit morning commutes.",
        "items": [
            {"id": "a", "name": "Daily News (Up First, The Daily, etc.)", "sort_value": 15, "display_value": "~15 min"},
            {"id": "b", "name": "Comedy (quick formats)", "sort_value": 30, "display_value": "~30 min"},
            {"id": "c", "name": "True Crime", "sort_value": 60, "display_value": "~60 min"},
            {"id": "d", "name": "Interview / Talk Shows", "sort_value": 90, "display_value": "~90 min"},
            {"id": "e", "name": "History / Documentary (Hardcore History, etc.)", "sort_value": 180, "display_value": "~3+ hours"},
        ]
    },
    {
        "puzzle_number": 28,
        "question": "Rank these PODCAST ACQUISITIONS/MERGERS in chronological order",
        "direction": "Earliest → Latest",
        "category": "Industry M&A",
        "emoji": "🤝",
        "fun_fact": "When Amazon acquired Wondery in 2020, it was a direct countermove to Spotify's podcast buying spree — signaling that podcasting had become a full-scale streaming wars battleground.",
        "items": [
            {"id": "a", "name": "SiriusXM acquires Pandora (enters podcast space)", "sort_value": 2018, "display_value": "2018"},
            {"id": "b", "name": "Spotify acquires Gimlet + Anchor", "sort_value": 2019, "display_value": "2019"},
            {"id": "c", "name": "Amazon acquires Wondery (~$300M)", "sort_value": 2020, "display_value": "2020"},
            {"id": "d", "name": "SiriusXM acquires Stitcher from E.W. Scripps", "sort_value": 2020, "display_value": "2020 (Oct)"},
            {"id": "e", "name": "iHeart acquires Triton Digital (podcast analytics)", "sort_value": 2021, "display_value": "2021"},
        ]
    },
    {
        "puzzle_number": 29,
        "question": "Rank these things podcasters do IN ORDER during a typical episode production",
        "direction": "First → Last step",
        "category": "The Podcast Process",
        "emoji": "🎙️",
        "fun_fact": "DoneCast automates most of the post-recording steps in this exact order — transcription, editing suggestions, intro/outro adding, and distribution — saving podcasters hours per episode.",
        "items": [
            {"id": "a", "name": "Record the raw audio", "sort_value": 1, "display_value": "Step 1"},
            {"id": "b", "name": "Edit out mistakes & filler words", "sort_value": 2, "display_value": "Step 2"},
            {"id": "c", "name": "Add intro, outro & music", "sort_value": 3, "display_value": "Step 3"},
            {"id": "d", "name": "Write show notes & episode title", "sort_value": 4, "display_value": "Step 4"},
            {"id": "e", "name": "Upload & distribute to platforms", "sort_value": 5, "display_value": "Step 5"},
        ]
    },
    {
        "puzzle_number": 30,
        "question": "Rank these PODCAST LISTENER STATS from LOWEST to HIGHEST (approximate US adult listeners)",
        "direction": "Fewest → Most listeners",
        "category": "Audience Data",
        "emoji": "👥",
        "fun_fact": "In 2006, only 11% of Americans had ever listened to a podcast. By 2024, that number crossed 47% — nearly half the country. Podcasting went from niche curiosity to mainstream media format in under 20 years.",
        "items": [
            {"id": "a", "name": "US podcast listeners in 2010", "sort_value": 2010, "display_value": "~18M"},
            {"id": "b", "name": "US podcast listeners in 2015", "sort_value": 2015, "display_value": "~46M"},
            {"id": "c", "name": "US podcast listeners in 2018", "sort_value": 2018, "display_value": "~73M"},
            {"id": "d", "name": "US podcast listeners in 2021", "sort_value": 2021, "display_value": "~116M"},
            {"id": "e", "name": "US podcast listeners in 2024", "sort_value": 2024, "display_value": "~135M"},
        ]
    },
]
```

## Final note for the agent

After building all files, run:
```
openclaw system event --text "Done: PODIUM game fully built. Frontend in /home/scott/.openclaw/workspace/podium/, backend in DoneCast. Ready for review and deployment." --mode now
```
