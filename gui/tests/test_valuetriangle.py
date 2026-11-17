"""The Kakuro clue triangles: each alignment is a different half of the cell."""

import unittest

from PySide6 import QtCore, QtWidgets

from gui.puzzlerepresentation.valuetriangle import ValueTriangle

ALIGNMENTS = (
    ValueTriangle.TOPLEFT,
    ValueTriangle.TOPRIGHT,
    ValueTriangle.BOTTOMRIGHT,
    ValueTriangle.BOTTOMLEFT,
)


class FakeSum:
    def getTotalValue(self):
        return 17


class ValueTriangleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def corners(self, alignment):
        triangle = ValueTriangle(FakeSum(), 60, QtCore.QPoint(0, 0), alignment)  # type: ignore[arg-type]
        polygon = triangle.polygon()
        return {(polygon.at(i).x(), polygon.at(i).y()) for i in range(polygon.count())}

    def testEachAlignmentIsATriangleInTheCell(self):
        for alignment in ALIGNMENTS:
            corners = self.corners(alignment)
            self.assertEqual(len(corners), 3, alignment)
            for x, y in corners:
                self.assertIn(x, (0, 60))
                self.assertIn(y, (0, 60))

    def testAllAlignmentsDiffer(self):
        shapes = {frozenset(self.corners(a)) for a in ALIGNMENTS}
        self.assertEqual(len(shapes), 4)

    def testOppositeHalvesShareTheDiagonal(self):
        # top-right and bottom-left are cut by the same diagonal, as are the other two
        for a, b in (
            (ValueTriangle.TOPRIGHT, ValueTriangle.BOTTOMLEFT),
            (ValueTriangle.TOPLEFT, ValueTriangle.BOTTOMRIGHT),
        ):
            self.assertEqual(len(self.corners(a) & self.corners(b)), 2)
            self.assertEqual(len(self.corners(a) | self.corners(b)), 4)


if __name__ == "__main__":
    unittest.main()
