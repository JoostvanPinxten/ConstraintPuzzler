"""Building blocks shared by the puzzle file parsers."""

import re

from structure.position import Position

_POSITION_PATTERN = re.compile(r"\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)")
_INTEGER_PATTERN = re.compile(r"\(\s*(-?\d+)\s*\)")


class PuzzleFileError(ValueError):
    """A puzzle file could not be parsed; the message names the file and line."""

    def __init__(self, filename: str, lineNumber: int, message: str) -> None:
        super().__init__(f"{filename}, line {lineNumber}: {message}")


def parsePosition(text: str) -> Position:
    """Parses '(x,y)' (whitespace allowed) into a Position, or raises ValueError."""
    match = _POSITION_PATTERN.fullmatch(text.strip())
    if match is None:
        raise ValueError(f"expected a cell like (x,y), got {text.strip()!r}")
    return Position(int(match.group(1)), int(match.group(2)))


def parsePositionList(text: str) -> list[Position]:
    """Parses '(x,y);(x,y);...' (whitespace allowed) into a list of Positions,
    or raises ValueError."""
    return [parsePosition(part) for part in text.split(";")]


def parseIndex(text: str) -> int:
    """Parses '(n)' (whitespace allowed) into an int, or raises ValueError."""
    match = _INTEGER_PATTERN.fullmatch(text.strip())
    if match is None:
        raise ValueError(f"expected a number like (n), got {text.strip()!r}")
    return int(match.group(1))


def parseRange(text: str) -> range:
    """Parses 'min,max' into the inclusive range of values, or raises ValueError."""
    parts = text.split(",")
    if len(parts) != 2:
        raise ValueError(f"expected a range like 1,9, got {text.strip()!r}")
    minimum, maximum = (int(part) for part in parts)
    if minimum > maximum:
        raise ValueError(f"range {minimum},{maximum} is empty")
    return range(minimum, maximum + 1)
