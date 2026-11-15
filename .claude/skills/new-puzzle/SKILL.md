---
name: new-puzzle
description: Scaffold support for a new puzzle type in ConstraintPuzzler (entry point, parser, example file, GUI layout, tests). Use when the user wants to add a puzzle like Killer Sudoku, KenKen, Hidato, etc.
argument-hint: <puzzle name> [rules or link]
---

Add a new puzzle type: $ARGUMENTS

1. Before writing code, express the puzzle's rules in terms of existing constraints in `constraints/`
   (UniqueValueConstraint, ExactCoverConstraint, TotalSumValueConstraint, CellGreaterThanCellConstraint).
   If a rule can't be expressed with them, propose a new constraint and scaffold it with the `/new-constraint` workflow.
2. Pick the closest existing entry point as a template:
   - square grid with given digits → `sudokuMain.py`
   - cells and sum clues → `kakuroMain.py`
   - non-rectangular geometry → `sumbreroMain.py` (uses `ValueHexagon`)
3. Write the parser in `parsers/<name>.py`: `parse<Name>Lines(lines) -> Puzzle` plus a `parse<Name>File(filename)`
   wrapper that opens the file with `with open(...)`; export both from `parsers/__init__.py`. No PySide6 imports.
   Raise `parsers.PuzzleFileError` (see `parsers/kakuro.py`) for malformed lines. Add a small example puzzle file
   `<name>.txt` in the repo root and document its format in `doc/puzzle-files.md`.
4. Create `<name>Main.py` with a `MainWindow(BasicMainWindow)` that sets `puzzleTypeName`, `fileFilter` and
   `puzzleParser = staticmethod(parse<Name>File)`, and implements `initializePuzzleRepresentation()`.
5. If useful, add a factory method in `utility/puzzlefactory.py`.
6. Tests: add parser tests in `parsers/tests/test_parsers.py`, a solver test that loads the example and checks the deductions, and a case to
   `tests/test_gui_smoke.py` (`self._smoke("<name>Main", "<name>.txt")`).
7. Add the puzzle to the README list. Run the `/test` checks and fix anything that fails.
