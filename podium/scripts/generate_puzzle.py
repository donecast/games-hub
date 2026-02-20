#!/usr/bin/env python3
"""
PODIUM Daily Puzzle Generator
Generates tomorrow's PODIUM puzzle using the DoneCast AI infrastructure (Gemini/Vertex AI).

Usage:
  cd /path/to/donecast/backend
  PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py
  PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py --date 2026-03-01
  PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py --dry-run
  PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py --force  # overwrite existing

This script is called by the PODIUM Daily Puzzle Generation cron at 4 AM PT.
The validation cron at 5 AM PT checks the output via validate_puzzle.py.

Exit codes:
  0 = success (puzzle generated and saved)
  1 = failure (will trigger alert)
  2 = already exists (no-op, success)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
import time
from datetime import date, datetime, timedelta
from typing import Any, Optional

# Allow running from donecast/backend or podium/scripts
_BACKEND_PATH = None
for _candidate in [
    os.path.join(os.path.dirname(__file__), '..', '..', 'donecast', 'backend'),
    os.path.join(os.path.dirname(__file__), '..', 'backend'),
    os.getcwd(),
]:
    _abs = os.path.abspath(_candidate)
    if os.path.exists(os.path.join(_abs, 'api', 'core', 'database.py')):
        _BACKEND_PATH = _abs
        sys.path.insert(0, _abs)
        break

if not _BACKEND_PATH:
    print("ERROR: Cannot find DoneCast backend. Run from donecast/backend/ with PYTHONPATH=.", file=sys.stderr)
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger("podium.generate")


# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a puzzle designer for PODIUM, a daily podcast-themed ranking game (podium.donecast.com).
Each puzzle has 5 items that players rank on a single dimension (e.g., oldest to newest, cheapest to most expensive).
Scoring uses Kendall tau: 10 possible pairs, each correct relative ordering = +1 point.

Your puzzles must be:
- VERIFIABLE: use only real, publicly documented facts
- FUN: surprising or counterintuitive orderings are more interesting
- EDUCATIONAL: players should learn something about podcasting
- DISTINCT: never repeat a category used in the last 30 puzzles

Good categories: launch years, episode lengths, host ages, gear prices, subscriber counts,
acquisition prices, streaming deal values, production steps, genre lengths, platform ages,
episode counts, chronological milestones, regional listener counts, award dates.

Always return valid JSON matching the exact schema provided.
"""


# ─── Generation prompt ────────────────────────────────────────────────────────

def build_prompt(target_date: date, puzzle_number: int, recent_categories: list[str]) -> str:
    avoid = ", ".join(recent_categories[-15:]) if recent_categories else "none"
    return f"""\
Generate a PODIUM puzzle for date {target_date.isoformat()} (puzzle #{puzzle_number}).

Recently used categories (DO NOT repeat these): {avoid}

Requirements:
1. Choose a podcast-related ranking dimension not in the recent list above
2. Provide exactly 5 items in CORRECT ORDER (index 0 = "first" per the direction)
3. Items must be well-known enough that a podcast enthusiast would recognize most of them
4. sort_value must strictly increase (no ties — use decimals like 2009.1 if needed)
5. display_value is human-readable (e.g. "2008", "~45 min", "~$399", "b. 1967")
6. fun_fact must be genuinely interesting, factually accurate, and 1-3 sentences
7. The puzzle should be challenging but fair — mix of obvious and surprising items

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{{
  "question": "Rank these podcasts OLDEST to NEWEST (by first episode date)",
  "direction": "Oldest → Newest",
  "category": "Launch Years",
  "emoji": "📅",
  "fun_fact": "One interesting sentence about the puzzle topic.",
  "items": [
    {{"id": "a", "name": "Podcast or item name", "sort_value": 2008, "display_value": "2008"}},
    {{"id": "b", "name": "...", "sort_value": 2009, "display_value": "2009"}},
    {{"id": "c", "name": "...", "sort_value": 2014, "display_value": "2014"}},
    {{"id": "d", "name": "...", "sort_value": 2017, "display_value": "2017"}},
    {{"id": "e", "name": "...", "sort_value": 2018, "display_value": "2018"}}
  ]
}}

Use IDs "a" through "e" exactly. Items must be in CORRECT ORDER (sort_value ascending).
"""


