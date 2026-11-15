# Constraints

ConstraintPuzzler does not know what a Sudoku or a Kakuro is. It knows about **cells**,
**constraint groups** and **constraints**. A puzzle is a set of cells, and every rule of the
puzzle ("each row contains 1-9 once", "these cells add up to 17", "this cell is smaller than
that one") is a constraint attached to a group of cells. The solver repeatedly asks every
constraint to remove values that can no longer be correct, until nothing changes anymore.

This page explains the building blocks and each constraint type: what rule it expresses, what
it deduces, and how to use it.

- [The building blocks](#the-building-blocks)
- [How the solver uses constraints](#how-the-solver-uses-constraints)
- [Constraint types at a glance](#constraint-types-at-a-glance)
- [UniqueValueConstraint](#uniquevalueconstraint)
- [ExactCoverConstraint](#exactcoverconstraint)
- [TotalSumValueConstraint](#totalsumvalueconstraint)
- [CellGreaterThanCellConstraint](#cellgreaterthancellconstraint)
- [NonogramConstraint (experimental)](#nonogramconstraint-experimental)
- [How the puzzles combine constraints](#how-the-puzzles-combine-constraints)
- [Writing your own constraint](#writing-your-own-constraint)

## The building blocks

| Concept | Where | What it is |
|---|---|---|
| `Puzzle` | `structure/puzzle.py` | The top-level object. It has the list of allowed values (e.g. 1-9), a `Grid` of cells and the constraint groups. |
| `Cell` | `structure/cell.py` | One square (or triangle, hexagon...) of the puzzle. It keeps the set of values that are still **possible**, and its **value** once it is known. |
| `ConstraintGroup` | `constraints/constraintgroup.py` | A named set of cells (a row, a block, a Kakuro line...) with one or more constraints that apply to all of them. A cell can be in many groups. |
| `Constraint` | `constraints/constraint.py` | A rule over the cells of its group. It narrows down the possible values of those cells. |

A cell starts with every puzzle value as a possibility. Solving means removing possibilities:

- `cell.remove(value)` removes one possibility. If no possibility is left, the puzzle is
  contradictory.
- `cell.setValue(value)` / `cell.inferValue(value)` fixes the value of the cell (a given vs. a
  value the solver deduced). The other possibilities disappear.

Whenever something impossible happens (removing the last possibility of a cell, removing the
value a cell already has, setting a value that is no longer possible, a sum that does not add
up) a `structure.errors.ContradictionError` is raised.

A minimal example: a group of three cells whose values must all differ.

```python
from constraints import UniqueValueConstraint
from structure.position import Position
from structure.puzzle import Puzzle

puzzle = Puzzle("Example", {1, 2, 3})
cells = [puzzle.grid.addCell(Position(x, 1)) for x in range(1, 4)]

group = puzzle.addConstraintGroup("Row 1")
group.addConstraint(UniqueValueConstraint)  # pass the class, the group creates the instance
for cell in cells:
    group.addCell(cell)

cells[0].setValue(2)
print(cells[1].getPossibleValues())  # {1, 3}
```

## How the solver uses constraints

Constraints get two chances to deduce something:

1. **`notify(cell)`: immediately, when a cell gets a value.** A group listens to the
   `valueChanged` signal of each of its cells and forwards it to all its constraints. This is
   how "a 5 was placed here, so no other cell in this row can be a 5" happens at once.
2. **`applyConstraint()`: once per solver pass.** `Solver.step()` first fixes every cell that
   has a single possibility left, then calls `applyConstraint()` on every constraint of every
   group. Constraints that need to look at the whole group (sums, hidden singles, pairs) do
   their work here.

`Solver.propagate()` repeats these passes until a pass changes nothing. If the puzzle is still
not solved and guessing is enabled (*Solver > Allow guessing*), the solver picks the open cell
with the fewest possibilities, tries a value, and propagates again. A `ContradictionError`
raised by any constraint means the guess was wrong: the solver restores the saved state and
tries the next value.

Because propagation and contradictions are all a constraint has to provide, a constraint does
not need to be complete: deducing *some* values is enough, as long as it never removes a value
that could still be correct.

## Constraint types at a glance

| Constraint | Rule | Typical use | Extra setup |
|---|---|---|---|
| `UniqueValueConstraint` | No value appears twice in the group | Kakuro lines, Sumbrero lines | none |
| `ExactCoverConstraint` | Every value appears exactly once in the group | Sudoku rows/columns/blocks, Futoshiki rows/columns | none |
| `TotalSumValueConstraint` | The values in the group add up to a total | Kakuro clues, Sumbrero sums | `setTotalValue(n)` |
| `CellGreaterThanCellConstraint` | One cell is smaller than another | Futoshiki `<` / `>` signs | `setLesserCell`, `setGreaterCell` |
| `NonogramConstraint` | Runs of filled cells (experimental) | not used by a puzzle yet | `setAdjacencies([...])` |

## UniqueValueConstraint

`constraints/uniquevalueconstraint.py`

**Rule:** all cells in the group have different values. It does *not* require that every value
is used, so the group may have fewer cells than there are values (a Kakuro line of 3 cells with
values 1-9).

**Deductions:**

- When a cell in the group gets a value, that value is removed from every other cell in the
  group (`notify`).
- It tells other constraints in the same group which values are still free
  (`getAllowedValuesForValueList`). `TotalSumValueConstraint` uses this, so that with a unique
  constraint in the group, a sum of 4 over two cells can only be 1+3, never 2+2.

**Example:** in a Kakuro line `1 ? ?`, the two open cells can no longer be 1.

**Setup:** `group.addConstraint(UniqueValueConstraint)`.

## ExactCoverConstraint

`constraints/exactcoverconstraint.py`

**Rule:** every puzzle value appears exactly once in the group. Use it when the group has as
many cells as there are values: the rows, columns and blocks of a Sudoku, or the rows and
columns of a Futoshiki. It is a stronger version of `UniqueValueConstraint` (it inherits from
it), so it does everything the unique constraint does, plus:

**Deductions:**

- **Unique value** (inherited): a placed value is removed from the other cells in the group.
- **Hidden single:** if a value can only go in one open cell of the group, that cell gets the
  value. Example: in a Sudoku row, 7 is only still possible in the third cell, so the third
  cell is 7, even if that cell still has other possibilities.
- **Hidden pair** (`searchForNakedSet`): if two values can each only go in the same two cells,
  those two cells must hold exactly those two values, so all other possibilities are removed
  from them. Example: in a row, 4 and 8 are only possible in cells A and B. A and B are then
  `{4, 8}`, even if they previously also allowed 1, 2 or 6.

**Setup:** `group.addConstraint(ExactCoverConstraint)`. Do not add a separate
`UniqueValueConstraint` to the same group; it is already included.

## TotalSumValueConstraint

`constraints/totalsumvalueconstraint.py`

**Rule:** the values of the cells in the group add up to a given total.

**Deductions:** on every pass the constraint subtracts the values of the cells that are already
filled from the total, and works out every combination of values that can fill the remaining
open cells to make up the rest. Any value that appears in none of these combinations is removed
from all open cells of the group. When all cells are filled and the sum is wrong, it raises a
`ContradictionError`.

Which combinations count depends on the other constraints in the group:

- **With** a `UniqueValueConstraint` (Kakuro): values cannot repeat and cannot reuse values
  already placed in the group. A total of 3 over two cells allows only `{1, 2}`; a total of 24
  over three cells only `{7, 8, 9}`.
- **Without** it: values may repeat, so a total of 4 over two cells also allows 2+2.

Example: a Kakuro line of two cells with total 4 and a unique constraint. The only combination
is 1+3, so both cells are narrowed to `{1, 3}`. If one of them is then set to 3, the remaining
total is 1, so the other cell becomes 1.

Note that the deduction is per group, not per cell: it removes values that cannot appear
*anywhere* in the group. Which cell gets which value is then decided by the other groups each
cell belongs to (in Kakuro, the crossing line).

**Setup:**

```python
group = puzzle.addConstraintGroup("Line")
for cell in lineCells:
    group.addCell(cell)
group.addConstraint(UniqueValueConstraint)
tsvc = group.addConstraint(TotalSumValueConstraint)
tsvc.setTotalValue(17)
```

`setTotalValue` is required; solving without it raises an exception. It also rejects totals
that are obviously too small (smaller than the sum of the smallest values that fit). That check
looks at the cells and constraints the group has at that moment, so call `setTotalValue` after
adding the cells and the `UniqueValueConstraint`.

## CellGreaterThanCellConstraint

`constraints/cellgreaterthancellconstraint.py`

**Rule:** the value of one cell (the *lesser* cell) is strictly smaller than the value of another
cell (the *greater* cell). This is the `<` / `>` sign between two Futoshiki cells.

**Deductions** (bounds reasoning, once per pass):

- The lesser cell cannot be greater than or equal to the largest possibility of the greater
  cell.
- The greater cell cannot be less than or equal to the smallest possibility of the lesser cell.

Example, with values 1-4: `A < B`. Initially A loses 4 (B can be at most 4) and B loses 1 (A is
at least 1). If B is later narrowed to `{2, 3}`, A is narrowed to `{1, 2}`. If A is set to 3, B
must be 4.

Because the passes repeat, chains such as `A < B < C` are propagated as well.

**Setup:** one group per pair of cells, containing both cells:

```python
group = puzzle.addConstraintGroup("Relativity")
constraint = group.addConstraint(CellGreaterThanCellConstraint)
group.addCell(greaterCell)
group.addCell(lesserCell)
constraint.setGreaterCell(greaterCell)
constraint.setLesserCell(lesserCell)
```

In a Futoshiki file the relation is written as `x,y>x,y` (1-based) below a line `relativity`;
`PuzzleFactory.fromFutoshikiFile` creates these groups.

## NonogramConstraint (experimental)

`constraints/nonogramconstraint.py`

**Rule:** for a nonogram row or column, the cells contain runs ("adjacencies") of filled cells
of the given lengths, in order, separated by at least one empty cell. Cells use 1 for filled
and 0 for empty.

**Current deduction:** only the trivial case. When the runs plus one gap between each pair of
runs exactly fill the line (e.g. runs `[3, 1]` in a line of 5 cells: `■■■□■`), every cell is
set. Any other line is left alone.

**Setup:** `constraint.setAdjacencies([3, 1])`. No puzzle type uses this constraint yet, and it
does not implement `getAllowedValuesForValueList`, so it cannot be combined with a
`TotalSumValueConstraint` in the same group.

## How the puzzles combine constraints

| Puzzle | Groups and constraints |
|---|---|
| Sudoku | Each row, column and 3x3 block: `ExactCoverConstraint`. |
| Futoshiki | Each row and column: `ExactCoverConstraint`. Each inequality sign: a two-cell group with `CellGreaterThanCellConstraint`. |
| Kakuro | Each horizontal or vertical line of white cells: `UniqueValueConstraint` + `TotalSumValueConstraint` with the clue. |
| Sumbrero | Each column and diagonal clue: `UniqueValueConstraint` + `TotalSumValueConstraint`. (Work in progress.) |

The power comes from cells being in several groups at once. In Kakuro, the horizontal line
narrows a cell to `{1, 3}` and the vertical line to `{3, 5, 7}`, so the cell must be 3, which in
turn feeds back into both lines.

The tree view in the GUI shows every group with its constraints and cells; selecting one
highlights its cells in the puzzle, which is a handy way to see how a puzzle is built up.

## Writing your own constraint

The `/new-constraint` Claude Code skill scaffolds a new constraint with tests. By hand, subclass
`Constraint` and implement:

| Method | Called when | Should |
|---|---|---|
| `__init__(self, group, initialValues)` | `group.addConstraint(YourConstraint)` | Call `super().__init__`, initialise your own settings. |
| `notify(self, cell)` | A cell in the group gets a value | React to the new value, or `pass`. |
| `applyConstraint(self)` | Every solver pass | Remove impossible values with `cell.remove(value)` or set forced values with `cell.inferValue(value)`. |
| `getAllowedValuesForValueList(self, allowedValues, usedValues)` | `TotalSumValueConstraint` builds its combinations | Return the values still allowed given `usedValues`; return `allowedValues` unchanged if your rule does not limit combinations. |
| `getType(self)` | Tree view | Return a readable name. |

Rules of thumb:

- Only remove values that are certainly impossible. Removing a value that could be correct
  makes the solver produce wrong answers or report contradictions in solvable puzzles.
- Raise `ContradictionError` (from `structure.errors`) when the state is impossible, instead of
  silently ignoring it; backtracking depends on it. `cell.remove` and `cell.setValue` already
  raise it for you.
- Keep `constraints/` free of PySide6 imports.
- Add unit tests in `constraints/tests/test_constraints.py`.
