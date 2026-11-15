"""The application version.

The single source of truth is ``[project].version`` in ``pyproject.toml``: bump it with
``uv version --bump patch|minor|major``. The PyInstaller build bundles ``pyproject.toml``, so the
same lookup works from source and from a standalone executable.
"""

import tomllib
from functools import cache

from utility.resources import resourcePath

APP_NAME = "ConstraintPuzzler"
UNKNOWN_VERSION = "0+unknown"


@cache
def getVersion() -> str:
    try:
        with open(resourcePath("pyproject.toml"), "rb") as f:
            return tomllib.load(f)["project"]["version"]
    except (OSError, KeyError, tomllib.TOMLDecodeError):
        return UNKNOWN_VERSION
