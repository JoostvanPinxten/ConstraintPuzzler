"""ExactCoverConstraint's deductions: single position and hidden pairs."""

import unittest

from constraints.exactcoverconstraint import ExactCoverConstraint
from utility.puzzlefactory import PuzzleFactory


def exactCoverGroup(cellCount=4):
    puzzle = PuzzleFactory.createSingleConstraintPuzzle(
        range(1, cellCount + 1), cellCount, ExactCoverConstraint
    )
    group = puzzle.getConstraintGroups()[0]
    return group.getCells(), group.getConstraints()[0]


class ExactCoverTest(unittest.TestCase):
    def testPlacedValueRemovedFromOthers(self):
        cells, _ = exactCoverGroup()
        cells[0].setValue(1)
        for cell in cells[1:]:
            self.assertNotIn(1, cell.getPossibleValues())

    def testSinglePosition(self):
        # 4 can only go in the last cell, so it is filled in
        cells, constraint = exactCoverGroup()
        for cell in cells[:3]:
            cell.remove(4)
        constraint.applyConstraint()
        self.assertEqual(cells[3].getValue(), 4)
        self.assertTrue(cells[3].isInferred())

    def testHiddenPair(self):
        # 3 and 4 can only go in the first two cells, so those cells cannot hold 1 or 2
        cells, constraint = exactCoverGroup()
        for cell in cells[2:]:
            cell.remove(3)
            cell.remove(4)
        constraint.applyConstraint()
        self.assertEqual(cells[0].getPossibleValues(), {3, 4})
        self.assertEqual(cells[1].getPossibleValues(), {3, 4})
        self.assertEqual(cells[2].getPossibleValues(), {1, 2})

    def testNoDeductionWhenNothingIsForced(self):
        cells, constraint = exactCoverGroup()
        constraint.applyConstraint()
        for cell in cells:
            self.assertEqual(cell.getPossibleValues(), {1, 2, 3, 4})


if __name__ == "__main__":
    unittest.main()
