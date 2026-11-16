"""
Created on 28 dec. 2012

@author: Juice
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

from constraints import Constraint
from constraints.constraint import formatValues, placedValues

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.types import Value, ValueOf


class UniqueValueConstraint(Constraint):
    def __init__(self, group: ConstraintGroup, initialValues: Iterable[Value]) -> None:
        super().__init__(group, initialValues)

    def notify(self, cell: Cell) -> None:
        """Notifies the constraint that a value has been set for the given cell"""
        value = cell.getValue()
        if value in self.values:
            self.values.remove(value)
            self.group.removeValue(cell, value)

    def applyConstraint(self) -> None:
        return

    def getType(self) -> str:
        return "Unique Value Constraint"

    def summary(self) -> str:
        return "all different"

    def explain(self, deduction: Deduction) -> str:
        group = self.group.getName()
        if deduction.setsValue():
            return f"{group} needs {deduction.value} and it fits nowhere else"
        removed = ", ".join(str(v) for v in sorted(deduction.removed))
        return f"{group} already has {removed} ({self.summary()})"

    def violations(self, valueOf: ValueOf) -> set[Cell]:
        """The cells that share their value with another cell of the group."""
        cellsByValue: dict[Value, list[Cell]] = {}
        for cell in self.group.getCells():
            value = valueOf(cell)
            if value is not None:
                cellsByValue.setdefault(value, []).append(cell)
        return {c for cells in cellsByValue.values() if len(cells) > 1 for c in cells}

    def describe(self, showHints: bool = True) -> str:
        placed = placedValues(self.group.getCells())
        if not placed:
            return "The values must all differ; nothing is placed yet."
        return f"The values must all differ; placed so far: {formatValues(placed)}."

    def getAllowedValuesForValueList(
        self, allowedValues: Iterable[Value], usedValues: Iterable[Value]
    ) -> Iterable[Value]:
        return set(allowedValues) - set(usedValues)

    def checkForSinglePosition(self, values: Iterable[Value]) -> dict[Cell, Value]:
        """The values that fit in only one open cell of the group: cell -> value."""
        newValuesMap: dict[Cell, Value] = {}
        for value in values:
            continueSearching = True
            firstCell = None
            for c in self.group.getCells():
                setValue = c.getValue()
                if setValue == value:
                    continueSearching = False
                    break

                if c.hasValue():
                    continue

                if value in c.getPossibleValues():
                    if firstCell is None:
                        firstCell = c
                    else:
                        continueSearching = False
                        break
                else:
                    continue

            if continueSearching and firstCell is not None:
                newValuesMap[firstCell] = value
        return newValuesMap

    def __str__(self) -> str:
        return "UVC[" + ",".join([str(x) for x in self.values]) + "]"
