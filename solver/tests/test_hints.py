"""Hints revealed in levels: region, cell, value."""

import unittest

from parsers.sudoku import parseSudokuLines
from solver.hints import CELL, REGION, VALUE, HintSession
from solver.Solver import Solver
from structure.tests.test_entries import EASY


class HintSessionTest(unittest.TestCase):
    def setUp(self):
        self.puzzle = parseSudokuLines(EASY)
        self.solver = Solver(self.puzzle)
        self.session = HintSession()

    def testLevelsRevealTheSameDeduction(self):
        first = self.session.advance(self.solver)
        assert first is not None
        self.assertEqual(self.session.level, REGION)
        self.assertNotIn(first.cell.getName(), self.session.message())
        self.assertIs(self.session.advance(self.solver), first)
        self.assertEqual(self.session.level, CELL)
        self.assertIn(first.cell.getName(), self.session.message())
        self.assertNotIn(str(first.value), self.session.message().replace(first.cell.getName(), ""))
        self.assertIs(self.session.advance(self.solver), first)
        self.assertEqual(self.session.level, VALUE)
        self.assertEqual(self.session.message(), first.describe())
        # it stays at the value
        self.assertIs(self.session.advance(self.solver), first)
        self.assertEqual(self.session.level, VALUE)

    def testHintsDoNotChangeThePuzzle(self):
        state = self.puzzle.saveState()
        for _ in range(3):
            self.session.advance(self.solver)
        self.assertEqual(self.puzzle.saveState(), state)

    def testANewHintAfterThePuzzleChanged(self):
        first = self.session.advance(self.solver)
        self.session.advance(self.solver)
        assert first is not None and first.value is not None
        first.cell.inferValue(first.value)
        second = self.session.advance(self.solver)
        self.assertIsNot(second, first)
        self.assertEqual(self.session.level, REGION)

    def testRegionContainsTheCell(self):
        hint = self.session.advance(self.solver)
        assert hint is not None
        region = self.session.regionCells()
        self.assertIn(hint.cell, region)
        if hint.cause is not None:
            self.assertEqual(region, set(hint.cause.group.getCells()))
        else:
            groups = hint.cell.getConstraintGroups()
            self.assertEqual(region, {c for g in groups for c in g.getCells()})

    def testNakedSingleRegionIsEveryGroupOfTheCell(self):
        # with seed 0..9 at least one naked single shows up on the easy puzzle; check them all
        for seed in range(10):
            self.session.reset()
            self.solver.random.seed(seed)
            hint = self.session.advance(self.solver)
            assert hint is not None
            if hint.cause is None:
                self.assertIn("only one possible value", self.session.message())
                self.assertEqual(len(self.session.regionCells()), 21)  # row, column and box

    def testResetForgetsTheHint(self):
        self.session.advance(self.solver)
        self.session.reset()
        self.assertIsNone(self.session.deduction)
        self.assertEqual(self.session.level, 0)
        self.assertEqual(self.session.message(), "")
        self.assertEqual(self.session.regionCells(), set())


if __name__ == "__main__":
    unittest.main()
