"""
Created on 28 dec. 2012

@author: Juice
"""

from constraints import Constraint
from constraints.constraint import formatValues, placedValues
from structure.errors import ContradictionError


class TotalSumValueConstraint(Constraint):
    def __init__(self, group, initialValues):
        super().__init__(group, initialValues)
        self.totalValue = None

    def notify(self, cell):
        pass

    def applyConstraint(self):
        # look at what cells
        if self.totalValue is None:
            raise Exception("Total value of sum constraint has not been initialized!")

        openCells = list(self.group.getCells())
        filledCells = []
        valuesUsed = []
        total = self.totalValue
        for c in self.group.cells:
            if c.hasValue():
                filledCells.append(c)

                openCells.remove(c)
                val = c.getValue()
                total -= val

                valuesUsed.append(c.getValue())

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

    def applyConstraintRecursively(self, leftOverSum, leftOverCellCount, valuesUsed=None):
        """Compute the set of allowed values recursively"""
        if valuesUsed is None:
            valuesUsed = []

        # if there is no leftOver from the sum, but we arrived here anyway, then return nothing
        if leftOverCellCount == 0 or leftOverSum <= 0:
            return set([])

        allowedSet = set()
        for value in self.group.valuesAllowedByGroup(valuesUsed):
            # print valuesUsed, value
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

    def getType(self):
        return "Total Sum Value Constraint"

    def summary(self):
        return f"sum = {self.totalValue}"

    def describe(self):
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
        # the values that can still complete the sum (without changing any state)
        candidates = set(self.values) & self.applyConstraintRecursively(left, openCount, placed)
        return f"{text}; candidates: {formatValues(candidates)}."

    def setTotalValue(self, value):
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

    def getTotalValue(self):
        return self.totalValue

    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        return allowedValues

    def __str__(self):
        return "tsvc[" + ",".join([str(x) for x in self.values]) + "]"
