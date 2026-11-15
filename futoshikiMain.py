"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

import sys

from PySide6 import QtWidgets

from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.windows.basicmainwindow import BasicMainWindow
from solver.Solver import Solver
from structure.cell import PositionedCell
from utility.puzzlefactory import PuzzleFactory
from utility.resources import resourcePath


class MainWindow(BasicMainWindow):
    puzzleTypeName = "Futoshiki"
    fileFilter = "Futoshiki Files (*.txt *.fut)"

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
    mainWin.loadPuzzle(resourcePath("futoshiki.txt"))
    mainWin.show()
    sys.exit(app.exec())
