# Defining puzzles: grids and file formats

A puzzle in ConstraintPuzzler is a set of cells plus the constraint groups over them (see
[constraints.md](constraints.md)). Each puzzle type has a plain-text file format that describes
those cells and the clues, and a parser (in `packages/core/src/parsers/`) that turns the file
into cells and constraint groups.

This page describes the three kinds of grid, the file syntax of each puzzle type, and how to
define a puzzle that has no file format yet, directly in TypeScript. The example files are in
`puzzles/`.

- [Grid types and coordinates](#grid-types-and-coordinates)
- [Sudoku](#sudoku)
- [Futoshiki](#futoshiki)
- [Jidoku](#jidoku)
- [Kakuro](#kakuro)
- [Sumbrero](#sumbrero)
- [Nonogram](#nonogram)
- [Opening your own puzzle file](#opening-your-own-puzzle-file)
- [Defining a puzzle in code](#defining-a-puzzle-in-code)
- [Adding a new puzzle type](#adding-a-new-puzzle-type)

## Grid types and coordinates

Every cell has a `Position(x, y)`: **x is the column, y is the row**, and y grows downwards.
How cells are laid out depends on the grid type:

| Grid type | Used by | Cells | Coordinates in the file | Drawn in the app (`app/src/logic/layout.ts`) |
|---|---|---|---|---|
| **Square grid** | Sudoku, Futoshiki, Jidoku | Every position of an N×N square is a cell. | Implicit: the file is a picture of the grid, one line per row. Futoshiki and Jidoku relations use 1-based `x,y`. | squares (`sudokuLayout`); Futoshiki and Jidoku bend the edge between two related cells into the `<` / `>` (`futoshikiLayout`, `jidokuLayout`) |
| **Free-form grid** | Kakuro | Only the positions you list are cells; everything else is empty (black). | Explicit `cell(x,y)`, any integers. | squares, clues as triangles (`kakuroLayout`) |
| **Hexagonal grid** | Sumbrero | Only the positions you list are cells. | Explicit `cell(x,y)`, any integers (the example starts at 0). | hexagons (`sumbreroLayout`) |

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
for an N×N Futoshiki, and the `range` line for Kakuro and Sumbrero. The app shows the candidates
and notes of an open cell in a small grid sized to the number of values (3×3 for nine values,
4×4 for sixteen).

## Sudoku

Parser: `parseSudokuLines` (`parsers/sudoku.ts`). Examples: `easySudoku.txt`,
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
- Two givens that conflict (e.g. two 5s in a row) throw a `ContradictionError` while loading.

## Futoshiki

Parser: `parseFutoshikiLines` (`parsers/futoshiki.ts`). Example: `futoshiki.txt`.

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
- The two cells do not need to be neighbours, although in a real Futoshiki they always are. The
  app draws a relation between neighbours as a bent cell edge (the point of the bend in the
  lesser cell) and any other relation as a separate sign.
- The `relativity` part is optional; without it you get a Latin square.

What it builds: one `ExactCoverConstraint` group per row and per column, and one two-cell group
with a `CellGreaterThanCellConstraint` per relation.

## Jidoku

Parser: `parseJidokuLines` (`parsers/jidoku.ts`). Example: `jidoku.txt`.

Jidoku ("Less-Than-Sudoku") is the Sudoku variant of O'Sullivan & Horan, *Generating and Solving
Logic Puzzles through Constraint Satisfaction* (AAAI 2007,
<https://cdn.aaai.org/AAAI/2007/AAAI07-361.pdf>): the 1-9 in every row, column and 3×3 box of
Sudoku, but the clues are `<` / `>` relations between neighbouring cells of a box, usually
without any given values. The app draws it as in the paper: every other box shaded, and each
clue as the edge between its two cells bent into the sign.

The file is a Sudoku grid (nine lines, usually all `-`) followed by the Futoshiki relations part:

```
- - - - - - - - -
(nine lines in all)
- - - - - - - - -

relativity
2,1>1,1
1,2>1,1
```

Each `x1,y1>x2,y2` means *the cell in column x1, row y1 is greater than the cell in column x2,
row y2* (1-based, column first). Unlike Futoshiki, the two cells **must** be orthogonal neighbours
in the same 3×3 box; anything else is a `PuzzleFileError` naming the line.

What it builds: the 27 `ExactCoverConstraint` groups of a Sudoku, and one two-cell group with a
`CellGreaterThanCellConstraint` per clue. The example has 57 clues in rotationally symmetric
pairs, a unique solution, and is solved by deduction alone (no guessing); see
[jidoku-generator.md](jidoku-generator.md) for how it was made.

## Kakuro

Parser: `parseKakuroLines` (`parsers/kakuro.ts`). Examples: `simpleKakuro.txt`,
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

Rules:

- **Order:** `range` first, then the cells, then the totals.
- **Whitespace** is allowed anywhere: around `=`, inside `( 1, 1 )`, around `;`, and before a
  statement (indentation).
- **List the cells of a total in order, from left to right or top to bottom, with at least two
  cells.** The solver does not care, but the app draws the clue triangle next to the first cell:
  to its left when the first two cells are on the same row, above it when they are in the same
  column. Leave column 0 and row 0 free (start your cells at 1) so the clues of the first row
  and column have room.

**Errors.** A file that cannot be read throws a `PuzzleFileError` that names the
file and line, for example
`mediumKakuro.txt, line 98: cell Position(9, 9) is used before it is declared (total(...) = 6)`.
This happens for:

- a missing `range`, or a `cell`/`total` before it;
- a cell that cannot be read, such as `(2,x)`;
- a cell that is declared twice, or that appears twice in one total;
- a total that uses a cell that was not declared (yet).

## Sumbrero

Parser: `parseSumbreroLines` (`parsers/sumbrero.ts`). Example: `simpleSumbrero.txt`.

Sumbrero uses the hexagonal grid. Like Kakuro, the file lists the cells, but a clue names a whole
line of hexagons instead of listing its cells. Lines run in three directions:

- a **column** runs straight down;
- a **descending row** runs down-right;
- an **ascending row** runs up-right.

Rows are numbered by the row y where they cross column 0, so `row_descending(2)` and
`row_ascending(2)` both pass through `cell(0,2)`, one going down-right and the other up-right.
Rows that only cross column 0 outside the grid get numbers below 0 or above the last row.

```
range = 1,9

cell(0,0)
cell(0,1)
cell(1,0)
cell(1,1)

column(0) = 11
row_descending(0) = 5
row_ascending(1) = 9
```

| Statement | Meaning |
|---|---|
| `range = min,max` | The values every cell can take, inclusive. Must come first. |
| `cell(x,y)` | A hexagon in column x, row y (odd columns are shifted down). |
| `column(c) = n` | The cells with x = c add up to n, without duplicates. |
| `row_descending(r) = n` | The cells with `y - x // 2 == r` (the down-right row through `(0, r)`) add up to n, without duplicates. |
| `row_ascending(r) = n` | The cells with `y + (x + 1) // 2 == r` (the up-right row through `(0, r)`) add up to n, without duplicates. |
| anything else | Ignored, so `# ...` lines and blank lines can be used as comments. |

For the 4×4 block of `simpleSumbrero.txt`, the lines are:

```
 column(1):          (1,0) (1,1) (1,2) (1,3)
 row_descending(0):  (0,0) (1,0) (2,1) (3,1)     row_descending(-1): (2,0) (3,0)
 row_ascending(2):   (0,2) (1,1) (2,1) (3,0)     row_ascending(0):   (0,0)
```

Whitespace is allowed as in Kakuro. Declare all cells before the clues: a clue collects the cells
that exist when it is read. Mistakes throw a `PuzzleFileError` naming the line, as in Kakuro;
this includes a clue whose line contains no cells.

In the app the grid is framed by black hexagons, drawn like the clue squares of a Kakuro: a white
diagonal from the top-right to the bottom-left corner, and the right part cut into three wedges.
The sum of a line is shown in the black hexagon just before its first cell, in the wedge that
faces along the line:

| Wedge | Line |
|---|---|
| bottom (S) | `column`, running down |
| lower right (SE) | `row_descending`, running down-right |
| upper right (NE) | `row_ascending`, running up-right |

So one black hexagon can hold up to three sums, and every line has its own wedge.

## Nonogram

Parser: `parseNonogramLines` (`parsers/nonogram.ts`). Examples: `nonogramCup.txt` (black and
white) and `nonogramCherries.txt` (three colours).

A nonogram is a rectangular grid of cells that are blank or have a colour; the clue of every row
and column lists its blocks of consecutive same-coloured cells, in order. Between two blocks of
the same colour there is at least one blank cell; blocks of different colours may touch. The
values of the cells are colours: `0` is blank and `1`, `2`, ... are the colours in the order
they are listed (in a black-and-white nonogram, `1` is black). Cells have the positions `(x, y)`
from `(1, 1)` at the top left.

The file has up to three sections, each started by a line with its name:

```
# Two cherries (comments start with #)
colors
r red #d55e00
g green #009e73
n brown #4d2b0c
rows
2n 3g
...
columns
3r
...
```

- `colors` (optional): one colour per line, `code name #rrggbb`: a one-letter code for the clues,
  a name for the explanations, and how the colour is drawn. Without this section the puzzle is
  black and white.
  Pick colours that colour-blind players can tell apart, e.g. from the Okabe-Ito palette
  (`#e69f00`, `#56b4e9`, `#009e73`, `#f0e442`, `#0072b2`, `#d55e00`, `#cc79a7`), and avoid pairs
  like red and green that differ only in hue. The app's *Colour symbols* switch also draws a
  shape for every colour (in the order listed: circle, triangle, square, diamond, plus, star,
  hexagon, upside-down triangle).
- `rows`: the clue of every row, from top to bottom; the number of lines is the height.
- `columns`: the clue of every column, from left to right; the number of lines is the width.

A clue is a list of blocks separated by spaces: `3` (in a black-and-white nonogram) or `3r` (three
cells of the colour with code `r`). A line without blocks is `-` or `0`.

The parser reports (with the line number): a line outside a section, a section given twice, a
missing `rows` or `columns` section, a malformed colour line or a colour code used twice, a block
without a colour when there are several colours, an unknown colour code, blocks that do not fit
in their line, and a colour that has a different number of cells in the rows than in the
columns.

Hints, steps and the info panel name the values by their colour (`Puzzle.setValueNames`):
"cell 4, 7 is red", not "cell 4, 7 is 1".

Every row and every column is a group with a `RunsConstraint` (see
[constraints.md](constraints.md#runsconstraint)).

## Opening your own puzzle file

On the start page of the app, every puzzle type has an *Open file…* button. The puzzle opens in a
new tab. A file that cannot be read shows the error, which for Kakuro and Sumbrero names the line.

| Puzzle | File types offered (web) |
|---|---|
| Sudoku | `*.txt`, `*.sud` |
| Futoshiki | `*.txt`, `*.fut` |
| Kakuro, Sumbrero | `*.txt` |

You can also parse and solve a file without the app, which is handy while you are writing a
puzzle (e.g. in a vitest test in `packages/core/test/`, or a small script):

```ts
import { readFileSync } from 'node:fs';
import { FUTOSHIKI, parsePuzzle, Solver } from '@constraintpuzzler/core';

// or SUDOKU, KAKURO, SUMBRERO (all in PUZZLE_TYPES)
const puzzle = parsePuzzle(FUTOSHIKI, readFileSync('myFutoshiki.txt', 'utf-8'), 'myFutoshiki.txt');
const solver = new Solver(puzzle, true); // allow guessing
console.log(solver.solve()); // true when solved
for (const cell of puzzle.getGrid().getPositionedCells()) {
  console.log(cell.getName(), cell.getValue());
}
```

Each parser is a `parse<Type>Lines(lines, filename?)` function (`parsePuzzle` splits the text
into lines for you). The Kakuro and Sumbrero parsers throw a `PuzzleFileError`, naming the line,
when a file cannot be read.

## Defining a puzzle in code

A puzzle does not need a file format: you can build any grid and any combination of constraints
in code. The steps are always the same:

1. Create a `Puzzle` with its name and the values.
2. Add cells to its grid with `puzzle.getGrid().addCell(new Position(x, y))`.
3. Add constraint groups, give each group its constraints and its cells.
4. Set the givens with `cell.setValue(v)`, after the groups exist (setting a value notifies the
   groups the cell is already in).
5. Solve with `new Solver(puzzle).solve()`.

Example: a 4×4 Futoshiki-like puzzle where every row and column contains 1-4, the top-left 2×2
area adds up to 10, and one cell is smaller than its neighbour.

```ts
import {
  CellGreaterThanCellConstraint,
  ExactCoverConstraint,
  Position,
  Puzzle,
  Solver,
  TotalSumValueConstraint,
  type PositionedCell,
} from '@constraintpuzzler/core';

const puzzle = new Puzzle('My puzzle', [1, 2, 3, 4]);
const cells = new Map<string, PositionedCell>();
for (let y = 1; y <= 4; y++) {
  for (let x = 1; x <= 4; x++) cells.set(`${x},${y}`, puzzle.getGrid().addCell(new Position(x, y)));
}
const at = (x: number, y: number) => cells.get(`${x},${y}`)!;

for (let i = 1; i <= 4; i++) {
  const row = puzzle.addConstraintGroup(`Row ${i}`);
  row.addConstraint(ExactCoverConstraint);
  const column = puzzle.addConstraintGroup(`Column ${i}`);
  column.addConstraint(ExactCoverConstraint);
  for (let j = 1; j <= 4; j++) {
    row.addCell(at(j, i));
    column.addCell(at(i, j));
  }
}

const corner = puzzle.addConstraintGroup('Corner');
for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) corner.addCell(at(x, y));
corner.addConstraint(TotalSumValueConstraint).setTotalValue(10);

const sign = puzzle.addConstraintGroup('(3,1) < (4,1)');
const smaller = sign.addConstraint(CellGreaterThanCellConstraint);
sign.addCell(at(3, 1));
sign.addCell(at(4, 1));
smaller.setLesserCell(at(3, 1));
smaller.setGreaterCell(at(4, 1));

at(1, 1).setValue(1);

console.log(new Solver(puzzle, true).solve());
```

Notes:

- The order of `addCell` calls matters for square grids: `grid.getCellFromSquareGrid(x, y)`
  (0-based) assumes the cells were added row by row, which the Sudoku and Futoshiki parsers rely
  on. For other layouts, look cells up with `grid.searchCellWithPosition(new Position(x, y))`.
- A cell can be in any number of groups, and the groups do not need to be rows or columns: any
  set of cells works. This is how you add extra regions, diagonals or cages.
- For `TotalSumValueConstraint`, add the cells (and any `UniqueValueConstraint`) before calling
  `setTotalValue`; see [constraints.md](constraints.md#totalsumvalueconstraint).

## Adding a new puzzle type

To make a puzzle type available in the app, you need a parser for its file format, a board
layout that draws its cells, an example file and tests. The `/new-puzzle <name>` Claude Code
skill scaffolds all of these. By hand:

1. Write the parser in `packages/core/src/parsers/<name>.ts`: `parse<Name>Lines(lines, filename?)`
   returning a `Puzzle`, and export it from `packages/core/src/index.ts`.
2. Add an example `puzzles/<name>.txt`.
3. Register the type in `packages/core/src/puzzletypes.ts`: a `definePuzzleType({...})` with its
   name, label, parser, file extensions, examples, default example and `guide`, added to
   `PUZZLE_TYPES`. The guide (`packages/core/src/guide/rules.ts`) explains the rules to players
   and lists the techniques that help, from `TECHNIQUE_GUIDE` (`guide/techniques.ts`); add an
   entry there for a new kind of deduction (see `doc/rules-and-techniques.md`).
   The start page, the tests and the app's bundled examples
   (`npm run examples -w @constraintpuzzler/app`) all read this registry.
4. Add a layout to `app/src/logic/layout.ts` (`LAYOUTS`): the cells as polygons with an area for
   the small values, and the clues or signs as decorations; see the existing layouts.
5. Add parser tests to `packages/core/test/parsers/`, and the example to `e2e/app.spec.ts`.

**Colours that carry meaning must work for colour-blind players.** When a colour is part of
the puzzle itself (a value, a clue, a region the rules depend on), players with a colour vision
deficiency must be able to tell the colours apart: pick colours that stay distinguishable (e.g.
the Okabe-Ito palette, and never two colours that differ only between red and green), or offer
an accessibility aid that does not rely on colour, such as the nonogram's *Colour symbols*
(a shape per colour). Check a palette with a colour-blindness simulator for protanopia,
deuteranopia and tritanopia. This applies to the example files as well.

The colours of hints and highlights (the selection, a hint's region, Check marks, the roles in
`app/src/logic/highlight.ts`) do not have to follow this rule: they only help, and the
explanation in words says the same.

