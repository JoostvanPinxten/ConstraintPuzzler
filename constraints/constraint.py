from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING, ClassVar

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.types import Value, ValueOf


def formatValues(values: Iterable[Value]) -> str:
    """Format a collection of values for a description, e.g. "1, 3, 4" (or "none")."""
    values = sorted(values)
    return ", ".join(str(v) for v in values) if values else "none"


def placedValues(cells: Iterable[Cell]) -> list[Value]:
    """The values that have been filled in for the given cells."""
    return [value for c in cells if (value := c.getValue()) is not None]


class Constraint:
    # how hard a deduction of this constraint is for a person (see Deduction.difficulty); hints
    # and single steps show the easiest deduction first
    difficulty: ClassVar[int] = 5

    def __init__(self, group: ConstraintGroup, initialValues: Iterable[Value]) -> None:
        self.initialValues: list[Value] = list(initialValues)
        self.group = group

        self.reset()

    def reset(self) -> None:
        self.values: list[Value] = list(self.initialValues)

    def applyConstraint(self) -> None:
        raise NotImplementedError

    def notify(self, cell: Cell) -> None:
        raise NotImplementedError

    def getAllowedValuesForValueList(
        self, allowedValues: Iterable[Value], usedValues: Iterable[Value]
    ) -> Iterable[Value]:
        """Narrow allowedValues, given that usedValues are already used in the group.

        Used by ConstraintGroup.valuesAllowedByGroup; by default a rule allows everything."""
        return allowedValues

    def getType(self) -> str:
        return type(self).__name__

    def explain(self, deduction: Deduction) -> str:
        """Why this constraint made a change (a structure.deduction.Deduction), in words."""
        return f"{self.group.getName()} ({self.summary()})"

    def summary(self) -> str:
        """A short description of the rule, e.g. "sum = 17", used as its name in the GUI."""
        return self.getType()

    def describe(self, showHints: bool = True) -> str:
        """A one-line description of the rule and of how far it is satisfied.

        With showHints False, the description leaves out the candidate values the solver has
        deduced, so it does not give away hints about the solution."""
        return self.summary()

    def violations(self, valueOf: ValueOf) -> set[Cell]:
        """The cells that break this rule, given the value shown in each cell.

        valueOf(cell) returns the value of a cell, or None for an empty cell. It may differ
        from cell.getValue(), e.g. for a mistake the user typed in that the model rejected.
        """
        return set()
