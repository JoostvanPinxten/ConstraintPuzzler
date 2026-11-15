"""The short summaries and the descriptions of constraints, as shown in the GUI."""

import unittest

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.exactcoverconstraint import ExactCoverConstraint
from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from constraints.uniquevalueconstraint import UniqueValueConstraint
from structure.position import Position
from structure.puzzle import Puzzle
from utility.puzzlefactory import PuzzleFactory


def singleConstraint(values, cellCount, constraintType):
    puzzle = PuzzleFactory.createSingleConstraintPuzzle(set(values), cellCount, constraintType)
    group = puzzle.getConstraintGroups()[0]
    return puzzle.grid.getCells(), group.getConstraints()[0]


class DescriptionTest(unittest.TestCase):
    def testUniqueValue(self):
        cells, constraint = singleConstraint(range(1, 4), 3, UniqueValueConstraint)
        self.assertEqual(constraint.summary(), "all different")
        self.assertIn("nothing is placed yet", constraint.describe())
        cells[0].setValue(3)
        cells[1].setValue(1)
        self.assertIn("placed so far: 1, 3", constraint.describe())

    def testExactCoverListsMissingValues(self):
        cells, constraint = singleConstraint(range(1, 5), 4, ExactCoverConstraint)
        self.assertEqual(constraint.summary(), "each value once")
        cells[0].setValue(2)
        self.assertIn("still missing: 1, 3, 4", constraint.describe())
        for cell, value in zip(cells[1:], (1, 3, 4), strict=True):
            cell.setValue(value)
        self.assertIn("complete", constraint.describe())

    def testTotalSumComputesCandidatesWithoutChangingState(self):
        puzzle = Puzzle("sum", set(range(1, 10)))
        group = puzzle.addConstraintGroup("Line")
        group.addConstraint(UniqueValueConstraint)
        constraint = group.addConstraint(TotalSumValueConstraint)
        cells = [puzzle.grid.addCell() for _ in range(2)]
        for cell in cells:
            group.addCell(cell)
        constraint.setTotalValue(16)
        state = puzzle.saveState()

        self.assertEqual(constraint.summary(), "sum = 16")
        description = constraint.describe()
        self.assertIn("16 over 2 open cells", description)
        self.assertIn("candidates: 7, 9", description)
        self.assertEqual(puzzle.saveState(), state, "describe() must not change the puzzle")

        cells[0].setValue(7)
        self.assertIn("7 is placed, so 9 is left for 1 open cell", constraint.describe())
        cells[1].setValue(9)
        self.assertIn("complete (7 + 9)", constraint.describe())

    def testTotalSumWithoutTotal(self):
        _cells, constraint = singleConstraint(range(1, 3), 2, TotalSumValueConstraint)
        self.assertIn("not been set", constraint.describe())

    def testGreaterThanNamesTheSmallerCellFirst(self):
        puzzle = Puzzle("gt", {1, 2, 3})
        lesser = puzzle.grid.addCell(Position(1, 1))
        greater = puzzle.grid.addCell(Position(2, 1))
        group = puzzle.addConstraintGroup("Relativity")
        constraint = group.addConstraint(CellGreaterThanCellConstraint)
        constraint.setLesserCell(lesser)
        constraint.setGreaterCell(greater)

        self.assertEqual(constraint.summary(), "(1, 1) < (2, 1)")
        self.assertIn("candidates 1, 2, 3 < 1, 2, 3", constraint.describe())
        lesser.setValue(1)
        greater.setValue(3)
        self.assertIn("satisfied: 1 < 3", constraint.describe())

    def testUnpositionedCellsHaveANumberAsName(self):
        cells, _constraint = singleConstraint(range(1, 3), 2, UniqueValueConstraint)
        self.assertEqual([c.getName() for c in cells], ["cell 1", "cell 2"])


if __name__ == "__main__":
    unittest.main()
