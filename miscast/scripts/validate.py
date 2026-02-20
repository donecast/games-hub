#!/usr/bin/env python3
"""
MISCAST Puzzle Validator
Validates puzzle JSON files for correctness.

Usage:
  python validate.py [--date YYYY-MM-DD] [--vault-dir /path/to/vault]
  python validate.py --all  # validate all vault files
"""

import json
import sys
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

VAULT_DIR = Path(__file__).parent.parent / "vault"

DIFFICULTY_RULES = {
    "easy":   {"min_errors": 3, "max_errors": 3, "min_words": 25, "max_words": 80},
    "medium": {"min_errors": 5, "max_errors": 5, "min_words": 40, "max_words": 150},
    "hard":   {"min_errors": 7, "max_errors": 7, "min_words": 100, "max_words": 300},
}

def tokenize(text):
    """Split text into word tokens, stripping punctuation for matching."""
    tokens = text.split()
    result = []
    for raw in tokens:
        m = re.match(r"^([^a-zA-Z''\u2019-]*)(.+?)([^a-zA-Z''\u2019-]*)$", raw)
        word = m.group(2) if m else raw
        result.append(word)
    return result

def validate_puzzle(puzzle, difficulty):
    """Validate a single puzzle. Returns list of error strings (empty = valid)."""
    issues = []
    rules = DIFFICULTY_RULES.get(difficulty)
    if not rules:
        issues.append(f"Unknown difficulty: {difficulty}")
        return issues

    # Required fields
    for field in ["theme", "text", "errors"]:
        if field not in puzzle:
            issues.append(f"Missing field: {field}")
    if issues:
        return issues

    text = puzzle["text"]
    errors = puzzle["errors"]
    tokens = tokenize(text)
    word_count = len(tokens)

    # Word count check
    if word_count < rules["min_words"]:
        issues.append(f"Too short: {word_count} words (min {rules['min_words']})")
    if word_count > rules["max_words"]:
        issues.append(f"Too long: {word_count} words (max {rules['max_words']})")

    # Error count check
    if len(errors) < rules["min_errors"]:
        issues.append(f"Too few errors: {len(errors)} (need {rules['min_errors']})")
    if len(errors) > rules["max_errors"]:
        issues.append(f"Too many errors: {len(errors)} (max {rules['max_errors']})")

    # Each error must have wrong + right fields
    for i, err in enumerate(errors):
        if "wrong" not in err:
            issues.append(f"Error {i}: missing 'wrong' field")
            continue
        if "right" not in err or not err["right"]:
            issues.append(f"Error {i}: missing or empty 'right' field")
            continue

        wrong_word = err["wrong"]

        # Wrong word must appear exactly once in text
        tokens_lower = [t.lower() for t in tokens]
        wrong_lower = wrong_word.lower()
        occurrences = tokens_lower.count(wrong_lower)

        if occurrences == 0:
            issues.append(f"Error {i}: '{wrong_word}' not found in text")
        elif occurrences > 1:
            issues.append(f"Error {i}: '{wrong_word}' appears {occurrences} times (must be unique)")

    # Check for duplicate wrong words
    wrong_words = [e.get("wrong", "").lower() for e in errors]
    if len(wrong_words) != len(set(wrong_words)):
        issues.append("Duplicate wrong words found")

    return issues

def validate_day(date_str, vault_dir=None):
    """Validate all puzzles for a given date. Returns dict of results."""
    vault = Path(vault_dir) if vault_dir else VAULT_DIR
    filepath = vault / f"{date_str}.json"

    if not filepath.exists():
        return {"valid": False, "error": f"File not found: {filepath}", "details": {}}

    try:
        with open(filepath) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return {"valid": False, "error": f"Invalid JSON: {e}", "details": {}}

    results = {"valid": True, "details": {}}

    for difficulty in ["easy", "medium", "hard"]:
        if difficulty not in data:
            results["details"][difficulty] = {"valid": False, "issues": [f"Missing {difficulty} puzzle"]}
            results["valid"] = False
            continue

        issues = validate_puzzle(data[difficulty], difficulty)
        is_valid = len(issues) == 0
        results["details"][difficulty] = {"valid": is_valid, "issues": issues}
        if not is_valid:
            results["valid"] = False

    return results

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate MISCAST puzzles")
    parser.add_argument("--date", help="Date to validate (YYYY-MM-DD), default: tomorrow")
    parser.add_argument("--vault-dir", help="Override vault directory path")
    parser.add_argument("--all", action="store_true", help="Validate all vault files")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    vault = Path(args.vault_dir) if args.vault_dir else VAULT_DIR

    if args.all:
        files = sorted(vault.glob("*.json"))
        all_valid = True
        for f in files:
            date_str = f.stem
            results = validate_day(date_str, vault)
            status = "✅" if results["valid"] else "❌"
            print(f"{status} {date_str}", end="")
            if not results["valid"]:
                all_valid = False
                for diff, detail in results["details"].items():
                    if not detail["valid"]:
                        for issue in detail["issues"]:
                            print(f"\n   {diff}: {issue}", end="")
            print()
        sys.exit(0 if all_valid else 1)
    else:
        if args.date:
            date_str = args.date
        else:
            tomorrow = datetime.now() + timedelta(days=1)
            date_str = tomorrow.strftime("%Y-%m-%d")

        results = validate_day(date_str, vault)

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            if results.get("error"):
                print(f"❌ {date_str}: {results['error']}")
            else:
                status = "✅" if results["valid"] else "❌"
                print(f"{status} {date_str}")
                for diff, detail in results["details"].items():
                    ds = "✅" if detail["valid"] else "❌"
                    print(f"  {ds} {diff}", end="")
                    if detail["issues"]:
                        print(f": {'; '.join(detail['issues'])}", end="")
                    print()

        sys.exit(0 if results["valid"] else 1)

if __name__ == "__main__":
    main()
