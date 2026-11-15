"""Parser for 9x9 Sudoku files; see doc/puzzle-files.md for the syntax."""

from collections.abc import Iterable

from structure.puzzle import Puzzle
from utility.puzzlefactory import PuzzleFactory


def readGridValues(puzzle: Puzzle, lines: Iterable[str]) -> None:
    """Sets the givens of a square grid: one row per line, values separated by
    whitespace. Anything that is not one of the puzzle values is an empty cell."""
    values = puzzle.getValues()
    for y, line in enumerate(lines):
        for x, el in enumerate(line.split()):
            if el.isdigit() and int(el) in values:
                puzzle.grid.setConstraintGridValue(x, y, int(el))


def parseSudokuLines(lines: Iterable[str]) -> Puzzle:
    """Reads a 9x9 sudoku: one row per line, values separated by spaces.
    Anything that is not one of the puzzle values (e.g. '-' or '0') is an empty cell."""
    sudoku = PuzzleFactory.createEmptySudoku()
    readGridValues(sudoku, lines)
    return sudoku


def parseSudokuFile(filename: str) -> Puzzle:
    with open(filename) as f:
        return parseSudokuLines(f.readlines())
