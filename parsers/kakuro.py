"""Parser for Kakuro files; see doc/puzzle-files.md for the syntax."""

from collections.abc import Iterable

from constraints import TotalSumValueConstraint, UniqueValueConstraint
from parsers.common import PuzzleFileError, parsePosition, parsePositionList, parseRange
from structure.puzzle import Puzzle


def parseKakuroLines(lines: Iterable[str], filename: str = "<kakuro>") -> Puzzle:
    """Reads the lines of a Kakuro file. Raises PuzzleFileError (naming filename and the line)
    when they cannot be parsed."""
    lines = list(lines)
    puzzle = None
    cells = {}  # Position -> Cell, for the cells declared so far
    for lineNumber, rawLine in enumerate(lines, start=1):
        line = rawLine.strip()
        if not line.startswith(("range", "cell", "total")):
            continue  # comments and blank lines

        try:
            if line.startswith("range"):
                puzzle = Puzzle("Test-kakuro", parseRange(line.split("=")[1]))
                continue

            if puzzle is None:
                raise ValueError("'range = min,max' must come before cells and totals")

            if line.startswith("cell"):
                position = parsePosition(line[len("cell") :])
                if position in cells:
                    raise ValueError(f"cell {position} is declared twice")
                cells[position] = puzzle.getGrid().addCell(position)

            else:  # total((x,y);(x,y);...) = value
                cellText, separator, valueText = line[len("total") :].rpartition("=")
                cellText = cellText.strip()
                if not separator or not (cellText.startswith("(") and cellText.endswith(")")):
                    raise ValueError("expected total((x,y);(x,y);...) = value")
                positions = parsePositionList(cellText[1:-1])
                value = int(valueText)

                for position in positions:
                    if position not in cells:
                        raise ValueError(f"cell {position} is used before it is declared")
                if len(set(positions)) != len(positions):
                    raise ValueError("a cell appears more than once in this total")

                cg = puzzle.addConstraintGroup("Line")
                for position in positions:
                    cg.addCell(cells[position])
                cg.addConstraint(UniqueValueConstraint)
                tsvc = cg.addConstraint(TotalSumValueConstraint)
                tsvc.setTotalValue(value)
        except PuzzleFileError:
            raise
        except Exception as e:
            raise PuzzleFileError(filename, lineNumber, f"{e} ({line})") from e

    if puzzle is None:
        raise PuzzleFileError(filename, len(lines), "no 'range = min,max' line found")

    return puzzle


def parseKakuroFile(filename: str) -> Puzzle:
    with open(filename) as f:
        return parseKakuroLines(f.readlines(), filename)
