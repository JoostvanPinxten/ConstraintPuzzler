"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from math import cos, pi, sin

from PySide6 import QtCore, QtWidgets

from constraints import TotalSumValueConstraint, UniqueValueConstraint
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuehexagon import ValueHexagon
from gui.windows.basicmainwindow import BasicMainWindow
from solver.Solver import Solver
from structure.position import Position
from structure.puzzle import Puzzle


def hexrow(position: Position, asc: bool = True):
    return position.y() + position.x() - position.x() % 2


class MainWindow(BasicMainWindow):
    def initializePuzzleRepresentation(self):
        self.scene = QtWidgets.QGraphicsScene(self)

        #        self.view.setScene(self.scene)
        self.puzzlePieces = {}

        self.hexSide = 100
        # self.blockPadding = 3

        self.selectedItems = set()

        for c in self.puzzle.getGrid().getCells():
            if c.getPosition:
                # see for an explanation of the rotated version (i.e. horizontal iso vertical):
                # http://www.gamedev.net/page/resources/_/technical/game-programming/coordinates-in-hexagon-based-tile-maps-r1800
                tileR = self.hexSide / 2 * cos(pi / 6)
                hexH = self.hexSide / 2 * sin(pi / 6)
                # tileW = 2 * tileR
                # tileH = self.hexSide/2 + 2 * hexH

                pos = c.getPosition()
                if pos.x() % 2:
                    hexPos = QtCore.QPointF(
                        pos.x() * (hexH + self.hexSide / 2), pos.y() * 2 * tileR + tileR
                    )
                else:
                    hexPos = QtCore.QPointF(
                        pos.x() * (hexH + self.hexSide / 2), pos.y() * 2 * tileR
                    )

                rect = ValueHexagon(c, self.hexSide, hexPos)
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

                    if cg.name.startswith("Column"):
                        cell = cg.getCells()[0]
                        pos = QtCore.QPoint(cell.position.x(), -1)
                    else:
                        pos = QtCore.QPoint(-1, cell.position.y())

                    if pos.x() % 2:
                        hexPos = QtCore.QPointF(
                            pos.x() * (hexH + self.hexSide / 2), pos.y() * 2 * tileR + tileR
                        )
                    else:
                        hexPos = QtCore.QPointF(
                            pos.x() * (hexH + self.hexSide / 2), pos.y() * 2 * tileR
                        )

                    hex = ValueHexagon(
                        constraint, self.hexSide, hexPos, edgeColor=QtCore.Qt.transparent
                    )
                    self.puzzlePieces[constraint] = hex
                    self.scene.addItem(hex)

    @staticmethod
    def parsePuzzle(filename):

        # Set the initial data to work with
        with open(filename) as myFile:
            stringArray = myFile.readlines()

        y = 0
        puzzle = None
        for line in stringArray:
            line = line.strip()  # strip off whitespace

            if line.startswith("range"):
                minimum, maximum = [int(x) for x in line[line.find("=") + 1 :].split(",")]
                puzzle = Puzzle("Test-sumbrero", range(minimum, maximum + 1))

            if line.startswith("cell"):
                x, y = [int(x) for x in line[line.find("(") + 1 : line.find(")")].split(",")]
                puzzle.getGrid().addCell(Position(x, y))

            if line.startswith("column"):
                column, value = line.split("=")
                column = int(column.split("(")[1].split(")")[0])

                # create a sum constraint
                cg = puzzle.addConstraintGroup("Column sum " + str(column))
                tsvc = cg.addConstraint(TotalSumValueConstraint)
                cg.addConstraint(UniqueValueConstraint)

                for cell in puzzle.grid.cells:
                    if cell.position.x() == column:
                        cg.addCell(cell)

                tsvc.setTotalValue(int(value))

            if line.startswith("row_ascending"):
                row, value = line.split("=")
                row = int(row.split("(")[1].split(")")[0])

                # create a sum constraint
                cg = puzzle.addConstraintGroup("Row ascending sum " + str(row))
                tsvc = cg.addConstraint(TotalSumValueConstraint)
                tsvc.setTotalValue(int(value))

                cg.addConstraint(UniqueValueConstraint)

                for cell in puzzle.grid.cells:
                    print(
                        hexrow(cell.position, asc=True) == row,
                        hexrow(cell.position),
                        row,
                    )
                    if hexrow(cell.position, asc=True) == row:
                        cg.addCell(cell)

            if line.startswith("row_descending"):
                row, value = line.split("=")
                row = int(row.split("(")[1].split(")")[0])

                # create a sum constraint
                cg = puzzle.addConstraintGroup("Row descending sum " + str(row))
                tsvc = cg.addConstraint(TotalSumValueConstraint)
                tsvc.setTotalValue(int(value))
                cg.addConstraint(UniqueValueConstraint)

                for cell in puzzle.grid.cells:
                    if hexrow(cell.position, asc=False) == row:
                        cg.addCell(cell)

        solver = Solver(puzzle)

        return puzzle, solver


if __name__ == "__main__":
    import os
    import sys

    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadPuzzle(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "simpleSumbrero.txt")
    )
    mainWin.show()
    sys.exit(app.exec())
