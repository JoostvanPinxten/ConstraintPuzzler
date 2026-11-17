---
name: new-constraint
description: Scaffold a new Constraint subclass for ConstraintPuzzler, with unit tests. Use when adding a new kind of puzzle rule (e.g. "cells in this group must be consecutive").
argument-hint: <ConstraintName> <short description of the rule>
---

Create a new constraint: $ARGUMENTS

1. Read `packages/core/src/constraints/constraint.ts` (the contract) and two reference implementations:
   `uniquevalueconstraint.ts` (notify-driven, with explained subset deductions) and
   `totalsumvalueconstraint.ts` (applyConstraint-driven, recursive feasibility check).
2. Create `packages/core/src/constraints/<lowercasename>constraint.ts` with a class extending `Constraint`:
   `applyConstraint()`, `notify(cell)`, `getType()`, `summary()`, `describe(showHints)`, `explain(deduction)`,
   `violations(valueOf)`, and a `static override difficulty` (how hard its deductions are for a person; see
   `Deduction.difficulty`). Only remove values through the group (`this.group.removeValueExceptForList`) or
   the cells (`cell.remove`), so the change is recorded in the deduction log; throw `ContradictionError` for
   an impossible state. Iterate candidate sets with `sortedValues(...)`, so the order is deterministic.
   `src/` may only use relative imports (no React / React Native).
3. Export it from `packages/core/src/index.ts`.
4. Add tests in `packages/core/test/constraints/<name>.test.ts` (vitest), using
   `createSingleConstraintPuzzle(values, numberOfCells, YourConstraint)` from `src/puzzlefactory.ts`. Cover: no
   change when nothing is known, correct elimination, an infeasible case, `describe`, `explain` and
   `violations`.
5. If a puzzle type uses it, the app's highlight roles (`app/src/logic/highlight.ts`) and board decorations
   (`app/src/logic/layout.ts`) may need a case for it.
6. Run the `/test` checks and fix anything that fails.