# ─── Validation ──────────────────────────────────────────────────────────────

class ValidationError(Exception):
    pass


def validate_puzzle(data: dict, target_date: date) -> None:
    """Raises ValidationError if the puzzle data is invalid."""

    required_fields = ["question", "direction", "category", "emoji", "fun_fact", "items"]
    for field in required_fields:
        if field not in data:
            raise ValidationError(f"Missing required field: {field!r}")

    if not isinstance(data["items"], list):
        raise ValidationError("items must be a list")

    if len(data["items"]) != 5:
        raise ValidationError(f"items must have exactly 5 elements, got {len(data['items'])}")

    expected_ids = ["a", "b", "c", "d", "e"]
    for i, item in enumerate(data["items"]):
        for field in ("id", "name", "sort_value", "display_value"):
            if field not in item:
                raise ValidationError(f"Item {i} missing field {field!r}")

        if item["id"] != expected_ids[i]:
            raise ValidationError(f"Item {i} has id {item['id']!r}, expected {expected_ids[i]!r}")

        if not isinstance(item["name"], str) or not item["name"].strip():
            raise ValidationError(f"Item {i} has invalid name")

        if not isinstance(item["sort_value"], (int, float)):
            raise ValidationError(f"Item {i} sort_value must be numeric, got {type(item['sort_value'])}")

        if not isinstance(item["display_value"], str) or not item["display_value"].strip():
            raise ValidationError(f"Item {i} has invalid display_value")

    # sort_values must be strictly increasing
    sort_vals = [item["sort_value"] for item in data["items"]]
    for i in range(len(sort_vals) - 1):
        if sort_vals[i] >= sort_vals[i + 1]:
            raise ValidationError(
                f"sort_values must be strictly increasing: "
                f"item[{i}]={sort_vals[i]} >= item[{i+1}]={sort_vals[i+1]}"
            )

    # Names must be unique
    names = [item["name"] for item in data["items"]]
    if len(set(names)) != len(names):
        raise ValidationError("Duplicate item names")

    # Strings can't be empty
    for field in ("question", "direction", "category", "fun_fact"):
        if not data[field].strip():
            raise ValidationError(f"{field!r} must not be empty")

    # Question sanity check
    if len(data["question"]) < 20:
        raise ValidationError(f"question seems too short: {data['question']!r}")

    if len(data["fun_fact"]) < 50:
        raise ValidationError(f"fun_fact seems too short: {data['fun_fact']!r}")

    log.info("Validation passed ✅")


# ─── AI Generation ────────────────────────────────────────────────────────────

def call_ai(prompt: str, model: Optional[str] = None, attempt: int = 0) -> str:
    """Call the DoneCast Gemini client and return the raw text response."""
    from api.services.ai_content.client_gemini import generate

    model_name = model or os.getenv("PODIUM_AI_MODEL") or os.getenv("DEFAULT_AI_MODEL") or "gemini-2.5-flash"

    log.info(f"Calling AI (attempt {attempt + 1}, model={model_name})...")
    response = generate(
        prompt,
        model=model_name,
        temperature=0.8 + (attempt * 0.1),  # Slightly increase temp on retries for variety
        max_tokens=1500,
        system_instruction=SYSTEM_PROMPT,
    )
    return response


def extract_json(raw: str) -> dict:
    """Extract and parse JSON from an AI response (strips markdown fences if present)."""
    # Strip markdown code fences
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last fence lines
        lines = [l for l in lines if not l.startswith("```")]
        text = "\n".join(lines).strip()

    # Find JSON object boundaries
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response. Got: {text[:200]!r}")

    json_str = text[start:end]
    return json.loads(json_str)


