# Defining puzzles: grids and file formats

A puzzle in ConstraintPuzzler is a set of cells plus the constraint groups over them (see
[constraints.md](constraints.md)). Each puzzle type has a plain-text file format that describes
those cells and the clues, and a parser in its `*Main.py` that turns the file into cells and
constraint groups.

This page describes the three kinds of grid, the file syntax of each puzzle type, and how to
define a puzzle that has no file format yet, directly in Python.

- [Grid types and coordinates](#grid-types-and-coordinates)
- [Sudoku](#sudoku)
- [Futoshiki](#futoshiki)
- [Kakuro](#kakuro)
- [Sumbrero (work in progress)](#sumbrero-work-in-progress)
- [Opening your own puzzle file](#opening-your-own-puzzle-file)
- [Defining a puzzle in Python](#defining-a-puzzle-in-python)
- [Adding a new puzzle type](#adding-a-new-puzzle-type)

## Grid types and coordinates

Every cell has a `Position(x, y)`: **x is the column, y is the row**, and y grows downwards.
How cells are laid out depends on the grid type:

| Grid type | Used by | Cells | Coordinates in the file | Shape in the GUI |
|---|---|---|---|---|
| **Square grid** | Sudoku, Futoshiki | Every position of an N×N square is a cell. | Implicit: the file is a picture of the grid, one line per row. Futoshiki relations use 1-based `x,y`. | `ValueRectangle` |
| **Free-form grid** | Kakuro | Only the positions you list are cells; everything else is empty (black). | Explicit `cell(x,y)`, any integers. | `ValueRectangle`, clues as `ValueTriangle` |
| **Hexagonal grid** | Sumbrero | Only the positions you list are cells. | Explicit `cell(x,y)`, starting at 0. | `ValueHexagon` |

The hexagonal grid uses flat-topped hexagons in columns, with every **odd column shifted down by
half a hexagon** (an "odd-q" offset layout):

```
 x=0   x=1   x=2   x=3
 0,0         2,0
       1,0         3,0
 0,1         2,1
       1,1         3,1
```

The set of values a cell can take is the same for every cell of a puzzle: 1-9 for Sudoku, 1-N
for an N×N Futoshiki, and the `range` line for Kakuro and Sumbrero. The GUI shows at most nine
pencil-mark hints per cell, so puzzles with more than nine values only show the first nine.

## Sudoku

Parser: `PuzzleFactory.fromSudokuFile` (`utility/puzzlefactory.py`). Examples: `easySudoku.txt`,
`mediumSudoku.txt`, `hardSudoku.txt`.

A 9×9 picture of the grid: nine lines, nine entries per line, separated by whitespace. A digit
1-9 is a given; anything else (`-`, `0`, `.`) is an empty cell.

```
- 6 9 - - - - - 2
8 2 - 3 6 - - 9 -
3 - - - 9 - - - 1
- - - 4 - - - 5 -
- 5 2 1 - 3 - - 6
1 - 4 - - 6 - 7 3
5 - 7 6 - - - - 8
- - 3 - - 1 5 6 -
- - - 5 3 2 - - -
```

What it builds: 81 cells, and one group with an `ExactCoverConstraint` for every row, column and
3×3 block. The size is always 9×9.

Things to watch:

- Entries must be separated by whitespace: `-69----2` is read as one (empty) entry.
- Every line counts as a row, including blank lines and comments, so the file should contain
  only the nine grid lines.
- Two givens that conflict (e.g. two 5s in a row) raise a `ContradictionError` while loading.

## Futoshiki

Parser: `PuzzleFactory.fromFutoshikiFile` (`utility/puzzlefactory.py`). Example: `futoshiki.txt`.

A Futoshiki file has two parts: the grid, in the same format as a Sudoku, followed by a line
`relativity` and the inequality signs.

```
5 - - - - - 6
- - - - - - -
- - - - - - -
- - - - - - -
- - - - - - -
- - - - - - -
- - 2 - - - 5

relativity
2,1>3,1
4,1>3,1
2,2>2,1
```

**Grid part.** The number of (non-blank) grid lines N sets the size: the puzzle is N×N with
values 1 to N. Blank lines in the grid part are ignored.

**Relations part.** Each line `x1,y1>x2,y2` means *the cell in column x1, row y1 is greater than
the cell in column x2, row y2*. Coordinates are **1-based**, column first. In the example,
`2,1>3,1` says that in the top row the second cell is greater than the third.

- Only `>` is understood. Write `a < b` as `b>a`.
- Lines without `>` (blank lines, notes) are ignored.
- The two cells do not need to be neighbours, although in a real Futoshiki they always are.
- The `relativity` part is optional; without it you get a Latin square.

What it builds: one `ExactCoverConstraint` group per row and per column, and one two-cell group
with a `CellGreaterThanCellConstraint` per relation.

## Kakuro

Parser: `MainWindow.parsePuzzle` in `kakuroMain.py`. Examples: `simpleKakuro.txt`,
`mediumKakuro.txt`.

A Kakuro file is a list of statements, one per line. Unlike the square grids, you list the white
cells and the clues explicitly.

```
# values 1-9
range = 1,9

# the white cells: cell(column,row)
cell(1,1)
cell(2,1)
cell(1,2)
cell(2,2)

# the clues: total((column,row);(column,row);...) = sum
total((1,1);(2,1)) = 3
total((1,2);(2,2)) = 4
total((1,1);(1,2)) = 4
total((2,1);(2,2)) = 3
```

(This tiny puzzle solves to `1 2` / `3 1`.)

| Statement | Meaning |
|---|---|
| `range = min,max` | The values every cell can take, inclusive. Must come first. |
| `cell(x,y)` | A white cell in column x, row y. |
| `total((x,y);(x,y);...) = n` | The listed cells add up to n and contain no duplicates. |
| anything else | Ignored, so `# ...` lines and blank lines can be used as comments. |

What it builds: one group per `total`, with a `UniqueValueConstraint` and a
`TotalSumValueConstraint` set to n. A cell is usually in two totals, one across and one down.

Rules and pitfalls:

- **Order:** `range` first, then the cells, then the totals. A total that refers to a cell that
  was not declared (yet) stops loading with `Exception: Not found Position(x, y)`.
- **No spaces between the cells of a total.** Write `total((1,1);(2,1)) = 3`. With
  `total((1,1); (2,1)) = 3` the second cell cannot be read, and the line is printed to the
  console and the *previous* cell is silently used in its place, giving a wrong puzzle. Spaces
  around `=` are fine.
- **Statements start at the beginning of the line.** An indented `  cell(1,1)` is ignored.
- **List the cells of a total in order, from left to right or top to bottom, with at least two
  cells.** The solver does not care, but the GUI draws the clue triangle next to the first cell:
  to its left when the first two cells are on the same row, above it when they are in the same
  column. Leave column 0 and row 0 free (start your cells at 1) so the clues of the first row
  and column have room.

## Sumbrero (work in progress)

Parser: `MainWindow.parsePuzzle` in `sumbreroMain.py`. Example: `simpleSumbrero.txt`.

Sumbrero uses the hexagonal grid. Like Kakuro, the file lists the cells, but the clues refer to a
whole column or diagonal row instead of listing cells.

```
range = 1,9

cell(0,0)
cell(0,1)
cell(1,0)
cell(1,1)

column(0) = 11
row_ascending(0) = 10
row_descending(0) = 5
```

| Statement | Meaning |
|---|---|
| `range = min,max` | The values every cell can take, inclusive. Must come first. |
| `cell(x,y)` | A hexagon in column x, row y (0-based; odd columns are shifted down). |
| `column(c) = n` | All cells with x = c add up to n, without duplicates. |
| `row_ascending(r) = n` | The cells of diagonal row r add up to n, without duplicates. |
| `row_descending(r) = n` | As above, for the other diagonal direction. |

Lines are stripped, so indentation is allowed here; other lines are ignored. Declare all cells
before the clues: a clue only collects the cells that exist when it is read.

**Known limitation:** which cells belong to diagonal row r is computed by `hexrow()` as
`y + x - x % 2`, for both directions. `row_ascending(r)` and `row_descending(r)` therefore
currently select the *same* cells, and those cells do not always form a straight line of
hexagons. Column clues work as intended. Treat row clues as unfinished until `hexrow()` is fixed.

## Opening your own puzzle file

| Puzzle | How to open a file |
|---|---|
| Sudoku | *File > Open Sudoku* (`*.txt`, `*.sud`) |
| Futoshiki | *File > Open Futoshiki* (`*.txt`, `*.fut`) |
| Kakuro, Sumbrero | No menu yet: they open their bundled example. Change the file name in the `__main__` block of `kakuroMain.py` / `sumbreroMain.py`, or load it from Python (below). |

You can also parse and solve a file without the GUI, which gives clearer error messages while
you are writing a puzzle:

```python
from solver.Solver import Solver
from utility.puzzlefactory import PuzzleFactory

puzzle = PuzzleFactory.fromFutoshikiFile("myFutoshiki.txt")  # or fromSudokuFile
solver = Solver(puzzle, allowGuessing=True)
print(solver.solve())  # True when solved
for cell in puzzle.getGrid().getCells():
    print(cell.getPosition(), cell.getValue())
```

For Kakuro, `from kakuroMain import MainWindow` and `puzzle, solver = MainWindow.parsePuzzle(path)`
do the same (this imports PySide6, but does not open a window).

## Defining a puzzle in Python

A puzzle does not need a file format: you can build any grid and any combination of constraints
in code. The steps are always the same:

1. Create a `Puzzle` with its name and the set of values.
2. Add cells to its grid with `puzzle.grid.addCell(Position(x, y))`.
3. Add constraint groups, give each group its constraints and its cells.
4. Set the givens with `cell.setValue(v)`, after the groups exist (setting a value notifies the
   groups the cell is already in).
5. Solve with `Solver(puzzle).solve()`.

Example: a 4×4 Futoshiki-like puzzle where every row and column contains 1-4, the top-left 2×2
area adds up to 10, and one cell is smaller than its neighbour.

```python
from constraints import TotalSumValueConstraint
from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.exactcoverconstraint import ExactCoverConstraint
from solver.Solver import Solver
from structure.position import Position
from structure.puzzle import Puzzle

puzzle = Puzzle("My puzzle", {1, 2, 3, 4})
cells = {(x, y): puzzle.grid.addCell(Position(x, y)) for y in range(1, 5) for x in range(1, 5)}

for i in range(1, 5):
    row = puzzle.addConstraintGroup(f"Row {i}")
    row.addConstraint(ExactCoverConstraint)
    column = puzzle.addConstraintGroup(f"Column {i}")
    column.addConstraint(ExactCoverConstraint)
    for j in range(1, 5):
        row.addCell(cells[(j, i)])
        column.addCell(cells[(i, j)])

corner = puzzle.addConstraintGroup("Corner")
for position in [(1, 1), (2, 1), (1, 2), (2, 2)]:
    corner.addCell(cells[position])
corner.addConstraint(TotalSumValueConstraint).setTotalValue(10)

sign = puzzle.addConstraintGroup("(3,1) < (4,1)")
greater = sign.addConstraint(CellGreaterThanCellConstraint)
sign.addCell(cells[(3, 1)])
sign.addCell(cells[(4, 1)])
greater.setLesserCell(cells[(3, 1)])
greater.setGreaterCell(cells[(4, 1)])

cells[(1, 1)].setValue(1)

print(Solver(puzzle, allowGuessing=True).solve())
```

Notes:

- The order of `addCell` calls matters for square grids: `grid.getCellFromSquareGrid(x, y)`
  (0-based) assumes the cells were added row by row, which `fromSudokuFile` and
  `fromFutoshikiFile` rely on. For other layouts, look cells up with
  `grid.searchCellWithPosition(Position(x, y))`.
- A cell can be in any number of groups, and the groups do not need to be rows or columns: any
  set of cells works. This is how you add extra regions, diagonals or cages.
- For `TotalSumValueConstraint`, add the cells (and any `UniqueValueConstraint`) before calling
  `setTotalValue`; see [constraints.md](constraints.md#totalsumvalueconstraint).

## Adding a new puzzle type

To make a puzzle type available in the GUI and the launcher, you need a parser for its file
format, a window that draws its cells, an example file and tests. The `/new-puzzle <name>`
Claude Code skill scaffolds all of these. By hand:

1. Create `<name>Main.py` with a `MainWindow(BasicMainWindow)` that implements
   `parsePuzzle(filename)` (returning `(puzzle, solver)`) and `initializePuzzleRepresentation()`
   (one `ValueRectangle`, `ValueTriangle` or `ValueHexagon` per cell, see the existing
   windows).
2. Add an example `<name>.txt` in the repository root, and add it to `datas` in
   `constraintpuzzler.spec` so the standalone build includes it.
3. Register the type in the `PUZZLES` dict in `constraintPuzzlerMain.py`.
4. Add parser tests, and the window to `tests/test_gui_smoke.py`.
