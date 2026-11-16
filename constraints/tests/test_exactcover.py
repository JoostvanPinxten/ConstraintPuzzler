"""ExactCoverConstraint's deductions: single position, naked and hidden subsets."""

import unittest

from constraints.constraint import Constraint
from constraints.exactcoverconstraint import ExactCoverConstraint
from constraints.uniquevalueconstraint import UniqueValueConstraint
from structure.deduction import DeductionLog
from structure.errors import ContradictionError
from utility.puzzlefactory import PuzzleFactory


def exactCoverGroup(
    cellCount=4, constraintType: type[Constraint] = ExactCoverConstraint, values=None
):
    values = range(1, cellCount + 1) if values is None else values
    puzzle = PuzzleFactory.createSingleConstraintPuzzle(values, cellCount, constraintType)
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

    def testNakedTriple(self):
        # three cells only hold 1, 2 and 3 between them, so the others cannot
        cells, constraint = exactCoverGroup(6)
        for cell, keep in zip(cells[:3], ({1, 2}, {2, 3}, {1, 3}), strict=True):
            for value in {1, 2, 3, 4, 5, 6} - keep:
                cell.remove(value)
        constraint.applyConstraint()
        for cell in cells[3:]:
            self.assertEqual(cell.getPossibleValues(), {4, 5, 6})

    def testHiddenTriple(self):
        # 1, 2 and 3 only fit in the first three cells, so those cells hold nothing else
        cells, constraint = exactCoverGroup(6)
        for cell in cells[3:]:
            for value in (1, 2, 3):
                cell.remove(value)
        cells[0].remove(3)
        # (the naked triple 4, 5, 6 in the other cells is the same fact; test the hidden search)
        assert isinstance(constraint, ExactCoverConstraint)
        constraint.searchForHiddenSubsets()
        self.assertEqual(cells[0].getPossibleValues(), {1, 2})
        self.assertEqual(cells[1].getPossibleValues(), {1, 2, 3})
        self.assertEqual(cells[2].getPossibleValues(), {1, 2, 3})

    def testSubsetDeductionIsExplained(self):
        cells, constraint = exactCoverGroup()
        puzzle = constraint.group.puzzle
        for cell in cells[:2]:
            cell.remove(3)
            cell.remove(4)
        log = DeductionLog()
        with puzzle.recording(log), puzzle.causedBy(constraint):
            constraint.applyConstraint()
        reasons = {d.reason() for d in log.deductions if not d.setsValue()}
        self.assertTrue(reasons)
        for reason in reasons:
            self.assertIn("1, 2", reason)
            self.assertIn("between them", reason)

    def testTooFewCandidatesIsAContradiction(self):
        cells, constraint = exactCoverGroup()
        for cell in cells[:3]:
            for value in (3, 4):
                cell.remove(value)
        with self.assertRaises(ContradictionError):
            constraint.applyConstraint()

    def testNakedPairInAllDifferentGroup(self):
        # all different, more values than cells (like a Kakuro run): only naked subsets apply
        cells, constraint = exactCoverGroup(3, UniqueValueConstraint, range(1, 10))
        for cell in cells[:2]:
            for value in range(3, 10):
                cell.remove(value)
        constraint.applyConstraint()
        self.assertEqual(cells[2].getPossibleValues(), set(range(3, 10)))

    def testNoDeductionWhenNothingIsForced(self):
        cells, constraint = exactCoverGroup()
        constraint.applyConstraint()
        for cell in cells:
            self.assertEqual(cell.getPossibleValues(), {1, 2, 3, 4})


if __name__ == "__main__":
    unittest.main()
