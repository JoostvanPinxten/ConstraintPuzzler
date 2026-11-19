# Rules and techniques for players

The app explains the rules of every puzzle type and the techniques that help to solve it, and a
hint links to the technique it used.

## Content (`packages/core/src/guide/`)

- `rules.ts`: a `PuzzleGuide` per puzzle type: the goal, the rules, and the techniques that help,
  easiest first. The registry (`PUZZLE_TYPES` in `puzzletypes.ts`) gives every type its `guide`.
- `techniques.ts`: `TECHNIQUE_GUIDE`, one entry per `TechniqueId`: a name, a one-line summary,
  how to spot and apply it, and an optional worked example.

The entries follow the deductions the engine makes, so every hint can link to one:

| Id | Made by |
|---|---|
| `nakedSingle` | a cell with one candidate left (no cause) |
| `hiddenSingle` | `ExactCoverConstraint`, a value that fits one cell of the group |
| `elimination` | `UniqueValueConstraint`, a placed value removed from its group |
| `nakedSubset`, `hiddenSubset` | `UniqueValueConstraint` / `ExactCoverConstraint` subset searches |
| `intersection`, `xWing`, `swordfish`, `jellyfish` | the techniques in `src/techniques/` |
| `sumCombinations` | `TotalSumValueConstraint` |
| `inequality` | `CellGreaterThanCellConstraint` |
| `wholeLine`, `overlap`, `reach`, `placements` | `RunsConstraint.techniqueOf` |
| `guess` | a guessed value (backtracking) |

`Deduction.techniqueId()` gives the id behind a deduction (from its cause's
`techniqueId(deduction)`), and `HintSession.techniqueId()` the one behind the hint shown.

## In the app

- A **Rules** dialog (`GuideDialog`) with the rules and the techniques of the open puzzle's type,
  opened from the puzzle screen's toolbar and from each card on the start page.
- At the last hint level and after Step, **About this technique** opens the dialog at the
  technique behind the hint.
- The techniques with a pattern on the board (subsets, intersections, fish, overlap) show a small
  example board.

## Tests

- `test/guide.test.ts`: every type has a guide, every technique it lists is explained, every
  technique is listed by some type, and solving every bundled example (with guessing) only makes
  deductions whose technique the type's guide lists.
- App: the guide logic (`app/src/logic/guide.ts`), the dialog, and the hint link; Playwright
  opens the dialog at desktop and phone sizes.
