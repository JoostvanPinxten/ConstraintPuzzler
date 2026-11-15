# ConstraintPuzzler

A PySide6 (Python 3.13) application that solves number puzzles (Sudoku, Kakuro, Futoshiki and Sumbrero) by describing them as constraints over a grid of cells and then propagating those constraints.

## Layout
- `structure/`: the puzzle model. `Puzzle` holds a `Grid` of `Cell`s, and every `Cell` tracks its possible values. Model objects are `QObject`s, and cells emit Qt signals (`valueChanged`, `possibleValuesChanged`), so **PySide6 is required even for the non-GUI code and tests**.
- `constraints/`: the `Constraint` base class plus implementations (unique value, exact cover, total sum, greater-than, nonogram). `ConstraintGroup` groups constraints over sets of cells.
- `solver/Solver.py`: drives the deduction, i.e. applies constraints until a fixpoint is reached.
- `utility/puzzlefactory.py`: builds puzzles (empty Sudoku, example Kakuro, single-constraint test puzzles).
- `gui/`: the PySide6 GUI. `gui/windows/basicmainwindow.py` is the base window. `gui/puzzlerepresentation/` holds the cell shapes (rectangle, triangle, hexagon). `gui/puzzlemodel/` holds the tree model.
- `*Main.py` (repo root): one entry point per puzzle type. Each defines `MainWindow(BasicMainWindow)` with an ad-hoc text parser (`loadPuzzle(path)`) and the layout. Example puzzles are the root `*.txt` files.

## Running
```
pip install -r requirements-dev.txt
python sudokuMain.py            # or kakuroMain.py, sumbreroMain.py
```

## Tests and lint (what CI runs)
```
export QT_QPA_PLATFORM=offscreen          # headless Qt
ruff check .
python -m unittest discover -s . -p "*Test*.py" -t .   # unit tests in */tests/
python -m unittest discover -s . -p "test_*.py" -t .   # GUI smoke tests in tests/
```
Add new unit tests next to the code under `<package>/tests/`, using a file name containing `Test` so the first discover pass picks it up.

## Conventions
- Target Python 3.13 and PySide6. Widgets live in `QtWidgets` (not `QtGui`), and you call `exec()`, not `exec_()`.
- `futoshikiMain.py` has not been ported to PySide6 yet, so its smoke test is skipped.
- Never hand-edit the generated files `gui/ui/mainWindowUi.py` and `gui/icons/icons_rc.py`. Edit `mainwindow.ui` / `icons.qrc` and regenerate them with `gui/ui/compile_ui.bat` / `gui/icons/compile_icons.bat`.
- Existing code uses camelCase method names (Qt style). Keep that style for consistency.

## Review focus
When reviewing changes, prioritise: correctness of constraint propagation and possible-value bookkeeping, solver termination, grid coordinate off-by-ones, PySide6 API misuse (leftover Qt4/Qt5 APIs, signal signatures, object lifetimes), and missing tests.
