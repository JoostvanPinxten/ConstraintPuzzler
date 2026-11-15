"""
Created on 7 jan. 2013

@author: Juice
"""

from constraints import Constraint


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

    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        return allowedValues
