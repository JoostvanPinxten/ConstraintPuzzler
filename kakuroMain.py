"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from PySide6 import QtCore, QtWidgets

from constraints import TotalSumValueConstraint
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.puzzlerepresentation.valuetriangle import ValueTriangle
from gui.windows.basicmainwindow import BasicMainWindow
from parsers.kakuro import clueAnchor
from structure.cell import PositionedCell
from utility.puzzletypes import KAKURO


class MainWindow(BasicMainWindow):
    puzzleType = KAKURO

    def initializePuzzleRepresentation(self) -> None:
        assert self.puzzle is not None
        self.newScene()
        self.cellSize = 55

        for c in self.puzzle.getGrid().getCells():
            if isinstance(c, PositionedCell):
                piece = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellSize)
                self.addCellPiece(c, piece)

        # the sum of a line goes in a triangle of the black square just before the line
        for cg in self.puzzle.getConstraintGroups():
            for constraint in cg.getConstraints():
                if isinstance(constraint, TotalSumValueConstraint) and cg.getCells():
                    anchor, direction = clueAnchor(cg.getPositionedCells())
                    alignment = (
                        ValueTriangle.BOTTOMLEFT if direction == "down" else ValueTriangle.TOPRIGHT
                    )
                    position = QtCore.QPoint(anchor.x(), anchor.y())
                    triangle = ValueTriangle(constraint, self.cellSize, position, alignment)
                    self.puzzlePieces[constraint] = triangle
                    self.scene.addItem(triangle)


if __name__ == "__main__":
    import sys

    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
