"""
Created on 24 dec. 2012

@author: Juice
"""


def formatValues(values):
    """Format a collection of values for a description, e.g. "1, 3, 4" (or "none")."""
    values = sorted(values)
    return ", ".join(str(v) for v in values) if values else "none"


def placedValues(cells):
    """The values that have been filled in for the given cells."""
    return [c.getValue() for c in cells if c.hasValue()]


class Constraint:
    def __init__(self, group, initialValues):
        self.initialValues = list(initialValues)
        self.group = group

        self.reset()

    def reset(self):
        self.values = list(self.initialValues)

    def applyConstraint(self):
        raise NotImplementedError

    def notify(self, cell):
        raise NotImplementedError

    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        """Narrow allowedValues, given that usedValues are already used in the group.

        Used by ConstraintGroup.valuesAllowedByGroup; by default a rule allows everything."""
        return allowedValues

    def getType(self):
        return type(self).__name__

    def explain(self, deduction):
        """Why this constraint made a change (a structure.deduction.Deduction), in words."""
        return f"{self.group.getName()} ({self.summary()})"

    def summary(self):
        """A short description of the rule, e.g. "sum = 17", used as its name in the GUI."""
        return self.getType()

    def describe(self, showHints=True):
        """A one-line description of the rule and of how far it is satisfied.

        With showHints False, the description leaves out the candidate values the solver has
        deduced, so it does not give away hints about the solution."""
        return self.summary()

    def violations(self, valueOf):
        """The cells that break this rule, given the value shown in each cell.

        valueOf(cell) returns the value of a cell, or None for an empty cell. It may differ
        from cell.getValue(), e.g. for a mistake the user typed in that the model rejected.
        """
        return set()
