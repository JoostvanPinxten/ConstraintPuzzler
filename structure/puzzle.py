from __future__ import annotations

from collections.abc import Iterable, Iterator
from contextlib import AbstractContextManager, contextmanager, nullcontext
from typing import TYPE_CHECKING

import constraints
from structure.grid import Grid

if TYPE_CHECKING:
    from constraints.constraint import Constraint
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import DeductionLog
    from structure.types import PuzzleState, Value


class Puzzle:
    """Puzzle is the top-level item which holds the constraint groups and grid"""

    def __init__(self, name: str, values: Iterable[Value]) -> None:
        self.values: list[Value] = list(values)
        self.constraintGroups: list[ConstraintGroup] = []

        self.name = name

        self.grid = Grid(self.values, self)
        # while set (see recording), changes to the cells are recorded in this DeductionLog
        self.deductionLog: DeductionLog | None = None

    @contextmanager
    def recording(self, log: DeductionLog) -> Iterator[DeductionLog]:
        """Record the changes to the cells made inside the block in a DeductionLog."""
        previous = self.deductionLog
        self.deductionLog = log
        try:
            yield log
        finally:
            self.deductionLog = previous

    def causedBy(self, constraint: Constraint | None) -> AbstractContextManager[None]:
        """Attribute the changes made inside the block to a constraint (while recording)."""
        if self.deductionLog is None:
            return nullcontext()
        return self.deductionLog.cause(constraint)

    def getGrid(self) -> Grid:
        return self.grid

    def getValues(self) -> list[Value]:
        return list(self.values)

    def addConstraintGroup(self, name: str) -> ConstraintGroup:
        cg = constraints.ConstraintGroup(self, name)
        self.constraintGroups.append(cg)
        return cg

    def getConstraintGroups(self) -> list[ConstraintGroup]:
        return self.constraintGroups

    def getConstraints(self) -> list[Constraint]:
        return [c for cg in self.constraintGroups for c in cg.getConstraints()]

    def saveState(self) -> PuzzleState:
        """Snapshot of all mutable solving state. The snapshot is immutable and
        comparable, so it can also be used to detect whether anything changed."""
        cells = tuple((frozenset(c.values), c.value, c.source) for c in self.grid.cells)
        constraints = tuple(tuple(c.values) for c in self.getConstraints())
        return (cells, constraints)

    def restoreState(self, state: PuzzleState) -> None:
        """Restore a snapshot made by saveState(). Only possibleValuesChanged is
        emitted, so the constraints are not triggered by the restore; it is only
        emitted for cells whose state actually changed."""
        cellStates, constraintStates = state
        changedCells: list[Cell] = []
        for cell, cellState in zip(self.grid.cells, cellStates, strict=True):
            if (frozenset(cell.values), cell.value, cell.source) == cellState:
                continue
            values, value, source = cellState
            cell.values = set(values)
            cell.value = value
            cell.source = source
            changedCells.append(cell)
        for constraint, values in zip(self.getConstraints(), constraintStates, strict=True):
            constraint.values = list(values)
        for cell in changedCells:
            cell.possibleValuesChanged.emit(cell)

    def getOpenCells(self) -> list[Cell]:
        """The cells that do not have a value yet"""
        return [c for c in self.grid.cells if not c.hasValue()]

    def getNumberOfOpenCells(self) -> int:
        return len(self.getOpenCells())

    def isSolved(self) -> bool:
        return not self.getOpenCells()
