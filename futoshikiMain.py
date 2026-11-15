"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

import os
import sys

from PySide6 import QtWidgets

from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.windows.basicmainwindow import BasicMainWindow
from solver.Solver import Solver
from structure.cell import PositionedCell
from utility.puzzlefactory import PuzzleFactory


class MainWindow(BasicMainWindow):
    def createMenus(self):
        f = self.menuBar().addMenu("File")
        openFutoshiki = f.addAction("Open Futoshiki")
        openFutoshiki.triggered.connect(self.openFutoshiki)

    def openFutoshiki(self):
        fileName = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open Futoshiki", "", "Futoshiki Files (*.txt *.fut)"
        )
        if fileName[0]:
            self.loadPuzzle(fileName[0])

    def initializePuzzleRepresentation(self):
        self.scene = QtWidgets.QGraphicsScene(self)

        #        self.view.setScene(self.scene)
        self.puzzlePieces = {}

        self.cellSize = 55
        # self.blockPadding = 3

        self.selectedItems = set()

        for c in self.puzzle.grid.getCells():
            if isinstance(c, PositionedCell):
                rect = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellSize)
                self.scene.addItem(rect)
                c.valueChanged.connect(self.cellValueChanged)
                c.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
                self.puzzlePieces[c] = rect
                proxy = PuzzlePieceProxy(rect)
                self.puzzlePieceProxies[c] = proxy

    def parsePuzzle(self, filename):
        puzzle = PuzzleFactory.fromFutoshikiFile(filename)
        solver = Solver(puzzle)
        return puzzle, solver


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadPuzzle(os.path.join(os.path.dirname(os.path.abspath(__file__)), "futoshiki.txt"))
    mainWin.show()
    sys.exit(app.exec())
