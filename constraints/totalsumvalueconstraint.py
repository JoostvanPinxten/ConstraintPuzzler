"""
Created on 28 dec. 2012

@author: Juice
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING

from constraints import Constraint
from constraints.constraint import formatValues, placedValues
from structure.errors import ContradictionError

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.types import Value, ValueOf


class TotalSumValueConstraint(Constraint):
    difficulty = 4  # needs the combinations that make up the sum

    def __init__(self, group: ConstraintGroup, initialValues: Iterable[Value]) -> None:
        super().__init__(group, initialValues)
        self.totalValue: int | None = None

    def notify(self, cell: Cell) -> None:
        pass

    def applyConstraint(self) -> None:
        # look at what cells
        if self.totalValue is None:
            raise Exception("Total value of sum constraint has not been initialized!")

        openCells = list(self.group.getCells())
        filledCells: list[Cell] = []
        valuesUsed: list[Value] = []
        total = self.totalValue
        for c in self.group.cells:
            val = c.getValue()
            if val is not None:
                filledCells.append(c)
                openCells.remove(c)
                total -= val
                valuesUsed.append(val)

        if not openCells:
            if total != 0:
                raise ContradictionError(
                    "All cells are filled, but they do not add up to " + str(self.totalValue)
                )
            return

        allowedSet = self.applyConstraintRecursively(total, len(openCells), valuesUsed)

        # iterate over a copy: values are removed from self.values inside the loop
        for value in list(self.values):
            if value not in allowedSet:
                self.values.remove(value)
                self.group.removeValueExceptForList(filledCells, value)

    def applyConstraintRecursively(
        self, leftOverSum: int, leftOverCellCount: int, valuesUsed: list[Value] | None = None
    ) -> set[Value]:
        """Compute the set of allowed values recursively"""
        if valuesUsed is None:
            valuesUsed = []

        # if there is no leftOver from the sum, but we arrived here anyway, then return nothing
        if leftOverCellCount == 0 or leftOverSum <= 0:
            return set([])

        allowedSet = set()
        for value in self.group.valuesAllowedByGroup(valuesUsed):
            valuesUsedNow = list(valuesUsed)
            valuesUsedNow.append(value)

            if leftOverSum == value and leftOverCellCount == 1:
                return set([value])

            stillAllowed = self.applyConstraintRecursively(
                leftOverSum - value, leftOverCellCount - 1, valuesUsedNow
            )
            if stillAllowed is not None:
                allowedSet |= stillAllowed

        return allowedSet

    def getType(self) -> str:
        return "Total Sum Value Constraint"

    def summary(self) -> str:
        return f"sum = {self.totalValue}"

    def explain(self, deduction: Deduction) -> str:
        group = self.group.getName()
        if deduction.setsValue():
            return f"{group} must add up to {self.totalValue}"
        removed = formatValues(deduction.removed)
        return f"{group} must add up to {self.totalValue}, and no combination with {removed} does"

    def violations(self, valueOf: ValueOf) -> set[Cell]:
        """All filled cells, when they already add up to more than the total, or when the
        group is complete and does not add up to the total."""
        if self.totalValue is None:
            return set()
        cells = self.group.getCells()
        shown = {c: value for c in cells if (value := valueOf(c)) is not None}
        filled = list(shown)
        total = sum(shown.values())
        if total > self.totalValue or (len(filled) == len(cells) and total != self.totalValue):
            return set(filled)
        return set()

    def describe(self, showHints: bool = True) -> str:
        if self.totalValue is None:
            return "The total of this sum has not been set."
        cells = self.group.getCells()
        placed = placedValues(cells)
        openCount = len(cells) - len(placed)
        text = f"The values add up to {self.totalValue}"
        if openCount == 0:
            return f"{text}; complete ({' + '.join(str(v) for v in placed)})."
        left = self.totalValue - sum(placed)
        cellWord = "cell" if openCount == 1 else "cells"
        if placed:
            text += f"; {sum(placed)} is placed, so {left} is left for {openCount} open {cellWord}"
        else:
            text += f" over {openCount} open {cellWord}"
        if not showHints:
            return f"{text}."
        # the values that can still complete the sum (without changing any state)
        candidates = set(self.values) & self.applyConstraintRecursively(left, openCount, placed)
        return f"{text}; candidates: {formatValues(candidates)}."

    def setTotalValue(self, value: int) -> None:
        from constraints import UniqueValueConstraint

        values = list(self.initialValues)  # copy the initial values
        values.sort()

        # simple check to see if the total sum constraint is definitely infeasible
        hasUniqueValueConstraint = (
            sum(
                [
                    isinstance(constraint, UniqueValueConstraint)
                    for constraint in self.group.constraints
                ]
            )
            != 0
        )
        if hasUniqueValueConstraint:  # if there is also a unique value constraint:
            minimum = sum(
                values[: len(self.group.cells)]
            )  # take the sum of the N smallest elements as the minimum number
        else:
            minimum = values[0] * len(self.group.cells)
        if value < minimum:
            raise Exception("Infeasible sum value " + str(value) + ",  minimum is " + str(minimum))
        self.totalValue = value

    def getTotalValue(self) -> int | None:
        return self.totalValue

    def getAllowedValuesForValueList(
        self, allowedValues: Iterable[Value], usedValues: Iterable[Value]
    ) -> Iterable[Value]:
        return allowedValues

    def __str__(self) -> str:
        return "tsvc[" + ",".join([str(x) for x in self.values]) + "]"
