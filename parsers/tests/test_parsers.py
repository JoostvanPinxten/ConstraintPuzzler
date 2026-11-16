"""Tests for the Kakuro and Sumbrero file parsers and the Sumbrero hexagon geometry.

The parsers do not depend on PySide6, so these tests need no GUI."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from parsers import (
    PuzzleFileError,
    parseFutoshikiFile,
    parseKakuroFile,
    parseKakuroLines,
    parseSudokuFile,
    parseSumbreroFile,
    parseSumbreroLines,
)
from parsers.sumbrero import (
    ASCENDING_ROW,
    COLUMN,
    DESCENDING_ROW,
    ascendingRow,
    descendingRow,
    neighbour,
)
from solver.solver import Solver
from structure.position import Position

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

TINY_KAKURO = """\
# solves to 1 2 / 3 1
range = 1,9
cell(1,1)
cell(2,1)
cell(1,2)
cell(2,2)
total((1,1);(2,1)) = 3
total((1,2);(2,2)) = 4
total((1,1);(1,2)) = 4
total((2,1);(2,2)) = 3
"""


def positionsOf(group):
    return sorted((c.getPosition().x(), c.getPosition().y()) for c in group.getCells())


class PuzzleFileTestCase(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)

    def writeFile(self, text):
        path = os.path.join(self.directory.name, "puzzle.txt")
        with open(path, "w") as f:
            f.write(text)
        return path


class KakuroParserTest(PuzzleFileTestCase):
    def parse(self, text):
        puzzle = parseKakuroFile(self.writeFile(text))
        return puzzle, Solver(puzzle)

    def testTinyKakuroSolves(self):
        puzzle, solver = self.parse(TINY_KAKURO)
        self.assertTrue(solver.solve())
        self.assertEqual([c.getValue() for c in puzzle.getGrid().getCells()], [1, 2, 3, 1])

    def testWhitespaceInTotalIsAllowed(self):
        text = TINY_KAKURO.replace("total((1,1);(2,1)) = 3", "total( (1, 1) ; (2,1) )=3")
        puzzle, solver = self.parse(text)
        self.assertEqual(positionsOf(puzzle.getConstraintGroups()[0]), [(1, 1), (2, 1)])
        self.assertTrue(solver.solve())

    def testIndentedStatementsAreRead(self):
        puzzle, solver = self.parse("\n".join("   " + line for line in TINY_KAKURO.splitlines()))
        self.assertEqual(len(puzzle.getGrid().getCells()), 4)
        self.assertTrue(solver.solve())

    def assertFileError(self, text, lineNumber, fragment):
        with self.assertRaises(PuzzleFileError) as context:
            self.parse(text)
        self.assertIn(f"line {lineNumber}:", str(context.exception))
        self.assertIn(fragment, str(context.exception))

    def testUndeclaredCellIsAnError(self):
        self.assertFileError(
            "range = 1,9\ncell(1,1)\ntotal((1,1);(2,1)) = 3\n", 3, "before it is declared"
        )

    def testUnreadableCellIsAnError(self):
        self.assertFileError(
            "range = 1,9\ncell(1,1)\ncell(2,1)\ntotal((1,1);(2,x)) = 3\n", 4, "(x,y)"
        )

    def testCellTwiceInTotalIsAnError(self):
        self.assertFileError(
            "range = 1,9\ncell(1,1)\ncell(2,1)\ntotal((1,1);(1,1)) = 3\n", 4, "more than once"
        )

    def testCellDeclaredTwiceIsAnError(self):
        self.assertFileError("range = 1,9\ncell(1,1)\ncell( 1,1 )\n", 3, "declared twice")

    def testRangeMustComeFirst(self):
        self.assertFileError("cell(1,1)\nrange = 1,9\n", 1, "must come before")

    def testMissingRangeIsAnError(self):
        with self.assertRaises(PuzzleFileError):
            self.parse("# nothing here\n")

    def testExampleFilesParse(self):
        for name, totals in (("simpleKakuro.txt", 4), ("mediumKakuro.txt", 44)):
            with self.subTest(name=name):
                puzzle = parseKakuroFile(str(REPO_ROOT / name))
                self.assertEqual(len(puzzle.getConstraintGroups()), totals)
                for group in puzzle.getConstraintGroups():
                    cells = group.getCells()
                    self.assertEqual(len(cells), len(set(cells)))


class HexagonGeometryTest(unittest.TestCase):
    OPPOSITE = {"N": "S", "S": "N", "NE": "SW", "SW": "NE", "SE": "NW", "NW": "SE"}

    def positions(self):
        return [Position(x, y) for x in range(-3, 6) for y in range(-3, 6)]

    def testNeighboursAreSymmetric(self):
        for position in self.positions():
            for direction, opposite in self.OPPOSITE.items():
                self.assertEqual(neighbour(neighbour(position, direction), opposite), position)

    def testRowsFollowTheirDirection(self):
        for position in self.positions():
            self.assertEqual(descendingRow(neighbour(position, "SE")), descendingRow(position))
            self.assertEqual(ascendingRow(neighbour(position, "NE")), ascendingRow(position))
            # and the other directions leave the row
            self.assertNotEqual(descendingRow(neighbour(position, "NE")), descendingRow(position))
            self.assertNotEqual(ascendingRow(neighbour(position, "SE")), ascendingRow(position))
            self.assertNotEqual(descendingRow(neighbour(position, "S")), descendingRow(position))
            self.assertNotEqual(ascendingRow(neighbour(position, "S")), ascendingRow(position))

    def testRowsAreNumberedWhereTheyCrossColumnZero(self):
        for y in range(-3, 6):
            self.assertEqual(descendingRow(Position(0, y)), y)
            self.assertEqual(ascendingRow(Position(0, y)), y)


class SumbreroParserTest(PuzzleFileTestCase):
    def setUp(self):
        super().setUp()
        self.puzzle = parseSumbreroFile(str(REPO_ROOT / "simpleSumbrero.txt"))
        self.solver = Solver(self.puzzle)
        self.groups = {g.getName(): g for g in self.puzzle.getConstraintGroups()}

    def testRowsSelectStraightLines(self):
        self.assertEqual(positionsOf(self.groups[f"{COLUMN} 1"]), [(1, 0), (1, 1), (1, 2), (1, 3)])
        self.assertEqual(
            positionsOf(self.groups[f"{DESCENDING_ROW} 0"]), [(0, 0), (1, 0), (2, 1), (3, 1)]
        )
        self.assertEqual(
            positionsOf(self.groups[f"{ASCENDING_ROW} 2"]), [(0, 2), (1, 1), (2, 1), (3, 0)]
        )

    def testAscendingAndDescendingRowsDiffer(self):
        for index in range(4):
            self.assertNotEqual(
                positionsOf(self.groups[f"{DESCENDING_ROW} {index}"]),
                positionsOf(self.groups[f"{ASCENDING_ROW} {index}"]),
            )

    def testExampleSolvesByDeduction(self):
        self.assertTrue(self.solver.solve())
        for group in self.puzzle.getConstraintGroups():
            values = [c.getValue() for c in group.getCells()]
            self.assertEqual(len(values), len(set(values)), group.getName())

    def testEmptyLineIsAnError(self):
        path = self.writeFile("range = 1,9\ncell(0,0)\nrow_ascending(7) = 3\n")
        with self.assertRaises(PuzzleFileError) as context:
            parseSumbreroFile(path)
        self.assertIn("line 3:", str(context.exception))


class ParseLinesTest(unittest.TestCase):
    def testParsersDoNotImportPySide6(self):
        code = "import sys, parsers; sys.exit(any(m.startswith('PySide6') for m in sys.modules))"
        result = subprocess.run([sys.executable, "-c", code], cwd=REPO_ROOT)
        self.assertEqual(result.returncode, 0, "the parsers must not import PySide6")

    def testLinesWithoutFile(self):
        puzzle = parseKakuroLines(TINY_KAKURO.splitlines())
        self.assertTrue(Solver(puzzle).solve())

    def testErrorsNameTheSource(self):
        with self.assertRaises(PuzzleFileError) as context:
            parseSumbreroLines(["cell(0,0)"], "inline")
        self.assertIn("inline, line 1:", str(context.exception))

    def testSudokuAndFutoshikiExamples(self):
        sudoku = parseSudokuFile(str(REPO_ROOT / "easySudoku.txt"))
        self.assertEqual(len(sudoku.getGrid().getCells()), 81)
        futoshiki = parseFutoshikiFile(str(REPO_ROOT / "futoshiki.txt"))
        self.assertTrue(Solver(futoshiki).solve())


if __name__ == "__main__":
    unittest.main()
