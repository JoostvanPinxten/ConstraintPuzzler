---
name: test
description: Run the full ConstraintPuzzler check suite (pre-commit/ruff, pyright, unit + GUI smoke tests) exactly as CI does, and summarise the results.
---

Run these from the repository root, in order. Keep going after a failure, so the summary covers every step.

1. `uv sync`
2. `uv run pre-commit run --all-files` (ruff check, ruff format and file hygiene)
3. `uv run pyright` (if the `pyright` launcher can't start, use `uv run python -m pyright`)
4. `uv run python -m unittest discover -s . -p "test_*.py" -t . -v` with `QT_QPA_PLATFORM=offscreen` set

Then report a short table with each step, pass/fail, and counts (tests run/skipped/failed; pyright errors/warnings).
For each failure, quote the relevant error lines and propose (don't apply) a fix, unless the user asked you to fix things.
Don't describe pyright warnings as failures. CI only fails on errors.
