from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

from constraints import Constraint
from constraints.constraint import formatValues

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.types import Value, ValueOf


class CellGreaterThanCellConstraint(Constraint):
    """Enforces lesserCell < greaterCell"""

    def __init__(self, group: ConstraintGroup, initialValues: Iterable[Value]) -> None:
        super().__init__(group, initialValues)

        self.lesserCell: Cell | None = None
        self.greaterCell: Cell | None = None

    def notify(self, cell: Cell) -> None:
        pass

    def setLesserCell(self, cell: Cell) -> None:
        self.lesserCell = cell

    def setGreaterCell(self, cell: Cell) -> None:
        self.greaterCell = cell

    def applyConstraint(self) -> None:
        lesser, greater = self.lesserCell, self.greaterCell
        if lesser is None or greater is None:
            return  # not set up yet
        # the lesser cell must be smaller than the largest option of the greater cell
        maximumOfGreater = max(greater.getPossibleValues())
        for val in lesser.getPossibleValues():
            if val >= maximumOfGreater:
                lesser.remove(val)

        # the greater cell must be larger than the smallest option of the lesser cell
        minimumOfLesser = min(lesser.getPossibleValues())
        for val in greater.getPossibleValues():
            if val <= minimumOfLesser:
                greater.remove(val)

    def getType(self) -> str:
        return "Cell Greater Than Cell Constraint"

    def violations(self, valueOf: ValueOf) -> set[Cell]:
        """Both cells, when the smaller cell does not have the smaller value."""
        if self.lesserCell is None or self.greaterCell is None:
            return set()
        lesser, greater = valueOf(self.lesserCell), valueOf(self.greaterCell)
        if lesser is not None and greater is not None and lesser >= greater:
            return {self.lesserCell, self.greaterCell}
        return set()

    def summary(self) -> str:
        if self.lesserCell is None or self.greaterCell is None:
            return "smaller than (cells not set)"
        return f"({self.lesserCell.getName()}) < ({self.greaterCell.getName()})"

    def describe(self, showHints: bool = True) -> str:
        if self.lesserCell is None or self.greaterCell is None:
            return "The cells of this constraint have not been set."
        lesser, greater = self.lesserCell, self.greaterCell
        text = f"Cell ({lesser.getName()}) is smaller than cell ({greater.getName()})"
        if lesser.hasValue() and greater.hasValue():
            return f"{text}; satisfied: {lesser.getValue()} < {greater.getValue()}."
        if not showHints:
            return f"{text}."
        return (
            f"{text}; candidates {formatValues(lesser.getPossibleValues())}"
            f" < {formatValues(greater.getPossibleValues())}."
        )

    def getAllowedValuesForValueList(
        self, allowedValues: Iterable[Value], usedValues: Iterable[Value]
    ) -> Iterable[Value]:
        return allowedValues
