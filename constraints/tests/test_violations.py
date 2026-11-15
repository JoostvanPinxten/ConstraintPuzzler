"""Constraint.violations(): which cells break a rule, given the values shown in the cells."""

import unittest

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.exactcoverconstraint import ExactCoverConstraint
from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from constraints.uniquevalueconstraint import UniqueValueConstraint
from structure.puzzle import Puzzle


def puzzleWith(constraintTypes, cellCount, values=range(1, 10)):
    puzzle = Puzzle("test", set(values))
    group = puzzle.addConstraintGroup("Group")
    constraints = [group.addConstraint(t) for t in constraintTypes]
    cells = [puzzle.grid.addCell() for _ in range(cellCount)]
    for cell in cells:
        group.addCell(cell)
    return cells, constraints


class ViolationsTest(unittest.TestCase):
    def testDuplicateValues(self):
        for constraintType in (UniqueValueConstraint, ExactCoverConstraint):
            cells, (constraint,) = puzzleWith([constraintType], 4)
            shown = {cells[0]: 3, cells[1]: 5, cells[2]: 3}
            self.assertEqual(constraint.violations(shown.get), {cells[0], cells[2]})
            shown[cells[2]] = 4
            self.assertEqual(constraint.violations(shown.get), set())

    def testSum(self):
        cells, (constraint,) = puzzleWith([TotalSumValueConstraint], 3)
        constraint.setTotalValue(10)
        shown = {cells[0]: 2, cells[1]: 3}
        self.assertEqual(constraint.violations(shown.get), set(), "not complete yet")
        shown[cells[2]] = 4
        self.assertEqual(constraint.violations(shown.get), set(cells), "complete, adds up to 9")
        shown[cells[2]] = 5
        self.assertEqual(constraint.violations(shown.get), set())
        # already too much before the group is complete
        shown = {cells[0]: 9, cells[1]: 8}
        self.assertEqual(constraint.violations(shown.get), {cells[0], cells[1]})

    def testGreaterThan(self):
        cells, (constraint,) = puzzleWith([CellGreaterThanCellConstraint], 2)
        constraint.setLesserCell(cells[0])
        constraint.setGreaterCell(cells[1])
        self.assertEqual(constraint.violations({cells[0]: 2}.get), set())
        self.assertEqual(constraint.violations({cells[0]: 2, cells[1]: 5}.get), set())
        self.assertEqual(constraint.violations({cells[0]: 5, cells[1]: 2}.get), set(cells))
        self.assertEqual(constraint.violations({cells[0]: 4, cells[1]: 4}.get), set(cells))


if __name__ == "__main__":
    unittest.main()
