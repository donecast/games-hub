#!/usr/bin/env python3
"""
PODIUM Puzzle Validator
Checks that tomorrow's (or a specific date's) puzzle exists and is valid in the DB.

Usage:
  cd /path/to/donecast/backend
  PYTHONPATH=. python3 ../podium/scripts/validate_puzzle.py
  PYTHONPATH=. python3 ../podium/scripts/validate_puzzle.py --date 2026-03-01
  PYTHONPATH=. python3 ../podium/scripts/validate_puzzle.py --days 7  # check next N days

Called by the PODIUM Puzzle Validation cron at 5 AM PT.
Exit codes: 0 = valid, 1 = missing or invalid (triggers alert).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import date, timedelta
from typing import Optional

# Backend path resolution
for _candidate in [
    os.path.join(os.path.dirname(__file__), '..', '..', 'donecast', 'backend'),
    os.path.join(os.path.dirname(__file__), '..', 'backend'),
    os.getcwd(),
]:
    _abs = os.path.abspath(_candidate)
    if os.path.exists(os.path.join(_abs, 'api', 'core', 'database.py')):
        sys.path.insert(0, _abs)
        break

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger("podium.validate")


def validate_db_puzzle(target_date: date) -> tuple[bool, list[str]]:
    """
    Fetch and validate a puzzle from the DB for the given date.
    Returns (is_valid, list_of_issues).
    """
    from api.core.database import engine
    from sqlalchemy import text

    issues = []

    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT puzzle_number, question, direction, category, emoji, fun_fact, items_json "
            "FROM podium_puzzle WHERE puzzle_date = :d"
        ), {"d": target_date})
        row = result.fetchone()

    if not row:
        return False, [f"No puzzle in DB for {target_date}"]

    puzzle_number, question, direction, category, emoji, fun_fact, items_json = row

    # Required text fields
    for name, val in [("question", question), ("direction", direction), ("emoji", emoji)]:
        if not val or not val.strip():
            issues.append(f"{name!r} is empty")

    if not fun_fact or not fun_fact.strip():
        issues.append("fun_fact is empty")

    if not items_json or not items_json.strip():
        issues.append("items_json is empty")
        return False, issues

    # Parse items
    try:
        items = json.loads(items_json)
    except json.JSONDecodeError as e:
        issues.append(f"items_json is invalid JSON: {e}")
        return False, issues

    if not isinstance(items, list):
        issues.append("items_json must be a JSON array")
        return False, issues

    if len(items) != 5:
        issues.append(f"items must have exactly 5 elements, got {len(items)}")

    expected_ids = ["a", "b", "c", "d", "e"]
    for i, item in enumerate(items[:5]):
        for field in ("id", "name", "sort_value", "display_value"):
            if field not in item:
                issues.append(f"Item {i} missing {field!r}")

        if i < len(expected_ids) and item.get("id") != expected_ids[i]:
            issues.append(f"Item {i} has id {item.get('id')!r}, expected {expected_ids[i]!r}")

        if not item.get("name", "").strip():
            issues.append(f"Item {i} has empty name")

    # Check strict ordering
    if len(items) >= 2:
        for i in range(len(items) - 1):
            sv_a = items[i].get("sort_value", 0)
            sv_b = items[i + 1].get("sort_value", 0)
            if sv_a >= sv_b:
                issues.append(
                    f"sort_values not strictly increasing: "
                    f"item[{i}]={sv_a} >= item[{i+1}]={sv_b}"
                )

    # Unique names
    names = [item.get("name", "") for item in items]
    if len(set(names)) != len(names):
        issues.append("Duplicate item names")

    is_valid = len(issues) == 0
    return is_valid, issues


def check_date(target_date: date, alert_on_failure: bool = True) -> bool:
    """Validate a single date. Returns True if valid."""
    log.info(f"Checking PODIUM puzzle for {target_date}...")

    try:
        is_valid, issues = validate_db_puzzle(target_date)
    except Exception as e:
        log.error(f"DB error checking {target_date}: {e}", exc_info=True)
        if alert_on_failure:
            _send_alert(target_date, [f"DB error: {e}"])
        return False

    if is_valid:
        log.info(f"✅ {target_date}: puzzle is valid")
        return True
    else:
        log.error(f"❌ {target_date}: {len(issues)} issue(s):")
        for issue in issues:
            log.error(f"   - {issue}")
        if alert_on_failure:
            _send_alert(target_date, issues)
        return False


def _send_alert(target_date: date, issues: list[str]) -> None:
    """Send an openclaw alert when validation fails."""
    try:
        issues_str = "\n".join(f"• {i}" for i in issues[:10])
        msg = (
            f"⚠️ PODIUM puzzle validation FAILED for {target_date}\n\n"
            f"Issues:\n{issues_str}\n\n"
            f"Fix: `cd donecast/backend && PYTHONPATH=. python3 ../podium/scripts/generate_puzzle.py "
            f"--date {target_date} --force`"
        )
        subprocess.run(
            ["openclaw", "system", "event", "--text", msg, "--mode", "now"],
            timeout=10, check=False, capture_output=True,
        )
        log.info("Alert sent via openclaw")
    except Exception as e:
        log.warning(f"Could not send alert: {e}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate PODIUM puzzle(s) in the database"
    )
    parser.add_argument(
        "--date", default=None,
        help="Date to validate YYYY-MM-DD (default: tomorrow)"
    )
    parser.add_argument(
        "--days", type=int, default=1,
        help="Number of days to check starting from --date (default: 1)"
    )
    parser.add_argument(
        "--no-alert", action="store_true",
        help="Skip openclaw alert on failure"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show debug logging"
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.date:
        try:
            start_date = date.fromisoformat(args.date)
        except ValueError:
            log.error(f"Invalid date: {args.date!r}")
            return 1
    else:
        start_date = date.today() + timedelta(days=1)

    all_valid = True
    for i in range(args.days):
        target = start_date + timedelta(days=i)
        ok = check_date(target, alert_on_failure=not args.no_alert)
        if not ok:
            all_valid = False

    if all_valid:
        log.info(f"All {args.days} day(s) validated ✅")
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())
