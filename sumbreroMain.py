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
from solver.Solver import Solver
from structure.cell import PositionedCell
from gui.windows.basicmainwindow import BasicMainWindow
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuehexagon import ValueHexagon

from utility.puzzlefactory import PuzzleFactory

class MainWindow(BasicMainWindow):

    def initializePuzzleRepresentation(self):
        self.scene = QtGui.QGraphicsScene(self)
        
#        self.view.setScene(self.scene)
        self.puzzlePieces = {}
        
        self.hexSide = 100
        #self.blockPadding = 3        
        
        self.selectedItems = set()
        
        
        for c in self.puzzle.getGrid().getCells():
            if( c.getPosition ):
                
                # see for an explanation of the rotated version (i.e. horizontal iso vertical): 
                # http://www.gamedev.net/page/resources/_/technical/game-programming/coordinates-in-hexagon-based-tile-maps-r1800
                tileR =  self.hexSide/2 * cos(pi/6)
                hexH =  self.hexSide/2 * sin(pi/6)
                #tileW = 2 * tileR 
                #tileH = self.hexSide/2 + 2 * hexH
                
                pos = c.getPosition()
                if( pos.x() % 2 ):
                    hexPos = QtCore.QPointF(
                                                pos.x() * (hexH + self.hexSide/2) ,
                                                pos.y() * 2 * tileR + tileR    
                                            )
                else:
                    hexPos = QtCore.QPointF(
                                                pos.x() * (hexH + self.hexSide/2) ,
                                                pos.y() * 2 * tileR
                                            )
                
                rect  = ValueHexagon(c, self.hexSide, hexPos)
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

                    if(cg.name.startswith('Column')):
                        cell = cg.getCells()[0]
                        pos = QtCore.QPoint(cell.position.x(), -1)
                    else:
                        pos = QtCore.QPoint(-1, cell.position.y())
                    
                    if( pos.x() % 2 ):
                        hexPos = QtCore.QPointF(
                                                    pos.x() * (hexH + self.hexSide/2) ,
                                                    pos.y() * 2 * tileR + tileR    
                                                )
                    else:
                        hexPos = QtCore.QPointF(
                                                    pos.x() * (hexH + self.hexSide/2) ,
                                                    pos.y() * 2 * tileR
                                                )
                    
                    hex = ValueHexagon(constraint, self.hexSide, hexPos, edgeColor=QtCore.Qt.transparent)
                    self.puzzlePieces[constraint] = hex
                    self.scene.addItem(hex)

    @staticmethod
    def parsePuzzle(filename):

        # Set the initial data to work with
        myFile = open("./simpleSumbrero.txt")


        values = range(1,10)
        stringArray = myFile.readlines()
        y = 0
        for line in stringArray:
            line = line.strip() # strip off whitespace
            
            if(line.startswith("range")):
                min, max = [int(x) for x in line[line.find("=")+1:].split(",")]
                puzzle = Puzzle("Test-sumbrero", range(min, max+1))
                
            if(line.startswith("cell")):
                x,y = [float(x) for x in line[line.find("(")+1:line.find(')')].split(",")]
                puzzle.getGrid().addCell(QtCore.QPoint(x,y))
            
            if(line.startswith("column")):
                column, value = line.split('=')
                column = int(column.split('(')[1].split(')')[0])
                
                # create a sum constraint
                cg = puzzle.addConstraintGroup("Column sum " + str(column))
                tsvc = cg.addConstraint(TotalSumValueConstraint)
                uvc = cg.addConstraint(UniqueValueConstraint)
                
                for cell in puzzle.grid.cells:
                    if(cell.position.x() == column):
                        cg.addCell(cell)

                tsvc.setTotalValue(int(value))
            # TODO: deal with the two different kinds of row sums
            
        solver = Solver(puzzle)

        return puzzle, solver
        
if __name__ == '__main__':

    app = QtGui.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadPuzzle("simpleSumbrero.txt")
    mainWin.show()
    sys.exit(app.exec_())
