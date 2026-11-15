"""
Created on 7 jan. 2013

@author: Juice
"""

from constraints import Constraint
from constraints.constraint import formatValues


class CellGreaterThanCellConstraint(Constraint):
    """Enforces lesserCell < greaterCell"""

    def __init__(self, group, initialValues):
        super().__init__(group, initialValues)

        self.lesserCell = None
        self.greaterCell = None

    def notify(self, cell):
        pass

    def setLesserCell(self, cell):
        self.lesserCell = cell

    def setGreaterCell(self, cell):
        self.greaterCell = cell

    def applyConstraint(self):
        # the lesser cell must be smaller than the largest option of the greater cell
        maximumOfGreater = max(self.greaterCell.getPossibleValues())
        for val in self.lesserCell.getPossibleValues():
            if val >= maximumOfGreater:
                self.lesserCell.remove(val)

        # the greater cell must be larger than the smallest option of the lesser cell
        minimumOfLesser = min(self.lesserCell.getPossibleValues())
        for val in self.greaterCell.getPossibleValues():
            if val <= minimumOfLesser:
                self.greaterCell.remove(val)

    def getType(self):
        return "Cell Greater Than Cell Constraint"

    def violations(self, valueOf):
        """Both cells, when the smaller cell does not have the smaller value."""
        if self.lesserCell is None or self.greaterCell is None:
            return set()
        lesser, greater = valueOf(self.lesserCell), valueOf(self.greaterCell)
        if lesser is not None and greater is not None and lesser >= greater:
            return {self.lesserCell, self.greaterCell}
        return set()

    def summary(self):
        if self.lesserCell is None or self.greaterCell is None:
            return "smaller than (cells not set)"
        return f"({self.lesserCell.getName()}) < ({self.greaterCell.getName()})"

    def describe(self):
        if self.lesserCell is None or self.greaterCell is None:
            return "The cells of this constraint have not been set."
        lesser, greater = self.lesserCell, self.greaterCell
        text = f"Cell ({lesser.getName()}) is smaller than cell ({greater.getName()})"
        if lesser.hasValue() and greater.hasValue():
            return f"{text}; satisfied: {lesser.getValue()} < {greater.getValue()}."
        return (
            f"{text}; candidates {formatValues(lesser.getPossibleValues())}"
            f" < {formatValues(greater.getPossibleValues())}."
        )

    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        return allowedValues
