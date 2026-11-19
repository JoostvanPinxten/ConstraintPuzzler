# Jidoku generator (not built yet)

Notes for adding a puzzle generator, starting with Jidoku. The source is O'Sullivan & Horan,
*Generating and Solving Logic Puzzles through Constraint Satisfaction*, AAAI 2007
(<https://cdn.aaai.org/AAAI/2007/AAAI07-361.pdf>, 2 pages; Figure 3 is the constraint model).

## What the paper does

**Puzzle model.** 81 cell variables with domain 1-9 and an `alldifferent` per row, column and box
(27 global constraints; Régin's filtering, i.e. generalised arc consistency).

**Generation model.** One *clue variable* per pair of orthogonal neighbours inside a box (12 per
box, A-L in Figure 3b; 108 in all), domain `{Less, Greater}`. Channelling constraints:
`C = Less` implies `x11 < x21`, and so on.

**Search.** Depth-first over the clue variables until propagation alone reduces every cell to a
single value. Then every clue is fixed by propagation, and the solution is unique.

**Minimising.** Visit each clue and unassign it if propagation alone still fixes every cell;
otherwise mark it as required. Repeat until no clue can be removed. Visiting the clues in an order
that follows a rotational symmetry of the grid gives symmetric puzzles.

**Difficulty.** Replace some of the 27 `alldifferent` constraints by cliques of binary `≠`, which
propagate less. Minimising against a weaker model keeps more clues, so the puzzle is easier for a
human. That gives 27 difficulty levels.

## How it maps onto ConstraintPuzzler

| Paper | Here |
|---|---|
| `alldifferent` (GAC) | `ExactCoverConstraint` (hidden and naked singles plus subsets; not full GAC) |
| clique of binary `≠` | `UniqueValueConstraint` (it also finds subsets, so it is not a pure clique) |
| `x < y` channelling | `CellGreaterThanCellConstraint` (bounds reasoning) |
| "propagation fixes every cell" | `new Solver(puzzle).solve()` returns true (no guessing) |
| uniqueness | `new Solver(puzzle).countSolutions(2) === 1` |

`puzzles/jidoku.txt` was made with a throwaway script (not in the repository) that followed the
paper, except the search step:

1. Solve `mediumSudoku.txt` with guessing to get a full grid. Relabel its digits with a fixed-seed
   random permutation.
2. Add all 108 in-box relations that grid implies.
3. Check that the full clue set solves by deduction. **With our weaker propagation it often does
   not:** for the unrelabelled grid, 6 cells stayed open in a two-way swap that no in-box relation
   could rule out. The script tried new relabellings until one worked (the 6th).
4. Minimise in rotationally symmetric pairs (clue and its 180° twin), in a fixed-seed random order,
   while `Solver.solve()` still succeeds. Result: 57 clues, one solution.

## What a generator in the app needs

- **Engine (`packages/core/src/generator/`).** A `generateJidoku({ seed, difficulty, symmetric })`
  that returns a `Puzzle` (or the file text). It needs:
  - a seeded PRNG, so output is deterministic and testable (no `Math.random`);
  - a random full grid: `countSolutions`/`findSolution` on an empty Sudoku with randomised value
    order, or a relabelled and shuffled base grid;
  - the clue search: the full in-box set plus a retry with another grid, as above. Better: the
    paper's DFS over clue variables, which also allows clues across boxes if wanted;
  - minimising as above, with a `shouldStop`/`AbortSignal` like `solveAsync`, as each step runs a
    full solve.
- **Difficulty.** Follow the paper: build the minimising model with some groups using
  `UniqueValueConstraint` instead of `ExactCoverConstraint`. Or grade the finished puzzle by the
  hardest `Deduction.difficulty()` the solver needs. The second fits the hint system better.
- **App.** A "New" button per type on the start page (next to the examples), running in the
  background like Solve, with difficulty and symmetry options. Opening the result should give
  the same tab as an example; the source text is needed because `PuzzleSession` re-parses it for
  Solve/Check, so the generator should produce the file text.
- **Tests.** For several seeds: the puzzle has one solution, solves without guessing, is symmetric
  when asked, and every remaining clue is needed (removing any one breaks deduction-only solving).
  The same seed gives the same puzzle.
- **Other types.** The same "fill, then minimise clues while deduction-only solving succeeds" loop
  works for Futoshiki (relations and givens as clues) and Sudoku (givens as clues). A generic
  `minimiseClues(clues, buildPuzzle, isGood)` can serve all of them.
