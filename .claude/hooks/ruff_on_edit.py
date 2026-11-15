"""Claude Code PostToolUse hook: ruff-format and ruff-fix a Python file after Claude edits it.

Reads the hook payload (JSON) from stdin. Never blocks editing: any problem exits 0.
Remaining lint findings are reported back to Claude via stderr with exit code 2 so it can
fix them in its next step.
"""

import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    file_path = (payload.get("tool_input") or {}).get("file_path")
    if not file_path or Path(file_path).suffix != ".py" or not Path(file_path).is_file():
        return 0

    ruff = [sys.executable, "-m", "ruff"]
    try:
        # Fix first (e.g. drop unused imports), then format, then report what is left.
        subprocess.run([*ruff, "check", "--fix", "--quiet", file_path], capture_output=True)
        subprocess.run([*ruff, "format", "--quiet", file_path], check=False)
        result = subprocess.run(
            [*ruff, "check", "--quiet", "--output-format=concise", file_path],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return 0  # ruff not available; don't get in the way

    if result.returncode == 1 and result.stdout.strip():
        print(f"ruff found issues it could not auto-fix:\n{result.stdout}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
