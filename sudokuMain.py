import sys
from math import floor

from PySide6 import QtCore, QtGui, QtWidgets

from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.windows.basicmainwindow import BasicMainWindow
from utility.puzzletypes import SUDOKU


class MainWindow(BasicMainWindow):
    puzzleType = SUDOKU

    def initializePuzzleRepresentation(self) -> None:
        assert self.puzzle is not None
        self.newScene()
        self.cellSize = 55
        self.blockPadding = 3

        for x in range(0, 9):
            for y in range(0, 9):
                c = self.puzzle.grid.getCellFromSquareGrid(x, y)
                # leave room between the 3x3 blocks for the block lines
                offset_x = self.cellSize * x + floor(x / 3) * self.blockPadding
                offset_y = self.cellSize * y + floor(y / 3) * self.blockPadding
                piece = ValueRectangle(c, self.cellSize, QtCore.QPoint(offset_x, offset_y))
                self.addCellPiece(c, piece)

        # draw some lines, to indicate the blocks
        for x in range(0, 4):
            r = self.scene.addRect(
                3 * self.cellSize * x + (x - 1) * self.blockPadding,
                -self.blockPadding,
                self.blockPadding,
                9 * self.cellSize + 4 * self.blockPadding,
            )
            r.setBrush(QtGui.QColor(0, 0, 0))
        for y in range(0, 4):
            r = self.scene.addRect(
                -self.blockPadding,
                3 * self.cellSize * y + (y - 1) * self.blockPadding,
                9 * self.cellSize + 4 * self.blockPadding,
                self.blockPadding,
            )
            r.setBrush(QtGui.QColor(0, 0, 0))


if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
