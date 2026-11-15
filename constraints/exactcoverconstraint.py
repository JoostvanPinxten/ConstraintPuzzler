"""
Created on 26 jan. 2013

@author: Juice
"""

from .constraint import formatValues, placedValues
from .uniquevalueconstraint import UniqueValueConstraint


class ExactCoverConstraint(UniqueValueConstraint):
    def __init__(self, group, initialValues):
        super().__init__(group, initialValues)

    def applyConstraint(self):
        values = set()
        for c in self.group.getCells():
            values |= set(c.getPossibleValues())
        newValues = self.checkForSinglePosition(values)

        for cell, value in newValues.items():
            if value is not None:
                cell.inferValue(value)

        self.searchForNakedSet()

    # TODO: make this more generic, iso just for a single pair, use multiple levels
    # TODO: this only applies for combination of constraint groups that have the
    #       exactlyOnce/UVC constraint
    # TODO: can be refactored into a new type of constraint (and extract the old
    #       exactlyonce contraint)
    def searchForNakedSet(self):
        # iterate over all the cells and check if any one of the initial value can still be
        # entered
        cells = {}
        for value in self.group.getValues():
            cells[value] = set()

        for c in self.group.getCells():
            for val in c.getPossibleValues():
                cells[val].add(c)

        for value in self.group.getValues():
            # at least values for two cells must be eliminated to qualify for a naked set:
            if len(cells[value]) > len(self.group.getCells()) - 2:
                continue

            # naked pair
            if len(cells[value]) == 2:
                relatedValues = set()
                for cell in cells[value]:
                    relatedValues |= cell.getPossibleValues()

                relatedValues -= set([value])

                for otherValue in relatedValues:
                    if cells[otherValue] == cells[value]:
                        for nakedCell in cells[otherValue]:
                            for removeValue in set(self.group.getValues()) - set(
                                [value, otherValue]
                            ):
                                nakedCell.remove(removeValue)

    def getType(self):
        return "Exact cover constraint"

    def summary(self):
        return "each value once"

    def explain(self, deduction):
        placed = set(placedValues(self.group.getCells()))
        if deduction.setsValue() or deduction.removed <= placed:
            return super().explain(deduction)
        removed = formatValues(deduction.removed)
        return (
            f"{self.group.getName()} has values that can only go in this cell and one other,"
            f" so there is no room for {removed} ({self.summary()})"
        )

    def describe(self, showHints=True):
        missing = set(self.group.getValues()) - set(placedValues(self.group.getCells()))
        if not missing:
            return "Every value appears exactly once; complete."
        return f"Every value appears exactly once; still missing: {formatValues(missing)}."

    def __str__(self):
        return "ecc[" + ",".join([str(x) for x in self.values]) + "]"
