"""
Created on 6 jan. 2013

@author: Juice
"""

import os
import tempfile
import unittest

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from constraints.uniquevalueconstraint import UniqueValueConstraint
from solver.Solver import Solver
from structure.errors import ContradictionError
from utility.puzzlefactory import PuzzleFactory

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Test(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def testNakedPair(self):
        sudoku = PuzzleFactory.createEmptySudoku()

        # initialize a grid that contains a naked pair
        sudoku.grid.setConstraintGridValue(3, 1, 7)
        sudoku.grid.setConstraintGridValue(4, 1, 4)

        sudoku.grid.setConstraintGridValue(6, 2, 7)
        sudoku.grid.setConstraintGridValue(7, 2, 4)

        sudoku.grid.setConstraintGridValue(0, 3, 7)
        sudoku.grid.setConstraintGridValue(0, 4, 4)

        # now the second and third cell must contain the possibleValues ([4,7]), as these are
        # the only two cells that can contain these values; they are also the only possibleValues

        c1_0 = sudoku.grid.getCellFromSquareGrid(1, 0)
        c2_0 = sudoku.grid.getCellFromSquareGrid(2, 0)

        solver = Solver(sudoku)
        solver.solve()

        self.assertEqual(
            c1_0.getPossibleValues(), set([4, 7]), "Did not correctly identify naked pair"
        )
        self.assertEqual(
            c2_0.getPossibleValues(), set([4, 7]), "Did not correctly identify naked pair"
        )

    def assertValidSudoku(self, sudoku):
        self.assertTrue(sudoku.isSolved(), "Not all cells are filled")
        for cg in sudoku.getConstraintGroups():
            values = sorted(c.getValue() for c in cg.getCells())
            self.assertEqual(
                values, list(range(1, 10)), cg.getName() + " is not a permutation of 1..9"
            )

    def testDeductionRepeatsUntilFixpoint(self):
        sudoku = PuzzleFactory.fromSudokuFile(os.path.join(ROOT, "easySudoku.txt"))
        solver = Solver(sudoku)

        self.assertTrue(solver.solve(), "A single solve() should keep deducing until done")
        self.assertValidSudoku(sudoku)

    def testHardSudokuNeedsGuessing(self):
        sudoku = PuzzleFactory.fromSudokuFile(os.path.join(ROOT, "hardSudoku.txt"))
        solver = Solver(sudoku)
        self.assertFalse(solver.solve(), "Expected deduction alone to get stuck on this puzzle")

        solver.allowGuessing = True
        self.assertTrue(solver.solve())
        self.assertValidSudoku(sudoku)

    def testDuplicateValueInRowRaises(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        sudoku.grid.setConstraintGridValue(0, 0, 1)
        with self.assertRaises(ContradictionError):
            sudoku.grid.setConstraintGridValue(5, 0, 1)

    def testCellWithoutOptionsRaises(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        # column 8 already has a 9, so filling 1..8 in row 0 leaves (8,0) without options
        sudoku.grid.setConstraintGridValue(8, 5, 9)
        with self.assertRaises(ContradictionError):
            for x in range(0, 8):
                sudoku.grid.setConstraintGridValue(x, 0, x + 1)

    def testSudokuFileWithZerosForEmptyCells(self):
        with open(os.path.join(ROOT, "easySudoku.txt")) as f:
            dashes = f.read()
        with tempfile.TemporaryDirectory() as tmp:
            zerosFile = os.path.join(tmp, "zeros.txt")
            with open(zerosFile, "w") as f:
                f.write(dashes.replace("-", "0"))

            withZeros = PuzzleFactory.fromSudokuFile(zerosFile)
        withDashes = PuzzleFactory.fromSudokuFile(os.path.join(ROOT, "easySudoku.txt"))

        self.assertEqual(withZeros.saveState(), withDashes.saveState())

    def testFailedSolveRestoresPuzzle(self):
        # two different values from {1,2,3} can add up to at most 5, so 6 is impossible
        puzzle = PuzzleFactory.createSingleConstraintPuzzle({1, 2, 3}, 2, UniqueValueConstraint)
        tsvc = puzzle.getConstraintGroups()[0].addConstraint(TotalSumValueConstraint)
        tsvc.setTotalValue(6)
        before = puzzle.saveState()

        with self.assertRaises(ContradictionError):
            Solver(puzzle).solve()

        self.assertEqual(
            puzzle.saveState(), before, "A failed solve must not leave a half-updated puzzle"
        )

    def testFutoshikiFile(self):
        puzzle = PuzzleFactory.fromFutoshikiFile(os.path.join(ROOT, "futoshiki.txt"))
        self.assertEqual(len(puzzle.grid.getCells()), 49)
        self.assertEqual(puzzle.grid.getCellFromSquareGrid(0, 0).getValue(), 5)
        self.assertEqual(puzzle.grid.getCellFromSquareGrid(6, 0).getValue(), 6)

        relations = [
            c for c in puzzle.getConstraints() if isinstance(c, CellGreaterThanCellConstraint)
        ]
        self.assertEqual(len(relations), 24)
        # first relation in the file: 2,1>3,1
        self.assertIs(relations[0].greaterCell, puzzle.grid.getCellFromSquareGrid(1, 0))
        self.assertIs(relations[0].lesserCell, puzzle.grid.getCellFromSquareGrid(2, 0))

        self.assertTrue(Solver(puzzle).solve())
        for relation in relations:
            self.assertGreater(relation.greaterCell.getValue(), relation.lesserCell.getValue())

    def testSaveAndRestoreState(self):
        sudoku = PuzzleFactory.fromSudokuFile(os.path.join(ROOT, "easySudoku.txt"))
        state = sudoku.saveState()
        Solver(sudoku).solve()
        self.assertNotEqual(sudoku.saveState(), state)

        sudoku.restoreState(state)
        self.assertEqual(sudoku.saveState(), state)


if __name__ == "__main__":
    # import sys;sys.argv = ['', 'Test.testName']
    unittest.main()
