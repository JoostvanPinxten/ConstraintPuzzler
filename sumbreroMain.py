"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from math import cos, pi, sin

from PySide6 import QtCore, QtWidgets

from constraints import TotalSumValueConstraint
from gui.puzzlerepresentation.cluehexagon import ClueHexagon
from gui.puzzlerepresentation.valuehexagon import ValueHexagon
from gui.windows.basicmainwindow import BasicMainWindow
from parsers.sumbrero import LINE_DIRECTIONS, lineKind, neighbour
from utility.puzzletypes import SUMBRERO


def clueLayout(puzzle):
    """Where the sum of every line is drawn, keyed by its TotalSumValueConstraint: as
    (position, direction), the black hexagon just before the first cell of the line and the
    wedge of that hexagon that faces along the line (S, SE or NE). That hexagon is never a cell
    (it would be on the line), and different lines never share a wedge."""
    layout = {}
    for group in puzzle.getConstraintGroups():
        kind = lineKind(group)
        if kind is None or not group.getCells():
            continue
        backward, forward = LINE_DIRECTIONS[kind]
        first = min((cell.getPosition() for cell in group.getCells()), key=lambda p: (p.x(), p.y()))
        for constraint in group.getConstraints():
            if isinstance(constraint, TotalSumValueConstraint):
                layout[constraint] = (neighbour(first, backward), forward)
    return layout


def framePositions(puzzle):
    """The positions of the black hexagons around the grid: every position next to a cell that
    is not a cell itself (this includes every position that holds a clue)."""
    cells = {cell.getPosition() for cell in puzzle.getGrid().getCells()}
    return {
        neighbour(position, direction)
        for position in cells
        for direction in ("N", "S", "NE", "SE", "NW", "SW")
    } - cells


class MainWindow(BasicMainWindow):
    puzzleType = SUMBRERO

    def hexScenePosition(self, position):
        """Scene coordinates of the hexagon at position"""
        # see for an explanation of the rotated version (i.e. horizontal iso vertical):
        # http://www.gamedev.net/page/resources/_/technical/game-programming/coordinates-in-hexagon-based-tile-maps-r1800
        tileR = self.hexSide / 2 * cos(pi / 6)
        hexH = self.hexSide / 2 * sin(pi / 6)
        x = position.x() * (hexH + self.hexSide / 2)
        y = position.y() * 2 * tileR + (tileR if position.x() % 2 else 0)
        return QtCore.QPointF(x, y)

    def initializePuzzleRepresentation(self):
        self.newScene()
        self.hexSide = 100

        for c in self.puzzle.getGrid().getCells():
            hexagon = ValueHexagon(c, self.hexSide, self.hexScenePosition(c.getPosition()))
            self.addCellPiece(c, hexagon)

        # black hexagons around the grid; the sum of a line goes in a wedge of the hexagon just
        # before the line's first cell, like the clue squares of a Kakuro
        cluesPerPosition = {}
        for constraint, (position, direction) in clueLayout(self.puzzle).items():
            cluesPerPosition.setdefault(position, {})[direction] = constraint

        self.clueHexagons = {}
        for position in sorted(framePositions(self.puzzle), key=lambda p: (p.x(), p.y())):
            clues = cluesPerPosition.get(position, {})
            hexagon = ClueHexagon(self.hexSide, self.hexScenePosition(position), clues)
            self.scene.addItem(hexagon)
            self.clueHexagons[position] = hexagon
            for constraint in clues.values():
                self.puzzlePieces[constraint] = hexagon


if __name__ == "__main__":
    import sys

    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
