"""Hints in three levels: where to look, which cell, and finally the value and why.

Asking for a hint again while the puzzle has not changed reveals more of the same deduction,
so a user can get just enough help: first the region (the cells of the rule that decides the
value), then the cell, then the value with its reason. After the puzzle changes, the next hint
is a new one.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from solver.Solver import Solver
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.types import PuzzleState

# the hint levels
REGION = 1
CELL = 2
VALUE = 3


class HintSession:
    def __init__(self) -> None:
        self.deduction: Deduction | None = None
        # 0 (no hint), REGION, CELL or VALUE
        self.level = 0
        # the puzzle state the hint was made for
        self.state: PuzzleState | None = None

    def reset(self) -> None:
        self.deduction = None
        self.level = 0
        self.state = None

    def advance(self, solver: Solver) -> Deduction | None:
        """Reveal more of the current hint, or start a new one (at REGION) when there is none
        or the puzzle changed since. Returns the hint's deduction; None when the rules do not
        determine any value now (the session is then reset). Raises ContradictionError like
        Solver.hint()."""
        state = solver.puzzle.saveState()
        if self.deduction is None or state != self.state:
            self.reset()
            deduction = solver.hint()
            if deduction is None:
                return None
            self.deduction, self.level, self.state = deduction, REGION, state
        else:
            self.level = min(self.level + 1, VALUE)
        return self.deduction

    def regionCells(self) -> set[Cell]:
        """The cells to look at: the group of the constraint that decides the value, or, for a
        cell with a single candidate left, every group the cell is in."""
        deduction = self.deduction
        if deduction is None:
            return set()
        if deduction.cause is not None:
            return set(deduction.cause.group.getCells())
        return {c for g in deduction.cell.getConstraintGroups() for c in g.getCells()}

    def message(self) -> str:
        """What the hint says at its current level."""
        deduction = self.deduction
        if deduction is None:
            return ""
        if self.level == REGION:
            cause = deduction.cause
            if cause is None:
                return "In the highlighted area, one cell has only one possible value left."
            return (
                f"Look at {cause.group.getName()} ({cause.summary()}):"
                " it decides the value of one of its cells."
            )
        if self.level == CELL:
            return f"Look at cell {deduction.cell.getName()}."
        return deduction.describe()
