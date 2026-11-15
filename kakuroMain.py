"""
Created on Sat Dec 22 22:25:33 2012

@author: Juice
"""

from PySide6 import QtCore, QtWidgets

from constraints import TotalSumValueConstraint, UniqueValueConstraint
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from gui.puzzlerepresentation.valuetriangle import ValueTriangle
from gui.windows.basicmainwindow import BasicMainWindow
from solver.Solver import Solver
from structure.puzzle import Puzzle
from utility.puzzlefactory import PuzzleFactory, PuzzleFileError


class MainWindow(BasicMainWindow):
    puzzleTypeName = "Kakuro"
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

    @staticmethod
    def parsePuzzle(filename):
        """Reads a Kakuro file; see doc/puzzle-files.md for the syntax.
        Raises PuzzleFileError (naming the line) when the file cannot be parsed."""
        with open(filename) as myFile:
            lines = myFile.readlines()

        puzzle = None
        cells = {}  # Position -> Cell, for the cells declared so far
        for lineNumber, rawLine in enumerate(lines, start=1):
            line = rawLine.strip()
            if not line.startswith(("range", "cell", "total")):
                continue  # comments and blank lines

            try:
                if line.startswith("range"):
                    puzzle = Puzzle("Test-kakuro", PuzzleFactory.parseRange(line.split("=")[1]))
                    continue

                if puzzle is None:
                    raise ValueError("'range = min,max' must come before cells and totals")

                if line.startswith("cell"):
                    position = PuzzleFactory.parsePosition(line[len("cell") :])
                    if position in cells:
                        raise ValueError(f"cell {position} is declared twice")
                    cells[position] = puzzle.getGrid().addCell(position)

                else:  # total((x,y);(x,y);...) = value
                    cellText, separator, valueText = line[len("total") :].rpartition("=")
                    cellText = cellText.strip()
                    if not separator or not (cellText.startswith("(") and cellText.endswith(")")):
                        raise ValueError("expected total((x,y);(x,y);...) = value")
                    positions = PuzzleFactory.parsePositionList(cellText[1:-1])
                    value = int(valueText)

                    for position in positions:
                        if position not in cells:
                            raise ValueError(f"cell {position} is used before it is declared")
                    if len(set(positions)) != len(positions):
                        raise ValueError("a cell appears more than once in this total")

                    cg = puzzle.addConstraintGroup("Line")
                    for position in positions:
                        cg.addCell(cells[position])
                    cg.addConstraint(UniqueValueConstraint)
                    tsvc = cg.addConstraint(TotalSumValueConstraint)
                    tsvc.setTotalValue(value)
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
    mainWin.loadExample()
    mainWin.show()
    sys.exit(app.exec())
