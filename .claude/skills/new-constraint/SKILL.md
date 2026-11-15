---
name: new-constraint
description: Scaffold a new Constraint subclass for ConstraintPuzzler, with unit tests. Use when adding a new kind of puzzle rule (e.g. "cells in this group must be consecutive").
argument-hint: <ConstraintName> <short description of the rule>
---

Create a new constraint: $ARGUMENTS

1. Read `constraints/constraint.py` (the contract) and two reference implementations:
   `constraints/uniquevalueconstraint.py` (notify-driven) and `constraints/totalsumvalueconstraint.py`
   (applyConstraint-driven, recursive feasibility check).
2. Create `constraints/<lowercasename>constraint.py` with a class implementing `notify(cell)`,
   `applyConstraint()`, `getType()`, `getAllowedValuesForValueList(allowedValues, usedValues)` and `__str__`.
   Follow the existing camelCase style. Only remove values through the group (`self.group.removeValueExceptForList`)
   or the cells (`cell.remove`), so the Qt signals fire.
3. Export it from `constraints/__init__.py` (both the import and `__all__`).
4. Add tests in `constraints/tests/test_constraints.py` (or a new `constraints/tests/test_<name>.py`), using
   `PuzzleFactory.createSingleConstraintPuzzle(values, numberOfCells, YourConstraint)` from
   `utility/puzzlefactory.py`. Cover: no-op when nothing is known, correct elimination, and an infeasible case.
5. Run the `/test` checks and fix anything that fails.
