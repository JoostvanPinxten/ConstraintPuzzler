from __future__ import annotations

from collections.abc import Iterable
from itertools import combinations
from typing import TYPE_CHECKING

from constraints import Constraint
from constraints.constraint import formatValues, placedValues
from structure.errors import ContradictionError

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.types import Value, ValueOf


class UniqueValueConstraint(Constraint):
    difficulty = 2  # a value that fits only one cell of the group

    def __init__(self, group: ConstraintGroup, initialValues: Iterable[Value]) -> None:
        super().__init__(group, initialValues)

    def reset(self) -> None:
        super().reset()
        # why a candidate was removed by a subset deduction: (cell, value) -> reason
        self.removalReasons: dict[tuple[Cell, Value], str] = {}

    def openCells(self) -> list[Cell]:
        return [c for c in self.group.getCells() if not c.hasValue()]

    def removeWithReason(self, cells: Iterable[Cell], values: Iterable[Value], reason: str) -> None:
        """Remove values from cells, remembering the reason for explain()."""
        for cell in cells:
            for value in set(values) & cell.getPossibleValues():
                self.removalReasons[(cell, value)] = reason
                cell.remove(value)

    def subsetReason(self, deduction: Deduction) -> str | None:
        """The reason a subset deduction gave for this removal, if it made it."""
        reasons = {self.removalReasons.get((deduction.cell, v)) for v in deduction.removed}
        if len(reasons) != 1:
            return None
        (reason,) = reasons
        return reason

    def searchForNakedSubsets(self) -> None:
        """If k open cells together have only k candidates, those values go in those cells,
        so no other cell of the group can hold them (a naked pair, triple, ...)."""
        found = True
        while found:
            found = False
            openCells = self.openCells()
            for size in range(2, len(openCells)):
                small = [c for c in openCells if len(c.getPossibleValues()) <= size]
                for subset in combinations(small, size):
                    values: set[Value] = set().union(*(c.getPossibleValues() for c in subset))
                    if len(values) < size:
                        raise ContradictionError(
                            f"{self.group.getName()}: {size} cells share only"
                            f" {len(values)} candidates ({formatValues(values)})"
                        )
                    if len(values) > size:
                        continue
                    others = [c for c in openCells if c not in subset]
                    if not any(values & c.getPossibleValues() for c in others):
                        continue
                    names = "; ".join(c.getName() for c in subset)
                    reason = (
                        f"{self.group.getName()}: {names} can only hold"
                        f" {formatValues(values)} between them, so no other cell can"
                        f" ({self.summary()})"
                    )
                    self.removeWithReason(others, values, reason)
                    found = True
                    break
                if found:
                    break

    def notify(self, cell: Cell) -> None:
        """Notifies the constraint that a value has been set for the given cell"""
        value = cell.getValue()
        if value in self.values:
            self.values.remove(value)
            # the placement, not an earlier subset deduction, is why the others lose it now
            for other in self.group.getCells():
                if value in other.getPossibleValues():
                    self.removalReasons.pop((other, value), None)
            self.group.removeValue(cell, value)

    def applyConstraint(self) -> None:
        self.searchForNakedSubsets()

    def getType(self) -> str:
        return "Unique Value Constraint"

    def summary(self) -> str:
        return "all different"

    def explain(self, deduction: Deduction) -> str:
        reason = self.subsetReason(deduction)
        if reason is not None:
            return reason
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
