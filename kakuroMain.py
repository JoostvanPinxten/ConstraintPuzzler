"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from PySide6 import QtCore, QtWidgets

from constraints import TotalSumValueConstraint
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.puzzlerepresentation.valuetriangle import ValueTriangle
from gui.windows.basicmainwindow import BasicMainWindow
from parsers import parseKakuroFile


class MainWindow(BasicMainWindow):
    puzzleTypeName = "Kakuro"
    puzzleParser = staticmethod(parseKakuroFile)
    fileFilter = "Kakuro Files (*.txt)"
    examples = {"Simple": "simpleKakuro.txt", "Medium": "mediumKakuro.txt"}
    defaultExample = "Medium"

    def initializePuzzleRepresentation(self):
        self.scene = QtWidgets.QGraphicsScene(self)

        #        self.view.setScene(self.scene)
        self.puzzlePieces = {}

        self.cellSize = 55
        # self.blockPadding = 3

        self.selectedItems = set()

        for c in self.puzzle.getGrid().getCells():
            if c.getPosition:
                rect = ValueRectangle(c, self.cellSize, c.getPosition() * self.cellSize)
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
                    cell1 = cg.getCells()[0]
                    cell2 = cg.getCells()[1]

                    pos1 = cell1.getPosition()
                    pos2 = cell2.getPosition()

                    if pos1.x() == pos2.x():
                        x = pos1.x()
                        y = pos1.y() - 1
                        alignment = ValueTriangle.BOTTOMLEFT
                        #
                    else:
                        x = pos1.x() - 1
                        y = pos1.y()
                        alignment = ValueTriangle.TOPRIGHT
                    pos = QtCore.QPoint(x, y)

                    triangle = ValueTriangle(constraint, self.cellSize, pos, alignment)
                    self.puzzlePieces[constraint] = triangle
                    self.scene.addItem(triangle)


if __name__ == "__main__":
    import sys

    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
