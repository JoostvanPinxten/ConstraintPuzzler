"""Parser for Sumbrero files, plus the hexagon geometry it relies on; see doc/puzzle-files.md
for the syntax."""

from collections.abc import Iterable

from constraints import TotalSumValueConstraint, UniqueValueConstraint
from parsers.common import PuzzleFileError, parseIndex, parsePosition, parseRange
from structure.position import Position
from structure.puzzle import Puzzle

# Sumbrero cells are flat-topped hexagons, laid out in columns: Position(x, y) is column x,
# row y, and every odd column is shifted down by half a hexagon. A line of cells runs in one
# of three directions: straight down (a column), down-right (a descending row) or up-right
# (an ascending row). Rows are numbered by the row y at which they cross column 0.

COLUMN = "Column"
DESCENDING_ROW = "Descending row"
ASCENDING_ROW = "Ascending row"

# per kind of line: (direction towards its start, direction towards its end)
LINE_DIRECTIONS = {
    COLUMN: ("N", "S"),
    DESCENDING_ROW: ("NW", "SE"),
    ASCENDING_ROW: ("SW", "NE"),
}


def descendingRow(position: Position) -> int:
    """Index of the row running down-right (south-east) through position."""
    return position.y() - position.x() // 2


def ascendingRow(position: Position) -> int:
    """Index of the row running up-right (north-east) through position."""
    return position.y() + (position.x() + 1) // 2


def neighbour(position: Position, direction: str) -> Position:
    """The adjacent position in direction N, S, NE, SE, NW or SW."""
    x, y = position.x(), position.y()
    shift = x % 2  # odd columns are half a hexagon lower
    offsets = {
        "N": (0, -1),
        "S": (0, 1),
        "NE": (1, shift - 1),
        "SE": (1, shift),
        "NW": (-1, shift - 1),
        "SW": (-1, shift),
    }
    dx, dy = offsets[direction]
    return Position(x + dx, y + dy)


def lineKind(group):
    """COLUMN, DESCENDING_ROW or ASCENDING_ROW for a line created by parseSumbreroLines,
    else None."""
    kind = group.getName().rsplit(" ", 1)[0]
    return kind if kind in LINE_DIRECTIONS else None


def parseSumbreroLines(lines: Iterable[str], filename: str = "<sumbrero>") -> Puzzle:
    """Reads the lines of a Sumbrero file. Raises PuzzleFileError (naming filename and the line)
    when they cannot be parsed."""
    lines = list(lines)

    # keyword -> (kind of line, index of the line through a position)
    lineStatements = {
        "column": (COLUMN, Position.x),
        "row_descending": (DESCENDING_ROW, descendingRow),
        "row_ascending": (ASCENDING_ROW, ascendingRow),
    }

    puzzle = None
    for lineNumber, rawLine in enumerate(lines, start=1):
        line = rawLine.strip()
        keyword = line.split("(")[0].split("=")[0].strip()
        if keyword not in ("range", "cell", *lineStatements):
            continue  # comments and blank lines

        try:
            if keyword == "range":
                puzzle = Puzzle("Test-sumbrero", parseRange(line.split("=")[1]))
                continue

            if puzzle is None:
                raise ValueError("'range = min,max' must come before cells and sums")

            if keyword == "cell":
                position = parsePosition(line[len("cell") :])
                if any(c.getPosition() == position for c in puzzle.getGrid().getCells()):
                    raise ValueError(f"cell {position} is declared twice")
                puzzle.getGrid().addCell(position)
                continue

            # column(c) = n, row_descending(r) = n or row_ascending(r) = n
            lineText, separator, valueText = line[len(keyword) :].partition("=")
            if not separator:
                raise ValueError(f"expected {keyword}(n) = value")
            kind, indexOf = lineStatements[keyword]
            index = parseIndex(lineText)
            lineCells = [
                c for c in puzzle.getGrid().getCells() if indexOf(c.getPosition()) == index
            ]
            if not lineCells:
                raise ValueError(f"{kind.lower()} {index} contains no cells")

            cg = puzzle.addConstraintGroup(f"{kind} {index}")
            for c in lineCells:
                cg.addCell(c)
            cg.addConstraint(UniqueValueConstraint)
            cg.addConstraint(TotalSumValueConstraint).setTotalValue(int(valueText))
        except PuzzleFileError:
            raise
        except Exception as e:
            raise PuzzleFileError(filename, lineNumber, f"{e} ({line})") from e

    if puzzle is None:
        raise PuzzleFileError(filename, len(lines), "no 'range = min,max' line found")

    return puzzle


def parseSumbreroFile(filename: str) -> Puzzle:
    with open(filename) as f:
        return parseSumbreroLines(f.readlines(), filename)
