"""Text-file parsers that turn a puzzle description into a `Puzzle`.

Each puzzle type has a `parse<Type>Lines(lines)` function that works on the lines of a puzzle
description and a `parse<Type>File(filename)` wrapper that reads a file. The parsers only build
the model: like `structure`, `constraints` and `solver`, they must not import PySide6.
The file formats are described in doc/puzzle-files.md.
"""

from parsers.common import PuzzleFileError
from parsers.futoshiki import parseFutoshikiFile, parseFutoshikiLines
from parsers.kakuro import parseKakuroFile, parseKakuroLines
from parsers.sudoku import parseSudokuFile, parseSudokuLines
from parsers.sumbrero import parseSumbreroFile, parseSumbreroLines

__all__ = [
    "PuzzleFileError",
    "parseFutoshikiFile",
    "parseFutoshikiLines",
    "parseKakuroFile",
    "parseKakuroLines",
    "parseSudokuFile",
    "parseSudokuLines",
    "parseSumbreroFile",
    "parseSumbreroLines",
]
