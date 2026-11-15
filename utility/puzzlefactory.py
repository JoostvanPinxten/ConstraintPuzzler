"""
Created on 5 jan. 2013

@author: Juice
"""

from constraints import Constraint
from structure.puzzle import Puzzle
from constraints.uniquevalueconstraint import UniqueValueConstraint

from math import *
from structure.position import Position
from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from constraints.exactcoverconstraint import ExactCoverConstraint


class PuzzleFactory(object):
    def __init__(self):
        pass

    @staticmethod
    def createEmptySudoku():
        values = set(range(1, 10))

        blocks = []
        rows = []
        columns = []

        sudoku = Puzzle("Sudoku", values)
        grid = sudoku.getGrid()

        for i in range(0, 9):
            cg = sudoku.addConstraintGroup("Block " + str(i + 1))
            cg.addConstraint(ExactCoverConstraint)
            blocks.append(cg)

            cg = sudoku.addConstraintGroup("Row " + str(i + 1))
            cg.addConstraint(ExactCoverConstraint)
            rows.append(cg)

            cg = sudoku.addConstraintGroup("Column " + str(i + 1))
            cg.addConstraint(ExactCoverConstraint)
            columns.append(cg)

        # Initialize data structures (sudoku)
        for i in range(0, 81):
            x = i % 9
            y = int(floor(i / 9))
            block = int(floor(x / 3) + 3 * floor(y / 3))
            # print x,y, block

            cell = grid.addCell(Position(x + 1, y + 1))
            # add to relevant block
            cell.addConstraintGroup(blocks[block])
            # add to relevant row
            cell.addConstraintGroup(rows[y])
            # add to relevant column
            cell.addConstraintGroup(columns[x])

        return sudoku

    @staticmethod
    def fromSudokuFile(filename):
        """Reads a 9x9 sudoku: one row per line, values separated by spaces.
        Anything that is not one of the puzzle values (e.g. '-' or '0') is an empty cell."""
        sudoku = PuzzleFactory.createEmptySudoku()
        with open(filename) as f:
            PuzzleFactory.readGridValues(sudoku, f.readlines())
        return sudoku

    @staticmethod
    def fromFutoshikiFile(filename):
        """Reads a square futoshiki: the grid in the sudoku file format, followed by a
        'relativity' line and one 'x1,y1>x2,y2' line per inequality (1-based coordinates),
        meaning that cell (x1,y1) is greater than cell (x2,y2)."""
        with open(filename) as f:
            lines = [line.strip() for line in f]

        if "relativity" in lines:
            split = lines.index("relativity")
            gridLines, relationLines = lines[:split], lines[split + 1 :]
        else:
            gridLines, relationLines = lines, []
        gridLines = [line for line in gridLines if line]

        puzzle = PuzzleFactory.createFutoshikiPuzzle(len(gridLines))
        PuzzleFactory.readGridValues(puzzle, gridLines)

        for line in relationLines:
            if ">" not in line:
                continue
            greater, lesser = [[int(v) - 1 for v in cell.split(",")] for cell in line.split(">")]
            greaterCell = puzzle.grid.getCellFromSquareGrid(*greater)
            lesserCell = puzzle.grid.getCellFromSquareGrid(*lesser)

            cg = puzzle.addConstraintGroup("Relativity")
            constraint = cg.addConstraint(CellGreaterThanCellConstraint)
            cg.addCell(greaterCell)
            cg.addCell(lesserCell)
            constraint.setGreaterCell(greaterCell)
            constraint.setLesserCell(lesserCell)

        return puzzle

    @staticmethod
    def readGridValues(puzzle, lines):
        """Sets the givens of a square grid: one row per line, values separated by
        whitespace. Anything that is not one of the puzzle values is an empty cell."""
        values = puzzle.getValues()
        for y, line in enumerate(lines):
            for x, el in enumerate(line.split()):
                if el.isdigit() and int(el) in values:
                    puzzle.grid.setConstraintGridValue(x, y, int(el))

    @staticmethod
    def createVerySimpleKakuro():
        possibleValues = range(1, 10)
        puzzle = Puzzle("Very simple example Kakuro", set(possibleValues))

        c1_1 = puzzle.grid.addCell(Position(1, 1))
        c1_2 = puzzle.grid.addCell(Position(1, 2))
        c2_1 = puzzle.grid.addCell(Position(2, 1))
        c2_2 = puzzle.grid.addCell(Position(2, 2))

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
        possibleValues = range(1, 11)
        puzzle = Puzzle("Very simple example Kakuro", set(possibleValues))

        c1_1 = puzzle.grid.addCell(Position(1, 1))
        c1_2 = puzzle.grid.addCell(Position(1, 2))
        c2_1 = puzzle.grid.addCell(Position(2, 1))
        c2_2 = puzzle.grid.addCell(Position(2, 2))

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
        puzzle = Puzzle(
            str(numberOfCells) + "Cell test puzzle with single constraint type", set(possibleValues)
        )
        cg = puzzle.addConstraintGroup("Group")
        constraint = cg.addConstraint(constraintType)

        for i in range(0, numberOfCells):
            cell = puzzle.grid.addCell()
            cg.addCell(cell)

        return puzzle

    @staticmethod
    def createFutoshikiPuzzle(size):
        puzzle = Puzzle(
            str(size) + "x" + str(size) + " Futoshiki test puzzle", set(range(1, size + 1))
        )

        # create the grid
        for y in range(1, size + 1):
            for x in range(1, size + 1):
                puzzle.grid.addCell(Position(x, y))

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
