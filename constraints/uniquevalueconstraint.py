"""
Created on 28 dec. 2012

@author: Juice
"""

from constraints import Constraint
from constraints.constraint import formatValues, placedValues


class UniqueValueConstraint(Constraint):
    def __init__(self, group, initialValues):
        super().__init__(group, initialValues)

    def notify(self, cell):
        """Notifies the constraint that a value has been set for the given cell"""
        value = cell.getValue()
        if value in self.values:
            self.values.remove(value)
            self.group.removeValue(cell, value)

    def applyConstraint(self):
        return

    def getType(self):
        return "Unique Value Constraint"

    def summary(self):
        return "all different"

    def violations(self, valueOf):
        """The cells that share their value with another cell of the group."""
        cellsByValue = {}
        for cell in self.group.getCells():
            value = valueOf(cell)
            if value is not None:
                cellsByValue.setdefault(value, []).append(cell)
        return {c for cells in cellsByValue.values() if len(cells) > 1 for c in cells}

    def describe(self):
        placed = placedValues(self.group.getCells())
        if not placed:
            return "The values must all differ; nothing is placed yet."
        return f"The values must all differ; placed so far: {formatValues(placed)}."

    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        # return allowedValues
        # print allowedValues, usedValues, set(usedValues) - set(self.values)
        return set(allowedValues) - set(usedValues)

    def checkForSinglePosition(self, values):
        newValuesMap = {}
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

    def __str__(self):
        return "UVC[" + ",".join([str(x) for x in self.values]) + "]"
