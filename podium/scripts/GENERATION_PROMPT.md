# PODIUM Daily Puzzle Generation

You are running the PODIUM daily puzzle generator for tomorrow's puzzle.

## Your task

Run the generator script and handle any failures:

```bash
cd /home/scott/.openclaw/workspace/donecast/backend
PYTHONPATH=. python3 /home/scott/.openclaw/workspace/podium/scripts/generate_puzzle.py --verbose
```

## Expected outcomes

**Exit 0 — Success:** Puzzle generated and saved to DB. Done.

**Exit 2 — Already exists:** Puzzle already in DB (maybe ran twice). Done, no action needed.

**Exit 1 — Failed:** Generator exhausted all 4 retries. You must:
1. Note the exact error from the output
2. Optionally try once more manually with `--force`:
   ```bash
   PYTHONPATH=. python3 /home/scott/.openclaw/workspace/podium/scripts/generate_puzzle.py --verbose --force
   ```
3. If still failing, alert Scott in the #ops channel with the error

## What the script does

1. Queries the DB for recently used categories (to avoid repetition)
2. Calls Gemini (via DoneCast Vertex AI) with a puzzle design prompt
3. Validates the response (exactly 5 items, strictly increasing sort_values, etc.)
4. On validation failure, retries with the error injected into the prompt
5. Inserts the validated puzzle into the `podium_puzzle` table
6. Sends an openclaw alert automatically if all attempts fail

## Validation rules

A valid puzzle must have:
- Exactly 5 items with IDs "a" through "e"
- Strictly increasing `sort_value` (no ties!)
- Non-empty `question`, `direction`, `category`, `fun_fact`
- `fun_fact` at least 50 chars (must be genuinely informative)
- Unique item names

## Environment

The script needs:
- `VERTEX_PROJECT` or `GEMINI_API_KEY` (usually set in the DoneCast .env.local)
- `DATABASE_URL` (the production PostgreSQL connection string)
- Both are available when running from the donecast/backend directory
