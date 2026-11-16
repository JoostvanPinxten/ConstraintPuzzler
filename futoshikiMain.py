"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

import sys

from PySide6 import QtWidgets

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from gui.puzzlerepresentation.inequalitysign import InequalitySign
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.windows.basicmainwindow import BasicMainWindow
from structure.cell import PositionedCell
from utility.puzzletypes import FUTOSHIKI


class MainWindow(BasicMainWindow):
    puzzleType = FUTOSHIKI

    def initializePuzzleRepresentation(self):
        assert self.puzzle is not None
        self.newScene()
        self.cellSize = 55
        # room between the cells for the inequality signs
        self.cellGap = 22
        self.cellPitch = self.cellSize + self.cellGap

        for c in self.puzzle.grid.getCells():
            if isinstance(c, PositionedCell):
                piece = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellPitch)
                self.addCellPiece(c, piece)

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


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
