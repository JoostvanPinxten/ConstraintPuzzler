# ConstraintPuzzler

A PySide6 (Python 3.13) application that solves number puzzles (Sudoku, Kakuro, Futoshiki and Sumbrero) by describing them as constraints over a grid of cells and then propagating those constraints.

## Layout
- `structure/`: the puzzle model. `Puzzle` holds a `Grid` of `Cell`s, and every `Cell` tracks its possible values. Positions are `structure.position.Position`, not `QPoint`. Cells notify observers via the minimal `structure.signal.Signal` (`valueChanged`, `possibleValuesChanged`). **The model, constraints and solver must not import PySide6.** Unlike Qt signals, exceptions raised in callbacks propagate, which the solver relies on.
- `constraints/`: the `Constraint` base class plus implementations (unique value, exact cover, total sum, greater-than). `ConstraintGroup` groups constraints over sets of cells. A constraint that detects an unsolvable state raises `structure.errors.ContradictionError`.
- `solver/Solver.py`: repeats deduction until nothing changes. With `allowGuessing` it backtracks, and on a contradiction it restores the puzzle via `Puzzle.saveState()`/`restoreState()`.
- `utility/version.py` / `utility/resources.py`: `getVersion()` reads the version from `pyproject.toml`, and `resourcePath()` locates bundled data files (repo root from source, `sys._MEIPASS` in a PyInstaller build). Use `resourcePath` for files shipped with the app.
- `utility/puzzletypes.py`: the registry of puzzle types. A `PuzzleType` (name, label, parser, file filter, examples, default example, window module) per type in `PUZZLE_TYPES`; the launcher, the windows, the GUI smoke tests and `constraintpuzzler.spec` all read it. No PySide6.
- `utility/puzzlefactory.py`: builds puzzles (empty Sudoku, empty Futoshiki, example Kakuro, single-constraint test puzzles).
- `parsers/`: the puzzle file parsers, one module per type (`sudoku`, `futoshiki`, `kakuro`, `sumbrero`), each with `parse<Type>Lines(lines)` and `parse<Type>File(filename)` returning a `Puzzle`. `parsers/common.py` holds `PuzzleFileError` and the `parseRange`/`parsePosition`/`parseIndex` helpers; `parsers/sumbrero.py` also holds the hexagon line geometry. **The parsers must not import PySide6 either** (a test checks this).
- `gui/`: the PySide6 GUI. `gui/windows/basicmainwindow.py` is the base window. `gui/puzzlerepresentation/` holds the cell shapes (rectangle, triangle, hexagon). `gui/puzzlemodel/puzzletreemodel.py` builds the tree view from a finished puzzle (`buildPuzzleTree`).
- `*Main.py` (repo root): one entry point per puzzle type. Each defines `MainWindow(BasicMainWindow)` with the layout and sets `puzzleType` to its registry entry; `BasicMainWindow.parsePuzzle`/`loadPuzzle(path)`/`loadExample()` and the open-file dialog use it. Example puzzles are the root `*.txt` files listed in the registry. `constraintPuzzlerMain.py` is the launcher used for the standalone executable: a single `LauncherWindow` with one tab per open puzzle (the puzzle windows are embedded with `embedded=True`, which hides their own menus), a start page, `--puzzle`, `--version` and `--smoke-test`. Solver settings such as *Allow guessing* live in a `gui.settings.PuzzleSettings` shared by all tabs. It imports each type's window via `windowClass(name)`, from the registry.

## Tooling
The environment is managed by **uv** (`pyproject.toml` + `uv.lock`). Don't use pip or requirements files.
```
uv sync                                   # create/update .venv (runtime + dev group)
uv run python sudokuMain.py               # or kakuroMain.py, sumbreroMain.py
uv add <pkg> / uv add --dev <pkg>         # change dependencies (updates uv.lock)
uv version --bump patch|minor|major       # bump the version (pyproject.toml + uv.lock)
uv run python -m PyInstaller constraintpuzzler.spec --noconfirm   # standalone build in dist/
```
- The version is only defined in `pyproject.toml`. Never hard-code version strings; use `utility.version.getVersion()`.
- Releases: pushing a tag `vX.Y.Z` (must equal the pyproject version) runs `.github/workflows/release.yml`, which builds and smoke-tests PyInstaller bundles on Windows/Linux/macOS and publishes a GitHub Release. New data files the app needs at runtime must be added to `datas` in `constraintpuzzler.spec`.

## Checks (what CI runs)
```
uv run pre-commit run --all-files                                   # ruff check + ruff format + file hygiene
uv run pyright                                                      # type check (basic mode)
QT_QPA_PLATFORM=offscreen uv run python -m unittest discover -s . -p "test_*.py" -t .
```
- Tests: unit tests in `<package>/tests/test_*.py`, headless GUI smoke tests in `tests/test_gui_smoke.py`.
- Ruff rules: E, W, F, I, UP, B and SIM, with line length 100. Fix findings rather than adding `noqa`.
- Pyright: errors fail CI. `reportOptionalMemberAccess` is a warning for now. Don't add new warnings.
- In Claude Code, a PostToolUse hook (`.claude/hooks/ruff_on_edit.py`) runs ruff fix + format on every edited `.py` file.

## Skills (slash commands)
- `/test`: run all checks like CI and summarise.
- `/new-constraint <Name> <rule>`: scaffold a `Constraint` subclass with tests.
- `/new-puzzle <name>`: scaffold a new puzzle type (entry point, parser, example file, tests).

## Conventions
- Target Python 3.13 and PySide6. Widgets live in `QtWidgets` (not `QtGui`). Call `exec()`, not `exec_()`. Use fully scoped enums (`Qt.ItemDataRole.DisplayRole`, not `Qt.DisplayRole`).
- Never hand-edit the generated files `gui/ui/mainWindowUi.py` and `gui/icons/icons_rc.py`. Edit `mainwindow.ui` / `icons.qrc` and regenerate them with `gui/ui/compile_ui.bat` / `gui/icons/compile_icons.bat`.
- Existing code uses camelCase method names (Qt style). Keep that style for consistency.
- Open files with `with open(...)`.

## Review focus
When reviewing changes, prioritise: correctness of constraint propagation and possible-value bookkeeping, solver termination, grid coordinate off-by-ones, PySide6 API misuse (leftover Qt4/Qt5 APIs, signal signatures, object lifetimes), and missing tests.
