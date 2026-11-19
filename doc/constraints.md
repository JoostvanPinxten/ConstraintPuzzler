# Constraints

ConstraintPuzzler does not know what a Sudoku or a Kakuro is. It knows about **cells**,
**constraint groups** and **constraints**. A puzzle is a set of cells, and every rule of the
puzzle ("each row contains 1-9 once", "these cells add up to 17", "this cell is smaller than
that one") is a constraint attached to a group of cells. The solver repeatedly asks every
constraint to remove values that can no longer be correct, until nothing changes anymore.

This page explains the building blocks and each constraint type: what rule it expresses, what
it deduces, and how to use it. For the grid types and the puzzle file formats, see
[puzzle-files.md](puzzle-files.md).

- [The building blocks](#the-building-blocks)
- [How the solver uses constraints](#how-the-solver-uses-constraints)
- [Constraint types at a glance](#constraint-types-at-a-glance)
- [UniqueValueConstraint](#uniquevalueconstraint)
- [ExactCoverConstraint](#exactcoverconstraint)
- [TotalSumValueConstraint](#totalsumvalueconstraint)
- [CellGreaterThanCellConstraint](#cellgreaterthancellconstraint)
- [RunsConstraint](#runsconstraint)
- [How the puzzles combine constraints](#how-the-puzzles-combine-constraints)
- [Writing your own constraint](#writing-your-own-constraint)

## The building blocks

| Concept | Where | What it is |
|---|---|---|
| `Puzzle` | `structure/puzzle.ts` | The top-level object. It has the list of allowed values (e.g. 1-9), a `Grid` of cells and the constraint groups. |
| `Cell` | `structure/cell.ts` | One square (or triangle, hexagon...) of the puzzle. It keeps the set of values that are still **possible**, and its **value** once it is known. |
| `ConstraintGroup` | `constraints/constraintgroup.ts` | A named set of cells (a row, a block, a Kakuro line...) with one or more constraints that apply to all of them. A cell can be in many groups. |
| `Constraint` | `constraints/constraint.ts` | A rule over the cells of its group. It narrows down the possible values of those cells. |

(The paths are in `packages/core/src/`; everything is exported from `@constraintpuzzler/core`.)

A cell starts with every puzzle value as a possibility. Solving means removing possibilities:

- `cell.remove(value)` removes one possibility. If no possibility is left, the puzzle is
  contradictory.
- `cell.setValue(value)` / `cell.inferValue(value)` fixes the value of the cell (a given vs. a
  value the solver deduced). The other possibilities disappear. The cell remembers where the
  value came from (`cell.getSource()`, a `ValueSource`: given, entered, deduced or guessed).

Whenever something impossible happens (removing the last possibility of a cell, removing the
value a cell already has, setting a value that is no longer possible, a sum that does not add
up) a `ContradictionError` is thrown.

A minimal example: a group of three cells whose values must all differ.

```ts
import { Position, Puzzle, UniqueValueConstraint } from '@constraintpuzzler/core';

const puzzle = new Puzzle('Example', [1, 2, 3]);
const cells = [1, 2, 3].map((x) => puzzle.getGrid().addCell(new Position(x, 1)));

const group = puzzle.addConstraintGroup('Row 1');
group.addConstraint(UniqueValueConstraint); // pass the class, the group creates the instance
for (const cell of cells) group.addCell(cell);

cells[0].setValue(2);
console.log(cells[1].getPossibleValues()); // Set { 1, 3 }
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

`Solver.propagate()` repeats these passes until a pass changes nothing. It then tries the
[techniques that combine groups](#techniques-that-combine-groups), and continues with the
passes if one of them removed candidates. If the puzzle is still
not solved and guessing is enabled (*Allow guessing*), the solver picks the open cell with the
fewest possibilities, tries a value, and propagates again. A `ContradictionError` thrown by any
constraint means the guess was wrong: the solver restores the saved state and tries the next
value.

Because propagation and contradictions are all a constraint has to provide, a constraint does
not need to be complete: deducing *some* values is enough, as long as it never removes a value
that could still be correct.

## Techniques that combine groups

A constraint only sees its own group. Some deductions need several groups at once; they live in
`packages/core/src/techniques/` as subclasses of `Technique`. They work on the groups that
have an `ExactCoverConstraint`, so they apply to any puzzle built from such groups (Sudoku,
Futoshiki), not only to Sudoku.

| Technique | Difficulty | Rule |
|---|---|---|
| `IntersectionRemoval` | 3 | If group A can hold a value only in the cells it shares with group B, B cannot hold the value anywhere else (pointing pairs/triples, box-line reduction) |
| `XWing` | 6 | If 2 parallel lines hold a value only in cells of the same 2 crossing lines, the rest of those crossing lines cannot hold it |
| `Swordfish` | 7 | The same with 3 lines |
| `Jellyfish` | 8 | The same with 4 lines |

Two lines *cross* when they share exactly one cell (Sudoku rows and columns, but not a row and
a block); the base lines of a fish must not overlap.

The solver applies techniques only when the constraints no longer change anything, the easiest
first and one finding at a time, and then goes back to the constraints. A technique only removes
candidates. It is the cause of its removals in the deduction log and explains them, e.g.
"X-Wing on 7: Row 2 and Row 6 can only hold 7 in cells of Column 4 and Column 8; ...". A
single *Step* that finds no value uses a technique when the constraints cannot narrow down the
candidates.

`new Solver(puzzle, allowGuessing, [])` solves with the constraints only (the golden fixtures
of the Python engine are checked that way). To add a technique, subclass `Technique` (set
`static difficulty`, implement `getType()` and `apply()`, remove candidates with
`removeWithReason`) and add it to `TECHNIQUES` in `techniques/techniques.ts`.

## Constraint types at a glance

| Constraint | Rule | Typical use | Extra setup |
|---|---|---|---|
| `UniqueValueConstraint` | No value appears twice in the group | Kakuro lines, Sumbrero lines | none |
| `ExactCoverConstraint` | Every value appears exactly once in the group | Sudoku rows/columns/blocks, Futoshiki rows/columns | none |
| `TotalSumValueConstraint` | The values in the group add up to a total | Kakuro clues, Sumbrero sums | `setTotalValue(n)` |
| `CellGreaterThanCellConstraint` | One cell is smaller than another | Futoshiki `<` / `>` signs | `setLesserCell`, `setGreaterCell` |
| `RunsConstraint` | The cells, in order, hold these blocks of colours | Nonogram rows and columns | `setRuns(runs, palette)` |

## UniqueValueConstraint

`packages/core/src/constraints/uniquevalueconstraint.ts`

**Rule:** all cells in the group have different values. It does *not* require that every value
is used, so the group may have fewer cells than there are values (a Kakuro line of 3 cells with
values 1-9).

**Deductions:**

- When a cell in the group gets a value, that value is removed from every other cell in the
  group (`notify`).
- It tells other constraints in the same group which values are still free
  (`getAllowedValuesForValueList`). `TotalSumValueConstraint` uses this, so that with a unique
  constraint in the group, a sum of 4 over two cells can only be 1+3, never 2+2.
- **Naked subsets** (`searchForNakedSubsets`): if k open cells together have only k
  candidates (a naked pair, triple, ...), those cells use up those values, so they are removed
  from the other cells of the group. Example: in a Kakuro line of three cells, two cells are
  both `{1, 2}`, so the third cannot be 1 or 2. If k cells have *fewer* than k candidates
  between them, the puzzle is contradictory.

**Example:** in a Kakuro line `1 ? ?`, the two open cells can no longer be 1.

**Setup:** `group.addConstraint(UniqueValueConstraint)`.

## ExactCoverConstraint

`packages/core/src/constraints/exactcoverconstraint.ts`

**Rule:** every puzzle value appears exactly once in the group. Use it when the group has as
many cells as there are values: the rows, columns and blocks of a Sudoku, or the rows and
columns of a Futoshiki. It is a stronger version of `UniqueValueConstraint` (it inherits from
it), so it does everything the unique constraint does, plus:

**Deductions:**

- **Unique value** (inherited): a placed value is removed from the other cells in the group.
- **Hidden single:** if a value can only go in one open cell of the group, that cell gets the
  value. Example: in a Sudoku row, 7 is only still possible in the third cell, so the third
  cell is 7, even if that cell still has other possibilities.
- **Naked subsets** (inherited, see above).
- **Hidden subsets** (`searchForHiddenSubsets`): if k values can each only go in the same k
  cells (a hidden pair, triple, ...), those cells must hold exactly those values, so all other
  possibilities are removed from them. Example: in a row, 4 and 8 are only possible in cells A
  and B. A and B are then `{4, 8}`, even if they previously also allowed 1, 2 or 6. Subsets
  up to half the open cells are searched; a larger hidden subset is the same fact as a smaller
  naked subset in the other cells. If k values fit in fewer than k cells, the puzzle is
  contradictory.

Each subset deduction explains itself in the hint and step messages, naming the cells and
values involved.

**Setup:** `group.addConstraint(ExactCoverConstraint)`. Do not add a separate
`UniqueValueConstraint` to the same group; it is already included.

## TotalSumValueConstraint

`packages/core/src/constraints/totalsumvalueconstraint.ts`

**Rule:** the values of the cells in the group add up to a given total.

**Deductions:** on every pass the constraint subtracts the values of the cells that are already
filled from the total, and works out every combination of values that can fill the remaining
open cells to make up the rest. Any value that appears in none of these combinations is removed
from all open cells of the group. When all cells are filled and the sum is wrong, it throws a
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

```ts
const group = puzzle.addConstraintGroup('Line');
for (const cell of lineCells) group.addCell(cell);
group.addConstraint(UniqueValueConstraint);
group.addConstraint(TotalSumValueConstraint).setTotalValue(17);
```

`setTotalValue` is required; solving without it throws an error. It also rejects totals
that are obviously too small (smaller than the sum of the smallest values that fit). That check
looks at the cells and constraints the group has at that moment, so call `setTotalValue` after
adding the cells and the `UniqueValueConstraint`.

## CellGreaterThanCellConstraint

`packages/core/src/constraints/cellgreaterthancellconstraint.ts`

**Rule:** the value of one cell (the *lesser* cell) is strictly smaller than the value of another
cell (the *greater* cell). This is the `<` / `>` sign between two Futoshiki or Jidoku cells.

**Deductions** (bounds reasoning, once per pass):

- The lesser cell cannot be greater than or equal to the largest possibility of the greater
  cell.
- The greater cell cannot be less than or equal to the smallest possibility of the lesser cell.

Example, with values 1-4: `A < B`. Initially A loses 4 (B can be at most 4) and B loses 1 (A is
at least 1). If B is later narrowed to `{2, 3}`, A is narrowed to `{1, 2}`. If A is set to 3, B
must be 4.

Because the passes repeat, chains such as `A < B < C` are propagated as well.

**Setup:** one group per pair of cells, containing both cells:

```ts
const group = puzzle.addConstraintGroup('Relativity');
const constraint = group.addConstraint(CellGreaterThanCellConstraint);
group.addCell(greaterCell);
group.addCell(lesserCell);
constraint.setGreaterCell(greaterCell);
constraint.setLesserCell(lesserCell);
```

In a Futoshiki or Jidoku file the relation is written as `x,y>x,y` (1-based) below a line
`relativity`; `parseFutoshikiLines` and `parseJidokuLines` create these groups (`addRelation`).

## RunsConstraint

`packages/core/src/constraints/runsconstraint.ts`

**Rule:** the cells of the group, *in the order they were added*, hold exactly the given blocks
(`Run`: a colour and a length), in that order: a nonogram row or column. Every other cell is
`BLANK` (`0`). Two consecutive blocks of the same colour have at least one blank cell between
them; blocks of different colours may touch. With one colour (`1`) this is the classic
black-and-white nonogram clue; with more colours, a coloured nonogram.

**Deductions:** `applyConstraint` goes over all placements of the blocks that fit the current
candidates of the cells at once (one pass backwards for which states can still be completed, one
forwards for which can be reached; the time grows with cells x blocks x block length). A value
stays possible in a cell exactly when some placement gives it that value, so nothing that follows
from the line alone is missed. A cell with one value left gets it (`inferValue`), so hints and
single steps can show it as this rule's deduction. If no placement fits, the puzzle is
contradictory.

Every deduction is rated by the easiest technique that explains it (`techniqueOf(deduction)`,
`difficultyOf(deduction)`), so hints show the easy ones first:

| Technique | Difficulty | Example explanation |
|---|---|---|
| `wholeLine` | 2 | the blocks of Row 7 (5 red, 4 red) and the gaps they need fill the whole line |
| `overlap` | 3 | block 1 of Row 1 (4) starts somewhere in cells 1-3, so it always covers cells 3-4: this cell is black |
| `reach` | 3 | no red block of Row 1 can reach this cell |
| `placements` | 5 | of all ways to place the blocks of Row 1 (1 1) that fit the cells known so far, every one makes this cell blank |

`overlap` and `reach` use the first and the last possible start of every block (taking the known
cells into account); anything else needs `placements`.

**Setup:**

```ts
const row = puzzle.addConstraintGroup('Row 1');
const constraint = row.addConstraint(RunsConstraint);
for (const cell of cellsLeftToRight) row.addCell(cell); // the order matters
constraint.setRuns([{ color: 1, length: 3 }, { color: 2, length: 1 }], palette);
```

The puzzle's values must include `BLANK` and every colour. The palette (`PaletteColor`: value,
name, `#rrggbb`) names the colours in explanations and tells the app how to draw them;
`paletteOf(puzzle)` returns it. Without one, `BLACK_AND_WHITE` is used.

## How the puzzles combine constraints

| Puzzle | Groups and constraints |
|---|---|
| Sudoku | Each row, column and 3x3 block: `ExactCoverConstraint`. |
| Futoshiki | Each row and column: `ExactCoverConstraint`. Each inequality sign: a two-cell group with `CellGreaterThanCellConstraint`. |
| Jidoku | As Sudoku (each row, column and 3x3 block: `ExactCoverConstraint`), plus a two-cell group with `CellGreaterThanCellConstraint` per clue. |
| Kakuro | Each horizontal or vertical line of white cells: `UniqueValueConstraint` + `TotalSumValueConstraint` with the clue. |
| Sumbrero | Each column and diagonal row with a clue: `UniqueValueConstraint` + `TotalSumValueConstraint`. |
| Nonogram | Each row and column: `RunsConstraint` with its clue. |

The power comes from cells being in several groups at once. In Kakuro, the horizontal line
narrows a cell to `{1, 3}` and the vertical line to `{3, 5, 7}`, so the cell must be 3, which in
turn feeds back into both lines.

The list of groups and rules in the app shows every group with its constraints and cells;
selecting one highlights its cells in the puzzle, which is a handy way to see how a puzzle is built up.

## Writing your own constraint

The `/new-constraint` Claude Code skill scaffolds a new constraint with tests. By hand, extend
`Constraint` (in `packages/core/src/constraints/`) and implement:

| Method | Called when | Should |
|---|---|---|
| `constructor(group, initialValues)` | `group.addConstraint(YourConstraint)` | Only needed for your own settings; call `super(group, initialValues)`. |
| `notify(cell)` | A cell in the group gets a value | React to the new value, or do nothing. |
| `applyConstraint()` | A solver pass in which a cell of the group changed (the first pass: always) | Remove impossible values with `cell.remove(value)` or set forced values with `cell.inferValue(value)`. Only look at the cells of the group: the solver re-applies a constraint only when one of those cells changed. |
| `explain(deduction)` | A step or hint is explained | Optional: say in words why your rule removed `deduction.removed` or set `deduction.value`. The default names the group and `summary()`. |
| `getAllowedValuesForValueList(allowedValues, usedValues)` | `TotalSumValueConstraint` builds its combinations | Return the values still allowed given `usedValues`; return `allowedValues` unchanged if your rule does not limit combinations. |
| `getType()`, `summary()`, `describe(showHints)` | The list of groups and rules, and the info panel | Return a readable name, a short rule ("sum = 17") and how far the rule is satisfied. |
| `violations(valueOf)` | The app checks the values shown | Return the cells that break the rule (drawn in red). |

Also set `static override difficulty`: how hard a deduction of your rule is for a person (hints
and single steps show the easiest deduction first). If one rule makes both easy and hard
deductions, override `difficultyOf(deduction)` too (as `RunsConstraint` does).

Rules of thumb:

- Only remove values that are certainly impossible. Removing a value that could be correct
  makes the solver produce wrong answers or report contradictions in solvable puzzles.
- Throw `ContradictionError` when the state is impossible, instead of silently ignoring it;
  backtracking depends on it. `cell.remove` and `cell.setValue` already throw it for you.
- Iterate candidates in a fixed order (`sortedValues(...)`), so the solver is deterministic.
- Keep `packages/core/src/` free of React / React Native (a test allows only relative imports).
- Add unit tests in `packages/core/test/constraints/` (vitest).
