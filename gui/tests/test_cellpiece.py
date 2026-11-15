"""The shapes that show a cell: the hint grid fits any number of values."""

import unittest

from PySide6 import QtCore, QtWidgets

from gui.puzzlerepresentation.cellpiece import (
    ENTERED_VALUE_COLOR,
    GIVEN_VALUE_COLOR,
    SOLVER_VALUE_COLOR,
    VIOLATION_COLOR,
    hintGrid,
)
from gui.puzzlerepresentation.valuehexagon import ValueHexagon
from gui.puzzlerepresentation.valuerectangle import ValueRectangle
from structure.cell import ValueSource
from structure.puzzle import Puzzle


class HintGridTest(unittest.TestCase):
    def testSizes(self):
        self.assertEqual(hintGrid(9), (3, 3))
        self.assertEqual(hintGrid(4), (2, 2))
        self.assertEqual(hintGrid(7), (3, 3))
        self.assertEqual(hintGrid(10), (4, 3))
        self.assertEqual(hintGrid(16), (4, 4))
        self.assertEqual(hintGrid(1), (1, 1))


class CellPieceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def pieces(self, values):
        puzzle = Puzzle("test", values)
        cell = puzzle.grid.addCell()
        position = QtCore.QPointF(10, 20)
        return cell, [ValueRectangle(cell, 60, position), ValueHexagon(cell, 100, position)]

    def testHintsFitInTheCell(self):
        # 0..15: more than nine values, not starting at 1
        cell, pieces = self.pieces(range(0, 16))
        for piece in pieces:
            with self.subTest(piece=type(piece).__name__):
                positions = {
                    (hint.pos().x(), hint.pos().y()) for hint in piece.hintValueItemMap.values()
                }
                self.assertEqual(len(positions), 16)
                bounds = piece.boundingRect()
                for x, y in positions:
                    self.assertTrue(bounds.contains(QtCore.QPointF(x, y)))
                visible = [v for v, h in piece.hintValueItemMap.items() if h.opacity() == 1]
                self.assertEqual(sorted(visible), list(range(16)))

    def testCandidatesAndHintsToggle(self):
        cell, pieces = self.pieces(range(1, 5))
        cell.remove(2)
        for piece in pieces:
            visible = [v for v, h in piece.hintValueItemMap.items() if h.opacity() == 1]
            self.assertEqual(visible, [1, 2, 3, 4])  # not redrawn yet
            piece.updateRepresentation()
            visible = [v for v, h in piece.hintValueItemMap.items() if h.opacity() == 1]
            self.assertEqual(sorted(visible), [1, 3, 4])
            piece.setHintsEnabled(False)
            self.assertTrue(all(h.opacity() == 0 for h in piece.hintValueItemMap.values()))

    def testValueColours(self):
        for source, colour in (
            (ValueSource.GIVEN, GIVEN_VALUE_COLOR),
            (ValueSource.DEDUCED, SOLVER_VALUE_COLOR),
            (ValueSource.GUESSED, SOLVER_VALUE_COLOR),
            (ValueSource.ENTERED, ENTERED_VALUE_COLOR),
        ):
            cell, pieces = self.pieces(range(1, 5))
            cell.setValue(3, source)
            for piece in pieces:
                with self.subTest(source=source, piece=type(piece).__name__):
                    piece.updateRepresentation()
                    self.assertEqual(piece.valueTextItem.toPlainText(), "3")
                    self.assertEqual(piece.valueTextItem.opacity(), 1)
                    self.assertEqual(piece.valueTextItem.defaultTextColor(), colour)
                    piece.markViolation()
                    self.assertEqual(piece.valueTextItem.defaultTextColor(), VIOLATION_COLOR)

    def testMistake(self):
        cell, pieces = self.pieces(range(1, 5))
        for piece in pieces:
            piece.showMistake(4)
            self.assertEqual(piece.valueTextItem.toPlainText(), "4")
            self.assertEqual(piece.valueTextItem.defaultTextColor(), VIOLATION_COLOR)
            self.assertTrue(all(h.opacity() == 0 for h in piece.hintValueItemMap.values()))


if __name__ == "__main__":
    unittest.main()