# ─── DB Operations ────────────────────────────────────────────────────────────

def get_recent_categories(conn, limit: int = 30) -> list[str]:
    """Fetch recent puzzle categories from the DB to avoid repetition."""
    from sqlalchemy import text
    try:
        result = conn.execute(text(
            "SELECT category FROM podium_puzzle ORDER BY puzzle_date DESC LIMIT :n"
        ), {"n": limit})
        return [row[0] for row in result if row[0]]
    except Exception as e:
        log.warning(f"Could not fetch recent categories: {e}")
        return []


def get_next_puzzle_number(conn) -> int:
    """Return the next puzzle number (max + 1, or 1 if no puzzles exist)."""
    from sqlalchemy import text
    try:
        result = conn.execute(text("SELECT MAX(puzzle_number) FROM podium_puzzle"))
        val = result.scalar()
        return (val or 0) + 1
    except Exception as e:
        log.warning(f"Could not get max puzzle_number: {e}")
        return 1


def puzzle_exists(conn, target_date: date) -> bool:
    """Check if a puzzle already exists for the given date."""
    from sqlalchemy import text
    result = conn.execute(text(
        "SELECT id FROM podium_puzzle WHERE puzzle_date = :d"
    ), {"d": target_date})
    return result.fetchone() is not None


def insert_puzzle(conn, target_date: date, puzzle_number: int, data: dict) -> None:
    """Insert the generated puzzle into the database."""
    from sqlalchemy import text
    conn.execute(text("""
        INSERT INTO podium_puzzle
            (puzzle_date, puzzle_number, question, direction, category, emoji, fun_fact, items_json)
        VALUES
            (:puzzle_date, :puzzle_number, :question, :direction, :category, :emoji, :fun_fact, :items_json)
    """), {
        "puzzle_date": target_date,
        "puzzle_number": puzzle_number,
        "question": data["question"],
        "direction": data["direction"],
        "category": data.get("category"),
        "emoji": data.get("emoji", "🎙️"),
        "fun_fact": data.get("fun_fact"),
        "items_json": json.dumps(data["items"]),
    })
    log.info(f"Inserted puzzle #{puzzle_number} for {target_date}")


# ─── Core Generate Loop ───────────────────────────────────────────────────────

MAX_ATTEMPTS = 4


