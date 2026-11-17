---
name: new-puzzle
description: Scaffold support for a new puzzle type in ConstraintPuzzler (parser, example file, board layout, tests). Use when the user wants to add a puzzle like Killer Sudoku, KenKen, Hidato, etc.
argument-hint: <puzzle name> [rules or link]
---

Add a new puzzle type: $ARGUMENTS

1. Before writing code, express the puzzle's rules in terms of the existing constraints in
   `packages/core/src/constraints/` (UniqueValueConstraint, ExactCoverConstraint, TotalSumValueConstraint,
   CellGreaterThanCellConstraint). If a rule can't be expressed with them, propose a new constraint and
   scaffold it with the `/new-constraint` workflow.
2. Write the parser in `packages/core/src/parsers/<name>.ts`: `parse<Name>Lines(lines, filename?) -> Puzzle`.
   Throw `PuzzleFileError` (see `parsers/kakuro.ts`) for malformed lines, with the line number. Export it
   from `packages/core/src/index.ts`. Add a small example puzzle `puzzles/<name>.txt` and document the file
   format in `doc/puzzle-files.md`.
3. Register the type in `packages/core/src/puzzletypes.ts`: a `definePuzzleType({...})` (name, label,
   parseLines, fileExtensions, examples, defaultExample) added to `PUZZLE_TYPES` (and its name to
   `PuzzleTypeName`). Then run `npm run examples -w @constraintpuzzler/app` to bundle the example into the
   app.
4. Draw it: add a `<name>Layout(puzzle): BoardLayout` to `app/src/logic/layout.ts` and to `LAYOUTS`, using the
   closest existing layout as a template (square grid with givens: `sudokuLayout`; cells with sum clues:
   `kakuroLayout`; signs between cells: `futoshikiLayout`; hexagons: `sumbreroLayout`). Cells are polygons with
   a hint area for the small values; clues and signs are decorations.
5. Tests: parser tests in `packages/core/test/parsers/`, a solver test that loads the example; the registry,
   layout, app and Playwright tests pick up the new type from `PUZZLE_TYPES` (add its example to the
   `EXAMPLES` list in `e2e/app.spec.ts` with its cell count).
6. Add the puzzle to the README list. Run the `/test` checks and fix anything that fails.
