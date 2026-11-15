"""Where the clue of a Kakuro line is drawn (parsers.kakuro.clueAnchor)."""

import unittest

from parsers.kakuro import clueAnchor
from structure.position import Position
from structure.puzzle import Puzzle


def cellsAt(*positions):
    puzzle = Puzzle("test", range(1, 10))
    return [puzzle.grid.addCell(Position(x, y)) for x, y in positions]


class ClueAnchorTest(unittest.TestCase):
    def testAcross(self):
        cells = cellsAt((3, 2), (1, 2), (2, 2))  # in any order
        self.assertEqual(clueAnchor(cells), (Position(0, 2), "across"))

    def testDown(self):
        cells = cellsAt((4, 5), (4, 3), (4, 4))
        self.assertEqual(clueAnchor(cells), (Position(4, 2), "down"))

    def testSingleCellIsAcross(self):
        self.assertEqual(clueAnchor(cellsAt((2, 2))), (Position(1, 2), "across"))

    def testNoCells(self):
        with self.assertRaises(ValueError):
            clueAnchor([])


if __name__ == "__main__":
    unittest.main()
