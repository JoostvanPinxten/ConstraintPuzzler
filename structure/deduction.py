"""A record of what the solver (or a constraint reacting to a value) changed, and why.

While a DeductionLog is installed on a puzzle (Puzzle.recording), every candidate removed from
a cell and every value set in a cell is recorded as a Deduction, together with the constraint
that was acting at that moment (Puzzle.causedBy). The solver uses the log to know which cells
changed, so it only re-applies the constraints of those cells, and to explain a step or a hint.
"""

from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

from structure.cell import ValueSource


@dataclass(frozen=True, eq=False)
class Deduction:
    cell: Any
    # the candidates removed from the cell (empty when a value was set)
    removed: frozenset = field(default_factory=frozenset)
    # the value set in the cell (None when candidates were removed)
    value: Any = None
    # where a set value came from (deduced, guessed, entered, given)
    source: ValueSource | None = None
    # the constraint that made the change; None for a cell's own check (a single candidate
    # left), a guess, or a change from outside the solver
    cause: Any = None

    def setsValue(self):
        return self.value is not None

    def reason(self):
        """Why the change was made, in words."""
        if self.cause is not None:
            return self.cause.explain(self)
        if self.source is ValueSource.GUESSED:
            return f"{self.value} is a guess (backtracking)"
        if self.setsValue() and self.source is ValueSource.DEDUCED:
            return f"{self.value} is the only candidate left in this cell"
        if self.setsValue():
            return f"{self.value} was {self.source.value if self.source else 'set'}"
        return "removed"

    def describe(self):
        """What changed and why, e.g. "cell 3, 4: 7, because ..."."""
        name = self.cell.getName()
        if self.setsValue():
            what = f"cell {name} is {self.value}"
        else:
            removed = ", ".join(str(v) for v in sorted(self.removed))
            what = f"cell {name} cannot be {removed}"
        return f"{what}: {self.reason()}."


class DeductionLog:
    def __init__(self):
        self.deductions: list[Deduction] = []
        self._causes: list[Any] = []

    def __len__(self):
        return len(self.deductions)

    def currentCause(self):
        return self._causes[-1] if self._causes else None

    @contextmanager
    def cause(self, constraint):
        """Attribute the changes made inside the block to a constraint."""
        self._causes.append(constraint)
        try:
            yield
        finally:
            self._causes.pop()

    def recordRemoval(self, cell, value):
        self.deductions.append(
            Deduction(cell, removed=frozenset([value]), cause=self.currentCause())
        )

    def recordValue(self, cell, value, source):
        cause = self.currentCause() if source is ValueSource.DEDUCED else None
        self.deductions.append(Deduction(cell, value=value, source=source, cause=cause))

    def truncate(self, length):
        """Forget the deductions after the first `length` (e.g. after an undone guess)."""
        del self.deductions[length:]

    def since(self, length):
        return self.deductions[length:]

    def changedCells(self, start=0):
        return {d.cell for d in self.deductions[start:]}
