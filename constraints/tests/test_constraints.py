import unittest

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from constraints.uniquevalueconstraint import UniqueValueConstraint
from structure.errors import ContradictionError
from utility.puzzlefactory import PuzzleFactory


class Test(unittest.TestCase):
    def testSimpleUVC(self):
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(set([1, 2]), 2, UniqueValueConstraint)

        cells = puzzle.grid.getCells()
        cells[0].setValue(1)

        self.assertEqual(cells[1].getPossibleValues(), set([2]), "Incorrect exclusion of value")

    def testSimpleTSVC(self):
        """Test the basic properties of the total sum value constraint"""
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(set([1, 2]), 2, TotalSumValueConstraint)

        for cg in puzzle.getConstraintGroups():
            for constraint in cg.getConstraints():
                assert isinstance(constraint, TotalSumValueConstraint)
                constraint.setTotalValue(3)
                constraint.applyConstraint()

        possibleValues = puzzle.grid.getCells()[1].getPossibleValues()
        self.assertTrue(1 in possibleValues, "Incorrectly removed value from constraint")
        self.assertTrue(2 in possibleValues, "Incorrectly removed value from constraint")

        puzzle.grid.getCells()[0].setValue(1)
        for cg in puzzle.getConstraintGroups():
            for constraint in cg.getConstraints():
                constraint.applyConstraint()
        possibleValues = puzzle.grid.getCells()[1].getPossibleValues()

        self.assertTrue(1 not in possibleValues, "Incorrectly kept value from constraint")
        self.assertTrue(2 in possibleValues, "Incorrectly removed value from constraint")

    def testUVCWithSudoku(self):
        sudoku = PuzzleFactory.createEmptySudoku()

        # fill the first 8 cells of the top row with 1..8; the last one must become 9
        for x in range(0, 8):
            sudoku.grid.setConstraintGridValue(x, 0, x + 1)

        lastCell = sudoku.grid.getCellFromSquareGrid(8, 0)
        self.assertFalse(lastCell.hasValue(), "Test setup must leave the last cell open")
        possibleValues = lastCell.getPossibleValues()

        self.assertEqual(possibleValues, set([9]), "Exact cover failed to identify single value")

    def testTSVCRemovesAllDisallowedValues(self):
        """Adjacent disallowed values must all be removed (regression: remove-while-iterating)"""
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(
            set(range(1, 10)), 2, UniqueValueConstraint
        )
        cg = puzzle.getConstraintGroups()[0]
        tsvc = cg.addConstraint(TotalSumValueConstraint)
        tsvc.setTotalValue(4)  # only 1+3 is possible
        tsvc.applyConstraint()

        for cell in puzzle.grid.getCells():
            self.assertEqual(cell.getPossibleValues(), {1, 3})
        self.assertEqual(set(tsvc.values), {1, 3})

    def testGreaterThanNarrowsBothCells(self):
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(
            {1, 2, 3}, 2, CellGreaterThanCellConstraint
        )
        constraint = puzzle.getConstraintGroups()[0].getConstraints()[0]
        assert isinstance(constraint, CellGreaterThanCellConstraint)
        lesser, greater = puzzle.grid.getCells()
        constraint.setLesserCell(lesser)
        constraint.setGreaterCell(greater)

        constraint.applyConstraint()

        self.assertEqual(lesser.getPossibleValues(), {1, 2})
        self.assertEqual(greater.getPossibleValues(), {2, 3})

    def testGreaterThanFollowsSetValue(self):
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(
            {1, 2, 3, 4}, 2, CellGreaterThanCellConstraint
        )
        constraint = puzzle.getConstraintGroups()[0].getConstraints()[0]
        assert isinstance(constraint, CellGreaterThanCellConstraint)
        lesser, greater = puzzle.grid.getCells()
        constraint.setLesserCell(lesser)
        constraint.setGreaterCell(greater)

        greater.setValue(3)
        constraint.applyConstraint()

        self.assertEqual(lesser.getPossibleValues(), {1, 2})

    def testRemovingLastValueIsAContradiction(self):
        puzzle = PuzzleFactory.createSingleConstraintPuzzle({1, 2}, 1, UniqueValueConstraint)
        cell = puzzle.grid.getCells()[0]
        cell.remove(1)
        self.assertEqual(cell.getPossibleValues(), {2})
        with self.assertRaises(ContradictionError):
            cell.remove(2)

    def testTSVCWithKakuro(self):
        PuzzleFactory.createExampleKakuro()


if __name__ == "__main__":
    # import sys;sys.argv = ['', 'Test.testName']
    unittest.main()
