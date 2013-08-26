'''
Created on 5 jan. 2013

@author: Juice
'''
from constraints import Constraint
from structure.puzzle import Puzzle
from constraints.uniquevalueconstraint import UniqueValueConstraint

from math import *
from PySide import QtCore
from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from constraints.exactcoverconstraint import ExactCoverConstraint


class PuzzleFactory(object):
    
    def __init__(self):
        pass
    
    @staticmethod
    def createEmptySudoku():
        values = set(range(1,10))
        
        blocks = []
        rows = []
        columns = []
        
        sudoku = Puzzle("Sudoku", values)
        grid = sudoku.getGrid()
        
        for i in range(0,9):
            cg = sudoku.addConstraintGroup("Block " + str(i+1))
            cg.addConstraint(ExactCoverConstraint)
            blocks.append(cg)
        
            cg = sudoku.addConstraintGroup("Row " + str(i+1))
            cg.addConstraint(ExactCoverConstraint)
            rows.append(cg)
        
            cg = sudoku.addConstraintGroup("Column " + str(i+1))
            cg.addConstraint(ExactCoverConstraint)
            columns.append(cg)
            
        # Initialize data structures (sudoku)
        for i in range(0,81):
            x = i% 9
            y = int(floor(i/9))
            block = int(floor(x/3) + 3*floor(y/3))
            #print x,y, block
            
            cell = grid.addCell(QtCore.QPoint(x+1,y+1))
            # add to relevant block
            cell.addConstraintGroup(blocks[block])
            # add to relevant row
            cell.addConstraintGroup(rows[y])
            # add to relevant column
            cell.addConstraintGroup(columns[x])
            
        return sudoku
    
    @staticmethod
    def createVerySimpleKakuro():
        possibleValues = range(1,10)
        puzzle = Puzzle("Very simple example Kakuro", set(possibleValues))
        
        c1_1 = puzzle.grid.addCell(QtCore.QPoint(1,1))
        c1_2 = puzzle.grid.addCell(QtCore.QPoint(1,2))
        c2_1 = puzzle.grid.addCell(QtCore.QPoint(2,1))
        c2_2 = puzzle.grid.addCell(QtCore.QPoint(2,2))
         
        cg = puzzle.addConstraintGroup("Group 1")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(4)
        
        cg.addCell(c1_1)
        cg.addCell(c1_2)

        cg = puzzle.addConstraintGroup("Group 2")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(4)

        cg.addCell(c1_1)
        cg.addCell(c2_1)
        
        cg = puzzle.addConstraintGroup("Group 3")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(3)

        cg.addCell(c2_1)
        cg.addCell(c2_2)
        
        cg = puzzle.addConstraintGroup("Group 4")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(3)
        
        cg.addCell(c1_2)
        cg.addCell(c2_2)
        
        return puzzle
    
    @staticmethod
    def createExampleKakuro():
        possibleValues = range(1,11)
        puzzle = Puzzle("Very simple example Kakuro", set(possibleValues))
        
        c1_1 = puzzle.grid.addCell(QtCore.QPoint(1,1))
        c1_2 = puzzle.grid.addCell(QtCore.QPoint(1,2))
        c2_1 = puzzle.grid.addCell(QtCore.QPoint(2,1))
        c2_2 = puzzle.grid.addCell(QtCore.QPoint(2,2))
         
        cg = puzzle.addConstraintGroup("Group 1")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(12)
        
        cg.addCell(c1_1)
        cg.addCell(c1_2)

        cg = puzzle.addConstraintGroup("Group 2")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(19)

        cg.addCell(c1_1)
        cg.addCell(c2_1)
        
        cg = puzzle.addConstraintGroup("Group 3")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(10)

        cg.addCell(c2_1)
        cg.addCell(c2_2)
        
        cg = puzzle.addConstraintGroup("Group 4")
        cg.addConstraint(UniqueValueConstraint)
        constraint = cg.addConstraint(TotalSumValueConstraint)
        constraint.setTotalValue(3)
        
        cg.addCell(c1_2)
        cg.addCell(c2_2)
        
        return puzzle

    
    @staticmethod
    def createSingleConstraintPuzzle(possibleValues, numberOfCells, constraintType):
        puzzle = Puzzle(str(numberOfCells) + "Cell test puzzle with single constraint type", set(possibleValues)) 
        cg = puzzle.addConstraintGroup("Group")
        constraint = cg.addConstraint(constraintType)
        
        for i in range(0,numberOfCells):
            cell = puzzle.grid.addCell()
            cg.addCell(cell)
        
        return puzzle

    @staticmethod
    def createFutoshikiPuzzle(size):
        puzzle = Puzzle(str(size) + "x"+str(size)+" Futoshiki test puzzle", set(range(1, size+1)))
        
        # create the grid
        for y in range(1, size + 1):
            for x in range(1, size + 1):
                puzzle.grid.addCell(QtCore.QPoint(x,y))
         
        # create the basic constraints
        for x in range(0, size):
            row = puzzle.addConstraintGroup("Row " + str(x))
            row.addConstraint(ExactCoverConstraint)
                        
            column = puzzle.addConstraintGroup("Column " + str(x))
            column.addConstraint(ExactCoverConstraint)

            for y in range(0, size):
                row.addCell(puzzle.grid.getCellFromSquareGrid(x, y))
                column.addCell(puzzle.grid.getCellFromSquareGrid(y, x))
        
        return puzzle
    
    
    