def generate_and_save(
    target_date: date,
    dry_run: bool = False,
    force: bool = False,
    model: Optional[str] = None,
) -> dict:
    """
    Main generation loop. Generates a puzzle with AI, validates it, and saves to DB.
    Returns the final puzzle data dict on success.
    Raises RuntimeError on total failure after MAX_ATTEMPTS.
    """
    from api.core.database import engine
    from sqlalchemy import text as sql_text

    with engine.begin() as conn:
        # Check if puzzle already exists
        if not force and puzzle_exists(conn, target_date):
            log.info(f"Puzzle for {target_date} already exists. Use --force to overwrite.")
            return {}

        recent_categories = get_recent_categories(conn)
        puzzle_number = get_next_puzzle_number(conn)

    log.info(f"Generating PODIUM puzzle #{puzzle_number} for {target_date}")
    log.info(f"Avoiding recent categories: {recent_categories[-10:]}")

    prompt = build_prompt(target_date, puzzle_number, recent_categories)

    last_error = None
    for attempt in range(MAX_ATTEMPTS):
        if attempt > 0:
            wait = 2 ** attempt  # exponential backoff: 2, 4, 8 seconds
            log.info(f"Retrying in {wait}s... (attempt {attempt + 1}/{MAX_ATTEMPTS})")
            time.sleep(wait)

        try:
            raw = call_ai(prompt, model=model, attempt=attempt)
            log.debug(f"Raw AI response (first 500 chars): {raw[:500]}")

            data = extract_json(raw)
            validate_puzzle(data, target_date)

            log.info(
                f"Generated: category={data['category']!r}, "
                f"direction={data['direction']!r}, "
                f"items={[item['name'] for item in data['items']]}"
            )

            if dry_run:
                log.info("[DRY RUN] Would insert:")
                log.info(json.dumps(data, indent=2, ensure_ascii=False))
                return data

            # Save to DB
            with engine.begin() as conn:
                if force and puzzle_exists(conn, target_date):
                    conn.execute(sql_text(
                        "DELETE FROM podium_puzzle WHERE puzzle_date = :d"
                    ), {"d": target_date})
                    log.info(f"Deleted existing puzzle for {target_date} (--force)")

                insert_puzzle(conn, target_date, puzzle_number, data)

            log.info(f"✅ PODIUM puzzle #{puzzle_number} for {target_date} generated and saved.")
            return data

        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}. Response: {raw[:300]!r}"
            log.warning(f"Attempt {attempt + 1} failed (JSON): {last_error}")

        except ValidationError as e:
            last_error = f"Validation failed: {e}"
            log.warning(f"Attempt {attempt + 1} failed (validation): {e}")
            # Inject the error into the next attempt's prompt for correction
            prompt = build_prompt(target_date, puzzle_number, recent_categories) + (
                f"\n\nIMPORTANT: Your previous attempt had this error: {e}\n"
                f"Fix this in your new response."
            )

        except Exception as e:
            last_error = f"Unexpected error: {e}"
            log.error(f"Attempt {attempt + 1} failed (unexpected): {e}", exc_info=True)

    raise RuntimeError(
        f"Failed to generate valid puzzle after {MAX_ATTEMPTS} attempts. "
        f"Last error: {last_error}"
    )


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate tomorrow's PODIUM puzzle using AI",
        epilog="Run from donecast/backend/ with PYTHONPATH=.",
    )
    parser.add_argument(
        "--date", default=None,
        help="Target date YYYY-MM-DD (default: tomorrow)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Generate but don't save to DB"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Overwrite existing puzzle for this date"
    )
    parser.add_argument(
        "--model", default=None,
        help="Override AI model name"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show debug logging"
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Resolve target date
    if args.date:
        try:
            target_date = date.fromisoformat(args.date)
        except ValueError:
            log.error(f"Invalid date: {args.date!r}. Use YYYY-MM-DD.")
            return 1
    else:
        target_date = date.today() + timedelta(days=1)

    log.info(f"PODIUM puzzle generator — target date: {target_date}")
    if args.dry_run:
        log.info("DRY RUN mode — nothing will be saved")

    start = time.time()
    try:
        result = generate_and_save(
            target_date=target_date,
            dry_run=args.dry_run,
            force=args.force,
            model=args.model,
        )
        elapsed = time.time() - start

        if not result:
            # Already existed
            log.info(f"Puzzle for {target_date} already exists. Nothing to do.")
            return 2

        log.info(f"Done in {elapsed:.1f}s")
        return 0

    except RuntimeError as e:
        log.error(f"❌ Generation failed: {e}")
        _alert_on_failure(target_date, str(e))
        return 1

    except Exception as e:
        log.error(f"❌ Unexpected failure: {e}", exc_info=True)
        _alert_on_failure(target_date, str(e))
        return 1


def _alert_on_failure(target_date: date, error: str) -> None:
    """Send a Slack alert when generation fails. Non-fatal — swallows exceptions."""
    try:
        import subprocess
        msg = (
            f"⚠️ PODIUM puzzle generation FAILED for {target_date}\n"
            f"Error: {error[:500]}\n"
            f"Run manually: `cd donecast/backend && PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py --date {target_date} --verbose`"
        )
        # Use openclaw to notify (same pattern as other scripts)
        subprocess.run(
            ["openclaw", "system", "event", "--text", msg, "--mode", "now"],
            timeout=10, check=False, capture_output=True,
        )
        log.info("Alert sent via openclaw")
    except Exception as alert_err:
        log.warning(f"Could not send alert: {alert_err}")


if __name__ == "__main__":
    sys.exit(main())
