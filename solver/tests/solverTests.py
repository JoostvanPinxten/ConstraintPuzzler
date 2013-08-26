'''
Created on 6 jan. 2013

@author: Juice
'''
import unittest
from utility.puzzlefactory import PuzzleFactory
from solver.Solver import Solver


class Test(unittest.TestCase):


    def setUp(self):
        pass


    def tearDown(self):
        pass

    def testNakedPair(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        
        #initialize a grid that contains a naked pair 
        sudoku.grid.setConstraintGridValue(3,1,7)
        sudoku.grid.setConstraintGridValue(4,1,4)
        
        sudoku.grid.setConstraintGridValue(6,2,7)
        sudoku.grid.setConstraintGridValue(7,2,4)

        sudoku.grid.setConstraintGridValue(0,3,7)
        sudoku.grid.setConstraintGridValue(0,4,4)
    
        # now the second and third cell must contain the possibleValues ([4,7]) as these are the only 
        # two cells that can contain these values, they are also the only possibleValues 
        
        c1_0 = sudoku.grid.getCellFromSquareGrid(1,0)
        c2_0 = sudoku.grid.getCellFromSquareGrid(2,0)
        
        solver = Solver(sudoku)
        solver.solve()
        
        print sudoku.grid
        self.assertEqual(c1_0.getPossibleValues(), set([4,7]), "Did not correctly identify naked pair")
        self.assertEqual(c2_0.getPossibleValues(), set([4,7]), "Did not correctly identify naked pair")


if __name__ == "__main__":
    #import sys;sys.argv = ['', 'Test.testName']
    unittest.main()