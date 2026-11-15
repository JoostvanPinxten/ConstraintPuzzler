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
3. Create `<name>Main.py` with a `MainWindow(BasicMainWindow)` that implements
   `initializePuzzleRepresentation()`, a `parsePuzzle(filename)` static method that opens files with `with open(...)`,
   and `createMenus()`. Add a small example puzzle file `<name>.txt` in the repo root, and document its format
   in the parser's docstring.
4. If useful, add a factory method in `utility/puzzlefactory.py`.
5. Tests: add a solver/constraint test that loads the example and checks the deductions, and add a case to
   `tests/test_gui_smoke.py` (`self._smoke("<name>Main", "<name>.txt")`).
6. Add the puzzle to the README list. Run the `/test` checks and fix anything that fails.
