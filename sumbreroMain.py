"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from math import cos, pi, sin

from PySide6 import QtCore, QtWidgets

from constraints import TotalSumValueConstraint, UniqueValueConstraint
from gui.puzzlerepresentation.cluehexagon import ClueHexagon
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuehexagon import ValueHexagon
from gui.windows.basicmainwindow import BasicMainWindow
from solver.Solver import Solver
from structure.position import Position
from structure.puzzle import Puzzle
from utility.puzzlefactory import PuzzleFactory, PuzzleFileError
from utility.resources import resourcePath

# Sumbrero cells are flat-topped hexagons, laid out in columns: Position(x, y) is column x,
# row y, and every odd column is shifted down by half a hexagon. A line of cells runs in one
# of three directions: straight down (a column), down-right (a descending row) or up-right
# (an ascending row). Rows are numbered by the row y at which they cross column 0.

COLUMN = "Column"
DESCENDING_ROW = "Descending row"
ASCENDING_ROW = "Ascending row"

# per kind of line: (direction towards its start, direction towards its end)
LINE_DIRECTIONS = {
    COLUMN: ("N", "S"),
    DESCENDING_ROW: ("NW", "SE"),
    ASCENDING_ROW: ("SW", "NE"),
}


def descendingRow(position: Position) -> int:
    """Index of the row running down-right (south-east) through position."""
    return position.y() - position.x() // 2


def ascendingRow(position: Position) -> int:
    """Index of the row running up-right (north-east) through position."""
    return position.y() + (position.x() + 1) // 2


def neighbour(position: Position, direction: str) -> Position:
    """The adjacent position in direction N, S, NE, SE, NW or SW."""
    x, y = position.x(), position.y()
    shift = x % 2  # odd columns are half a hexagon lower
    offsets = {
        "N": (0, -1),
        "S": (0, 1),
        "NE": (1, shift - 1),
        "SE": (1, shift),
        "NW": (-1, shift - 1),
        "SW": (-1, shift),
    }
    dx, dy = offsets[direction]
    return Position(x + dx, y + dy)


def lineKind(group):
    """COLUMN, DESCENDING_ROW or ASCENDING_ROW for a line created by parsePuzzle, else None."""
    kind = group.getName().rsplit(" ", 1)[0]
    return kind if kind in LINE_DIRECTIONS else None


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
    puzzleTypeName = "Sumbrero"
    fileFilter = "Sumbrero Files (*.txt)"

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
        self.scene = QtWidgets.QGraphicsScene(self)

        self.puzzlePieces = {}

        self.hexSide = 100

        self.selectedItems = set()

        for c in self.puzzle.getGrid().getCells():
            hexagon = ValueHexagon(c, self.hexSide, self.hexScenePosition(c.getPosition()))
            self.scene.addItem(hexagon)
            c.valueChanged.connect(self.cellValueChanged)
            c.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
            self.puzzlePieces[c] = hexagon
            proxy = PuzzlePieceProxy(hexagon)
            self.puzzlePieceProxies[c] = proxy

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

    @staticmethod
    def parsePuzzle(filename):
        """Reads a Sumbrero file; see doc/puzzle-files.md for the syntax.
        Raises PuzzleFileError (naming the line) when the file cannot be parsed."""
        with open(filename) as myFile:
            lines = myFile.readlines()

        # keyword -> (kind of line, index of the line through a position)
        lineStatements = {
            "column": (COLUMN, Position.x),
            "row_descending": (DESCENDING_ROW, descendingRow),
            "row_ascending": (ASCENDING_ROW, ascendingRow),
        }

        puzzle = None
        for lineNumber, rawLine in enumerate(lines, start=1):
            line = rawLine.strip()
            keyword = line.split("(")[0].split("=")[0].strip()
            if keyword not in ("range", "cell", *lineStatements):
                continue  # comments and blank lines

            try:
                if keyword == "range":
                    puzzle = Puzzle("Test-sumbrero", PuzzleFactory.parseRange(line.split("=")[1]))
                    continue

                if puzzle is None:
                    raise ValueError("'range = min,max' must come before cells and sums")

                if keyword == "cell":
                    position = PuzzleFactory.parsePosition(line[len("cell") :])
                    if any(c.getPosition() == position for c in puzzle.getGrid().getCells()):
                        raise ValueError(f"cell {position} is declared twice")
                    puzzle.getGrid().addCell(position)
                    continue

                # column(c) = n, row_descending(r) = n or row_ascending(r) = n
                lineText, separator, valueText = line[len(keyword) :].partition("=")
                if not separator:
                    raise ValueError(f"expected {keyword}(n) = value")
                kind, indexOf = lineStatements[keyword]
                index = PuzzleFactory.parseIndex(lineText)
                lineCells = [
                    c for c in puzzle.getGrid().getCells() if indexOf(c.getPosition()) == index
                ]
                if not lineCells:
                    raise ValueError(f"{kind.lower()} {index} contains no cells")

                cg = puzzle.addConstraintGroup(f"{kind} {index}")
                for c in lineCells:
                    cg.addCell(c)
                cg.addConstraint(UniqueValueConstraint)
                cg.addConstraint(TotalSumValueConstraint).setTotalValue(int(valueText))
            except PuzzleFileError:
                raise
            except Exception as e:
                raise PuzzleFileError(filename, lineNumber, f"{e} ({line})") from e

        if puzzle is None:
            raise PuzzleFileError(filename, len(lines), "no 'range = min,max' line found")

        solver = Solver(puzzle)

        return puzzle, solver


if __name__ == "__main__":
    import sys

    app = QtWidgets.QApplication(sys.argv)
    mainWin = MainWindow()
    mainWin.loadPuzzle(resourcePath("simpleSumbrero.txt"))
    mainWin.show()
    sys.exit(app.exec())
