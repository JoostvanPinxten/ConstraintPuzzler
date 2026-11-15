'''
Created on 5 jan. 2013

@author: Juice
'''
import unittest

from constraints.totalsumvalueconstraint import TotalSumValueConstraint

from utility.puzzlefactory import PuzzleFactory
from constraints.uniquevalueconstraint import UniqueValueConstraint

class Test(unittest.TestCase):

    
    def testSimpleUVC(self):
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(set([1,2]), 2, UniqueValueConstraint)
        
        cells = puzzle.grid.getCells()
        cells[0].setValue(1)

        self.assertEqual(cells[1].getPossibleValues(), set([2]), 
                         "Incorrect exclusion of value")
    
    def testSimpleTSVC(self):
        """Test the basic properties of the total sum value constraint"""
        puzzle = PuzzleFactory.createSingleConstraintPuzzle(set([1,2]), 2, TotalSumValueConstraint)
        
        for cg in puzzle.getConstraintGroups():
            for constraint in cg.getConstraints():
                constraint.setTotalValue(3);
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

        self.assertEqual(possibleValues, set([9]), 
                         "Exact cover failed to identify single value")

    def testTSVCWithKakuro(self):
        kakuro = PuzzleFactory.createExampleKakuro()

if __name__ == "__main__":
    #import sys;sys.argv = ['', 'Test.testName']
    unittest.main()