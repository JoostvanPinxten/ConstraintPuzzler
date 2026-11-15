"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

import sys

from PySide6 import QtWidgets

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from gui.puzzlerepresentation.inequalitysign import InequalitySign
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.windows.basicmainwindow import BasicMainWindow
from solver.Solver import Solver
from structure.cell import PositionedCell
from utility.puzzlefactory import PuzzleFactory


class MainWindow(BasicMainWindow):
    puzzleTypeName = "Futoshiki"
    fileFilter = "Futoshiki Files (*.txt *.fut)"
    examples = {"7x7": "futoshiki.txt"}
    defaultExample = "7x7"

    def initializePuzzleRepresentation(self):
        assert self.puzzle is not None
        self.scene = QtWidgets.QGraphicsScene(self)

        #        self.view.setScene(self.scene)
        self.puzzlePieces = {}

        self.cellSize = 55
        # room between the cells for the inequality signs
        self.cellGap = 22
        self.cellPitch = self.cellSize + self.cellGap

        self.selectedItems = set()

        for c in self.puzzle.grid.getCells():
            if isinstance(c, PositionedCell):
                rect = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellPitch)
                self.scene.addItem(rect)
                c.valueChanged.connect(self.cellValueChanged)
                c.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
                self.puzzlePieces[c] = rect
                proxy = PuzzlePieceProxy(rect)
                self.puzzlePieceProxies[c] = proxy

        self.inequalitySigns = {}
        for constraint in self.puzzle.getConstraints():
            if isinstance(constraint, CellGreaterThanCellConstraint):
                sign = InequalitySign(
                    self.cellCenter(constraint.greaterCell),
                    self.cellCenter(constraint.lesserCell),
                    depth=self.cellGap * 0.45,
                    width=self.cellGap * 0.8,
                )
                self.scene.addItem(sign)
                self.inequalitySigns[constraint] = sign

    def cellCenter(self, cell):
        rect = self.puzzlePieces[cell].rect()
        return rect.center()

    def parsePuzzle(self, filename):
        puzzle = PuzzleFactory.fromFutoshikiFile(filename)
        solver = Solver(puzzle)
        return puzzle, solver


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
