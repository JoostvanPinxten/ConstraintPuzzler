"""The registry of puzzle types: one place that describes each type the app supports.

The launcher, the puzzle windows, the tests and the PyInstaller spec all read it. It does not
import PySide6, so it can be used by the model, the tests and the build without a GUI.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

from parsers import parseFutoshikiFile, parseKakuroFile, parseSudokuFile, parseSumbreroFile
from structure.puzzle import Puzzle


@dataclass(frozen=True)
class PuzzleType:
    # identifier, used on the command line (--puzzle) and as the registry key
    name: str
    # shown to the user, e.g. in menus and window titles
    label: str
    # reads a puzzle file into a Puzzle
    parser: Callable[[str], Puzzle]
    # the filter of the open-file dialog
    fileFilter: str
    # the bundled example puzzles: label -> file name (repo root / bundle), in menu order
    examples: Mapping[str, str] = field(default_factory=dict)
    # the example that is opened when no file is given
    defaultExample: str | None = None
    # the module that defines this type's MainWindow (a *Main.py entry point)
    windowModule: str = ""

    def __post_init__(self):
        if self.defaultExample is not None and self.defaultExample not in self.examples:
            raise ValueError(f"{self.name}: default example {self.defaultExample!r} not listed")

    def exampleFiles(self) -> list[str]:
        return list(self.examples.values())


SUDOKU = PuzzleType(
    name="sudoku",
    label="Sudoku",
    parser=parseSudokuFile,
    fileFilter="Sudoku Files (*.txt *.sud)",
    examples={"Easy": "easySudoku.txt", "Medium": "mediumSudoku.txt", "Hard": "hardSudoku.txt"},
    defaultExample="Easy",
    windowModule="sudokuMain",
)

KAKURO = PuzzleType(
    name="kakuro",
    label="Kakuro",
    parser=parseKakuroFile,
    fileFilter="Kakuro Files (*.txt)",
    examples={"Simple": "simpleKakuro.txt", "Medium": "mediumKakuro.txt"},
    defaultExample="Medium",
    windowModule="kakuroMain",
)

FUTOSHIKI = PuzzleType(
    name="futoshiki",
    label="Futoshiki",
    parser=parseFutoshikiFile,
    fileFilter="Futoshiki Files (*.txt *.fut)",
    examples={"7x7": "futoshiki.txt"},
    defaultExample="7x7",
    windowModule="futoshikiMain",
)

SUMBRERO = PuzzleType(
    name="sumbrero",
    label="Sumbrero",
    parser=parseSumbreroFile,
    fileFilter="Sumbrero Files (*.txt)",
    examples={"Simple": "simpleSumbrero.txt"},
    defaultExample="Simple",
    windowModule="sumbreroMain",
)

# name -> PuzzleType, in the order the launcher shows them
PUZZLE_TYPES: dict[str, PuzzleType] = {t.name: t for t in (SUDOKU, KAKURO, FUTOSHIKI, SUMBRERO)}


def exampleFiles() -> list[str]:
    """All bundled example files of all puzzle types."""
    return [f for t in PUZZLE_TYPES.values() for f in t.exampleFiles()]
