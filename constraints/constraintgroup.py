"""
Created on 28 dec. 2012

@author: Juice
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

from structure.cell import PositionedCell

if TYPE_CHECKING:
    from constraints.constraint import Constraint
    from structure.cell import Cell
    from structure.puzzle import Puzzle
    from structure.types import Value


class ConstraintGroup:
    """A set of cells together with the constraints that apply to them."""

    def __init__(self, puzzle: Puzzle, name: str = "Untitled") -> None:
        self.constraints: list[Constraint] = []
        self.cells: list[Cell] = []
        self.puzzle = puzzle
        self.name = name

    def getValues(self) -> list[Value]:
        """All values a cell of the puzzle can take."""
        return self.puzzle.getValues()

    def addConstraint[C: Constraint](self, constraintType: type[C]) -> C:
        constraint = constraintType(self, self.getValues())
        self.constraints.append(constraint)
        return constraint

    def addCell(self, cell: Cell) -> None:
        """Add a cell to the group; the cell also learns that it belongs to this group."""
        self.cells.append(cell)
        cell.constraintGroups.append(self)
        cell.valueChanged.connect(self.notify)

    def notify(self, cell: Cell) -> None:
        for constraint in self.constraints:
            with self.puzzle.causedBy(constraint):
                constraint.notify(cell)

    def removeValue(self, cell: Cell, value: Value) -> None:
        self.removeValueExceptForList([cell], value)

    def removeValueExceptForList(self, cells: Iterable[Cell], value: Value) -> None:
        # Cell.remove raises a ContradictionError when the value is already set in that cell
        for c in self.cells:
            if c not in cells:
                c.remove(value)

    def applyConstraints(self) -> None:
        for constraint in self.constraints:
            with self.puzzle.causedBy(constraint):
                constraint.applyConstraint()

    def getName(self) -> str:
        return self.name

    def getType(self) -> str:
        return "Abstract Constraint"

    def getCells(self) -> list[Cell]:
        return self.cells

    def getPositionedCells(self) -> list[PositionedCell]:
        """The cells of the group that have a position (in the puzzle types here, all)."""
        return [c for c in self.cells if isinstance(c, PositionedCell)]

    def getConstraints(self) -> list[Constraint]:
        return self.constraints

    def valuesAllowedByGroup(self, usedValues: Iterable[Value]) -> Iterable[Value]:
        allowedValues: Iterable[Value] = self.getValues()
        for c in self.constraints:
            allowedValues = c.getAllowedValuesForValueList(allowedValues, usedValues)

        return allowedValues
