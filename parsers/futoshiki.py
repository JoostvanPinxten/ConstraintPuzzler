"""Parser for square Futoshiki files; see doc/puzzle-files.md for the syntax."""

from collections.abc import Iterable

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from parsers.sudoku import readGridValues
from structure.puzzle import Puzzle
from utility.puzzlefactory import PuzzleFactory


def parseFutoshikiLines(lines: Iterable[str]) -> Puzzle:
    """Reads a square futoshiki: the grid in the sudoku file format, followed by a
    'relativity' line and one 'x1,y1>x2,y2' line per inequality (1-based coordinates),
    meaning that cell (x1,y1) is greater than cell (x2,y2)."""
    lines = [line.strip() for line in lines]

    if "relativity" in lines:
        split = lines.index("relativity")
        gridLines, relationLines = lines[:split], lines[split + 1 :]
    else:
        gridLines, relationLines = lines, []
    gridLines = [line for line in gridLines if line]

    puzzle = PuzzleFactory.createFutoshikiPuzzle(len(gridLines))
    readGridValues(puzzle, gridLines)

    for line in relationLines:
        if ">" not in line:
            continue
        greater, lesser = [[int(v) - 1 for v in cell.split(",")] for cell in line.split(">")]
        greaterCell = puzzle.grid.getCellFromSquareGrid(*greater)
        lesserCell = puzzle.grid.getCellFromSquareGrid(*lesser)

        cg = puzzle.addConstraintGroup("Relativity")
        constraint = cg.addConstraint(CellGreaterThanCellConstraint)
        cg.addCell(greaterCell)
        cg.addCell(lesserCell)
        constraint.setGreaterCell(greaterCell)
        constraint.setLesserCell(lesserCell)

    return puzzle


def parseFutoshikiFile(filename: str) -> Puzzle:
    with open(filename) as f:
        return parseFutoshikiLines(f.readlines())
