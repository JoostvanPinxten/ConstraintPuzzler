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


# The Android build ships pyproject.toml under another name: python-for-android would otherwise
# expect the app to be an installable package and leave its sources out (see android/build_apk.sh).
PROJECT_FILES = ("pyproject.toml", "project-metadata.toml")


@cache
def getVersion() -> str:
    for name in PROJECT_FILES:
        try:
            with open(resourcePath(name), "rb") as f:
                return tomllib.load(f)["project"]["version"]
        except (OSError, KeyError, tomllib.TOMLDecodeError):
            continue
    return UNKNOWN_VERSION
