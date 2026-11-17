from __future__ import annotations

from collections.abc import Iterable
from itertools import combinations
from typing import TYPE_CHECKING

from structure.errors import ContradictionError

from .constraint import formatValues, placedValues
from .uniquevalueconstraint import UniqueValueConstraint

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.types import Value


class ExactCoverConstraint(UniqueValueConstraint):
    """Every value of the group appears exactly once (e.g. a Sudoku row)."""

    def __init__(self, group: ConstraintGroup, initialValues: Iterable[Value]) -> None:
        super().__init__(group, initialValues)

    def applyConstraint(self) -> None:
        values: set[Value] = set()
        for c in self.group.getCells():
            values |= set(c.getPossibleValues())
        newValues = self.checkForSinglePosition(values)

        for cell, value in newValues.items():
            if value is not None:
                cell.inferValue(value)

        self.searchForNakedSubsets()
        self.searchForHiddenSubsets()

    def searchForHiddenSubsets(self) -> None:
        """If k missing values can only go in the same k open cells, those cells hold exactly
        those values, so their other candidates go (a hidden pair, triple, ...).

        Subsets up to half the open cells suffice: a larger hidden subset is the complement
        of a smaller naked one, which searchForNakedSubsets finds."""
        found = True
        while found:
            found = False
            openCells = self.openCells()
            placed = set(placedValues(self.group.getCells()))
            missing = sorted(set(self.group.getValues()) - placed)
            cellsFor = {v: {c for c in openCells if v in c.getPossibleValues()} for v in missing}
            for size in range(2, len(openCells) // 2 + 1):
                candidates = [v for v in missing if len(cellsFor[v]) <= size]
                for subset in combinations(candidates, size):
                    cells: set[Cell] = set().union(*(cellsFor[v] for v in subset))
                    if len(cells) < size:
                        raise ContradictionError(
                            f"{self.group.getName()}: {formatValues(subset)} fit in only"
                            f" {len(cells)} cells"
                        )
                    if len(cells) > size:
                        continue
                    values = set(subset)
                    if all(c.getPossibleValues() <= values for c in cells):
                        continue
                    others = set().union(*(c.getPossibleValues() for c in cells)) - values
                    names = "; ".join(c.getName() for c in sorted(cells, key=openCells.index))
                    reason = (
                        f"{self.group.getName()}: {formatValues(values)} can only go in"
                        f" {names}, so those cells cannot hold anything else"
                        f" ({self.summary()})"
                    )
                    self.removeWithReason(cells, others, reason)
                    found = True
                    break
                if found:
                    break

    def getType(self) -> str:
        return "Exact cover constraint"

    def summary(self) -> str:
        return "each value once"

    def explain(self, deduction: Deduction) -> str:
        reason = self.subsetReason(deduction)
        if reason is not None:
            return reason
        return super().explain(deduction)

    def describe(self, showHints: bool = True) -> str:
        missing = set(self.group.getValues()) - set(placedValues(self.group.getCells()))
        if not missing:
            return "Every value appears exactly once; complete."
        return f"Every value appears exactly once; still missing: {formatValues(missing)}."

    def __str__(self) -> str:
        return "ecc[" + ",".join([str(x) for x in self.values]) + "]"
