"""Locate files shipped with the application, both from source and from a PyInstaller bundle."""

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def resourceRoot() -> Path:
    """The directory holding the bundled data files (example puzzles, pyproject.toml)."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return _REPO_ROOT


def resourcePath(*parts: str) -> str:
    """Absolute path of a bundled data file, e.g. ``resourcePath("easySudoku.txt")``."""
    return str(resourceRoot().joinpath(*parts))
