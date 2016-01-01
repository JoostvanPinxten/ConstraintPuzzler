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
from gui.puzzlerepresentation.valuetriangle import ValueTriangle
from gui.windows.basicmainwindow import BasicMainWindow
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy


from utility.puzzlefactory import PuzzleFactory

class MainWindow(BasicMainWindow):

    def initializePuzzleRepresentation(self):
        self.scene = QtGui.QGraphicsScene(self)
        
#        self.view.setScene(self.scene)
        self.puzzlePieces = {}
        
        self.cellSize = 55
        #self.blockPadding = 3        
        
        self.selectedItems = set()
        
        for c in self.puzzle.getGrid().getCells():
            if( c.getPosition ):
                rect  = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellSize)
                self.scene.addItem(rect)
                c.valueChanged.connect(self.cellValueChanged)
                c.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
                self.puzzlePieces[c] = rect
                proxy = PuzzlePieceProxy(rect)
                self.puzzlePieceProxies[c] = proxy
        
        for cg in self.puzzle.getConstraintGroups():
            for constraint in cg.getConstraints():
                if isinstance(constraint, TotalSumValueConstraint):
                    # TODO: refactor to utililty class, make much more general
                    # find the position and direction that is most likely:
                    for cell in cg.getCells():
                        break
                    cell1 = cg.getCells()[0]
                    cell2 = cg.getCells()[1]
                    
                    pos1 = cell1.getPosition()
                    pos2 = cell2.getPosition()
                    
                    if(pos1.x() == pos2.x()):
                        x = pos1.x() 
                        y = pos1.y() - 1 
                        alignment = ValueTriangle.BOTTOMLEFT
                        #
                    else:
                        x = pos1.x() - 1
                        y = pos1.y()
                        alignment = ValueTriangle.TOPRIGHT  
                    pos = QtCore.QPoint(x,y)
                    
                    triangle = ValueTriangle(constraint, self.cellSize, pos, alignment)
                    self.puzzlePieces[constraint] = triangle
                    self.scene.addItem(triangle)
    @staticmethod
    def parsePuzzle(filename):
            
        start = time()
        #puzzle = PuzzleFactory.createExampleKakuro()

        # Set the initial data to work with
        myFile = open(filename)

        values = range(1,10)
        stringArray = myFile.readlines()
        y = 0
        for line in  stringArray:
            if(line.startswith("range")):
                min, max = [int(x) for x in line[line.find("=")+1:].split(",")]
                puzzle = Puzzle("Test-kakuro", range(min, max+1))
                
            if(line.startswith("cell")):
                x,y = [int(x) for x in line[line.find("(")+1:line.find(')')].split(",")]
                puzzle.getGrid().addCell(QtCore.QPoint(x,y))
                
            if(line.startswith("total")):
                value = int(line.split("=")[-1])
                cells = [cell[1:-1].split(",") for cell in line[line.find("(")+1:line.rfind(")")].split(";")]
                
                cg = puzzle.addConstraintGroup("Line")
                for cell in cells:
                    try:
                        c = puzzle.getGrid().searchCellWithPosition(QtCore.QPoint(int(cell[0]), int(cell[1])))
                    except ValueError:
                        print line
                    cg.addCell(c)
                
                uvc = cg.addConstraint(UniqueValueConstraint)
                tsvc = cg.addConstraint(TotalSumValueConstraint)
                
                tsvc.setTotalValue(value)
                
        solver = Solver(puzzle)

        return puzzle, solver

if __name__ == '__main__':

    app = QtGui.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadPuzzle("./mediumKakuro.txt")
    mainWin.show()
    sys.exit(app.exec_())
