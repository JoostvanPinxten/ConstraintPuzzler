"""A record of what the solver (or a constraint reacting to a value) changed, and why.

While a DeductionLog is installed on a puzzle (Puzzle.recording), every candidate removed from
a cell and every value set in a cell is recorded as a Deduction, together with the constraint
that was acting at that moment (Puzzle.causedBy). The solver uses the log to know which cells
changed, so it only re-applies the constraints of those cells, and to explain a step or a hint.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from structure.cell import ValueSource

if TYPE_CHECKING:
    from constraints.constraint import Constraint
    from structure.cell import Cell
    from structure.types import Value


@dataclass(frozen=True, eq=False)
class Deduction:
    cell: Cell
    # the candidates removed from the cell (empty when a value was set)
    removed: frozenset[Value] = field(default_factory=frozenset)
    # the value set in the cell (None when candidates were removed)
    value: Value | None = None
    # where a set value came from (deduced, guessed, entered, given)
    source: ValueSource | None = None
    # the constraint that made the change; None for a cell's own check (a single candidate
    # left), a guess, or a change from outside the solver
    cause: Constraint | None = None

    def setsValue(self) -> bool:
        return self.value is not None

    def reason(self) -> str:
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

    def describe(self) -> str:
        """What changed and why, e.g. "cell 3, 4: 7, because ..."."""
        name = self.cell.getName()
        if self.setsValue():
            what = f"cell {name} is {self.value}"
        else:
            removed = ", ".join(str(v) for v in sorted(self.removed))
            what = f"cell {name} cannot be {removed}"
        return f"{what}: {self.reason()}."


class DeductionLog:
    def __init__(self) -> None:
        self.deductions: list[Deduction] = []
        self._causes: list[Constraint | None] = []

    def __len__(self) -> int:
        return len(self.deductions)

    def currentCause(self) -> Constraint | None:
        return self._causes[-1] if self._causes else None

    @contextmanager
    def cause(self, constraint: Constraint | None) -> Iterator[None]:
        """Attribute the changes made inside the block to a constraint."""
        self._causes.append(constraint)
        try:
            yield
        finally:
            self._causes.pop()

    def recordRemoval(self, cell: Cell, value: Value) -> None:
        self.deductions.append(
            Deduction(cell, removed=frozenset([value]), cause=self.currentCause())
        )

    def recordValue(self, cell: Cell, value: Value, source: ValueSource) -> None:
        cause = self.currentCause() if source is ValueSource.DEDUCED else None
        self.deductions.append(Deduction(cell, value=value, source=source, cause=cause))

    def truncate(self, length: int) -> None:
        """Forget the deductions after the first `length` (e.g. after an undone guess)."""
        del self.deductions[length:]

    def since(self, length: int) -> list[Deduction]:
        return self.deductions[length:]

    def changedCells(self, start: int = 0) -> set[Cell]:
        return {d.cell for d in self.deductions[start:]}
