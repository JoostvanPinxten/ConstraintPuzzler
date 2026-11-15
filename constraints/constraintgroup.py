"""
Created on 28 dec. 2012

@author: Juice
"""


class ConstraintGroup:
    """A set of cells together with the constraints that apply to them."""

    def __init__(self, puzzle, name="Untitled"):
        self.constraints = []
        self.cells = []
        self.puzzle = puzzle
        self.name = name

    def getValues(self):
        """All values a cell of the puzzle can take."""
        return self.puzzle.getValues()

    def addConstraint(self, constraintType):
        constraint = constraintType(self, self.getValues())
        self.constraints.append(constraint)
        return constraint

    def addCell(self, cell):
        """Add a cell to the group; the cell also learns that it belongs to this group."""
        self.cells.append(cell)
        cell.constraintGroups.append(self)
        cell.valueChanged.connect(self.notify)

    def notify(self, cell):
        for constraint in self.constraints:
            with self.puzzle.causedBy(constraint):
                constraint.notify(cell)

    def removeValue(self, cell, value):
        self.removeValueExceptForList([cell], value)

    def removeValueExceptForList(self, cells, value):
        # Cell.remove raises a ContradictionError when the value is already set in that cell
        for c in self.cells:
            if c not in cells:
                c.remove(value)

    def applyConstraints(self):
        for constraint in self.constraints:
            with self.puzzle.causedBy(constraint):
                constraint.applyConstraint()

    def getName(self):
        return self.name

    def getType(self):
        return "Abstract Constraint"

    def getCells(self):
        return self.cells

    def getConstraints(self):
        return self.constraints

    def valuesAllowedByGroup(self, usedValues):
        allowedValues = self.getValues()
        for c in self.constraints:
            allowedValues = c.getAllowedValuesForValueList(allowedValues, usedValues)

        return allowedValues
