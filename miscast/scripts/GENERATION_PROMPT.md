# MISCAST Daily Puzzle Generation

You are generating daily puzzles for MISCAST, a podcast-themed word puzzle game.

## What is MISCAST?
Players read a passage where some words have been replaced with similar-sounding imposters (homophones). They must find and correct the "miscast" words.

## Requirements per Difficulty

### 🟢 EASY (3 errors, ~40-60 words)
- Short, easily digestible passage
- OBVIOUS homophones: their/there/they're, to/too, your/you're, know/no, weak/week, write/right, through/threw
- The wrong word should clearly NOT fit the context
- Topics: everyday life, simple advice, casual tone

### 🟡 MEDIUM (5 errors, ~80-120 words)  
- Moderate length, interesting topic
- MIX of common and less common homophones: altar/alter, manor/manner, cord/chord, patients/patience, wear/where, scene/seen
- Some errors should require a second read to spot
- Topics: podcasting, creativity, business, technology

### 🔴 HARD (7 errors, ~140-200 words)
- Longer passage, dense content
- TRICKY homophones: affect/effect, complement/compliment, principal/principle, personnel/personal, discrete/discreet, stationary/stationery, prophets/profits
- Errors should almost work in context — the reader needs to think carefully
- Topics: industry analysis, science, philosophy, media criticism

## Critical Rules
1. Each "wrong" word must be a REAL English word (not a typo)
2. Each wrong word must appear EXACTLY ONCE in the passage
3. Each wrong word must SOUND SIMILAR to the correct word (homophone or near-homophone)
4. The passage must read naturally — not forced or awkward
5. DO NOT reuse the same homophone pair across difficulties for the same day
6. Theme should be varied day-to-day (don't repeat recent themes)

## Output Format
Save as JSON to: `/home/scott/.openclaw/workspace/miscast/vault/YYYY-MM-DD.json`

```json
{
  "date": "YYYY-MM-DD",
  "easy": {
    "id": "eN-YYYYMMDD",
    "theme": "Short Theme Title",
    "text": "The full passage text with errors included...",
    "errors": [
      { "wrong": "kneed", "right": ["need"] },
      ...
    ]
  },
  "medium": { ... },
  "hard": { ... }
}
```

## After saving, validate with:
```bash
python3 /home/scott/.openclaw/workspace/miscast/scripts/validate.py --date YYYY-MM-DD
```

If validation fails, fix the issues and re-validate. Do not leave invalid puzzles.
