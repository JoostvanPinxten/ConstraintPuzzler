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
from gui.puzzlemodel.puzzletreemodel import *
from structure.puzzle import Puzzle
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from solver.Solver import Solver
from gui.windows.basicmainwindow import BasicMainWindow
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy

from utility.puzzlefactory import PuzzleFactory

class MainWindow(BasicMainWindow):
   
    def createMenus(self):
        f = self.menuBar().addMenu("File")
        openSudoku = f.addAction("Open Sudoku")
        openSudoku.triggered.connect(self.openSudoku)
    
    def openSudoku(self):
        fileName = QtGui.QFileDialog.getOpenFileName(self,
    "Open Sudoku", "", "Sudoku Files (*.txt *.sud)")
        if fileName[0]:
            self.loadPuzzle(fileName[0])
    
    def initializePuzzleRepresentation(self):
        self.scene = QtGui.QGraphicsScene(self)
        
#        self.view.setScene(self.scene)
        self.puzzlePieces = {}
        
        self.cellSize = 55
        self.blockPadding = 3        
        
        self.selectedItems = set()
        
        for x in range(0,9):
            for y in range(0,9):

                c = self.puzzle.grid.getCellFromSquareGrid(x,y)
                c.valueChanged.connect(self.cellValueChanged)
                c.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
                
                # calculate the offset
                offset_x = self.cellSize*x + floor(x/3)*self.blockPadding
                offset_y = self.cellSize*y + floor(y/3)*self.blockPadding 
                
                r = ValueRectangle(c, self.cellSize, QtCore.QPoint(offset_x, offset_y))
                self.puzzlePieces[c] = r
                
                proxy = PuzzlePieceProxy(r)
                self.puzzlePieceProxies[c] = proxy
                self.scene.addItem(r)

        # draw some lines, to indicate the blocks
        for x in range(0,4):
            r = self.scene.addRect(3*self.cellSize*x + (x-1)*self.blockPadding, 
                                   -self.blockPadding, self.blockPadding, 
                                   9*self.cellSize + 4*self.blockPadding)
            r.setBrush(QtGui.QColor(0,0,0))
        for y in range(0,4):
            r = self.scene.addRect(-self.blockPadding, 3*self.cellSize*y + (y-1)*self.blockPadding, 
                                   9*self.cellSize + 4*self.blockPadding, 
                                   self.blockPadding)
            r.setBrush(QtGui.QColor(0,0,0))
                
    @staticmethod
    def parsePuzzle(filename):
        start = time()

        puzzle = PuzzleFactory.createEmptySudoku()
        # Set the initial data to work with
        myFile = open(filename)

        values = range(1,10)
        stringArray = myFile.readlines()
        y = 0
        for line in  stringArray:
            x = 0
            for el in line.split(' '):
                try:
                    if(int(el) in values):
                        puzzle.grid.setConstraintGridValue(x,y,int(el))
                except ValueError:
                    pass
                x += 1
            y += 1

        # And solve

        solver = Solver(puzzle)

        #print solver
        #grid.printAsSudoku()
        #print "Done in", int((time() - start) *1000), "ms"
        return puzzle, solver
        
if __name__ == '__main__':
    app = QtGui.QApplication(sys.argv)
    mainWin = MainWindow()
    #mainWin.loadPuzzle("./easySudoku.txt")
    mainWin.show()
    sys.exit(app.exec_())
