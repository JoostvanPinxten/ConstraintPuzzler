# -*- coding: utf-8 -*-
"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from PySide import QtGui, QtCore

from constraints import *
from structure import *

from time import *
from math import *

from constraints import *

from gui.puzzlemodel.puzzletreemodel import *

from gui.ui import mainWindowUi
from structure.puzzle import Puzzle
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from solver.Solver import Solver
from structure.cell import PositionedCell
from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from gui.windows.basicmainwindow import BasicMainWindow
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy

start = time()

from utility.puzzlefactory import PuzzleFactory

puzzle = PuzzleFactory.createFutoshikiPuzzle(7)
# Set the initial data to work with
myFile = open("./futoshiki.txt")

values = range(1,10)
stringArray = myFile.readlines()
y = 0
addingValues = True
for line in  stringArray:
    if line.startswith("relativity"):
        addingValues = False
        
    if addingValues:
        x = 0
        for el in line.split(' '):
            try:
                if(int(el) in values):
                    puzzle.grid.setConstraintGridValue(x,y,int(el))
            except ValueError:
                pass
            x += 1
        y += 1
    else:
        cellStrings = line.split(">")
        if len(cellStrings) == 2:
            c1, c2 = cellStrings
            x,y = c1.split(",")
            x = int(x)
            y = int(y)
            cell1 = puzzle.grid.getCellFromSquareGrid(x-1,y-1)
            
            x,y = c2.split(",")
            x = int(x)
            y = int(y)
            cell2 = puzzle.grid.getCellFromSquareGrid(x-1,y-1)
            
            cg = puzzle.addConstraintGroup("Relativity")
            constraint = cg.addConstraint(CellGreaterThanCellConstraint)
            
            cg.addCell(cell1)
            cg.addCell(cell2)
            
            constraint.setLesserCell(cell1)
            constraint.setGreaterCell(cell2)
            
            

# And solve

solver = Solver(puzzle)

#print solver
#grid.printAsSudoku()
print "Done in", int((time() - start) *1000), "ms"

class MainWindow(BasicMainWindow):
    
    def initializePuzzleRepresentation(self):
        self.scene = QtGui.QGraphicsScene(self)
        
#        self.view.setScene(self.scene)
        self.puzzlePieces = {}
        
        self.cellSize = 55
        #self.blockPadding = 3        
        
        self.selectedItems = set()
        
        
        for c in puzzle.grid.getCells():
            if( isinstance(c, PositionedCell)):
                rect  = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellSize)
                self.scene.addItem(rect)
                c.valueChanged.connect(self.cellValueChanged)
                c.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
                self.puzzlePieces[c] = rect
                proxy = PuzzlePieceProxy(rect)
                self.puzzlePieceProxies[c] = proxy

if __name__ == '__main__':

    app = QtGui.QApplication(sys.argv)
    mainWin = MainWindow(puzzle, solver)
    mainWin.show()
    sys.exit(app.exec_())
