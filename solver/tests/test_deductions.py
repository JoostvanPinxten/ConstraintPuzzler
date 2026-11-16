"""The solver's deduction records: reasons, hints, single steps and agenda propagation."""

import unittest

from parsers.sudoku import parseSudokuLines
from solver.solver import SolveCancelled, Solver
from structure.cell import ValueSource
from structure.errors import ContradictionError
from structure.tests.test_entries import EASY
from utility.puzzletypes import PUZZLE_TYPES
from utility.resources import resourcePath


def loadExamples():
    for puzzleType in PUZZLE_TYPES.values():
        for label, fileName in puzzleType.examples.items():
            yield (
                f"{puzzleType.name}/{label}",
                lambda f=fileName, t=puzzleType: t.parser(resourcePath(f)),
            )


def fullFixedPoint(puzzle):
    """Propagation the simple way: apply everything until a pass changes nothing."""
    solver = Solver(puzzle)
    state = puzzle.saveState()
    while True:
        solver.step()
        newState = puzzle.saveState()
        if newState == state:
            return
        state = newState


class DeductionTest(unittest.TestCase):
    def testAgendaReachesTheSameFixedPoint(self):
        for name, load in loadExamples():
            with self.subTest(puzzle=name):
                agenda, full = load(), load()
                Solver(agenda).propagate()
                fullFixedPoint(full)
                # the cells end up the same (the sum constraints' own bookkeeping of values may
                # differ, as the passes visit the states in a different order)
                agendaCells, _ = agenda.saveState()
                fullCells, _ = full.saveState()
                self.assertEqual(agendaCells, fullCells)

    def testEveryExampleIsSolvable(self):
        for name, load in loadExamples():
            with self.subTest(puzzle=name):
                puzzle = load()
                self.assertTrue(Solver(puzzle, allowGuessing=True).solve())
                self.assertEqual(Solver(load()).countSolutions(), 1)

    def testEveryChangeIsRecordedWithAReason(self):
        for name, load in loadExamples():
            with self.subTest(puzzle=name):
                puzzle = load()
                before = {c: c.getPossibleValues() for c in puzzle.grid.getCells()}
                solver = Solver(puzzle)
                solver.propagate()
                removed = {c: set() for c in before}
                for d in solver.log.deductions:
                    self.assertTrue(d.reason())
                    self.assertIn(d.cell.getName(), d.describe())
                    removed[d.cell] |= d.removed
                    if d.setsValue():
                        self.assertEqual(d.source, ValueSource.DEDUCED)
                        removed[d.cell] |= before[d.cell] - {d.value}
                # every candidate that disappeared is accounted for by a deduction
                for cell, values in before.items():
                    self.assertEqual(values - cell.getPossibleValues(), removed[cell])

    def testRecordingStopsAfterwards(self):
        puzzle = parseSudokuLines(EASY)
        solver = Solver(puzzle)
        solver.propagate()
        self.assertIsNone(puzzle.deductionLog)
        recorded = len(solver.log)
        puzzle.grid.getCells()[0].reset()  # a change outside the solver is not recorded
        self.assertEqual(len(solver.log), recorded)

    def testHintDoesNotChangeThePuzzle(self):
        puzzle = parseSudokuLines(EASY)
        state = puzzle.saveState()
        hint = Solver(puzzle).hint()
        self.assertEqual(puzzle.saveState(), state)
        assert hint is not None
        self.assertTrue(hint.setsValue())
        self.assertIn(hint.value, hint.cell.getPossibleValues())
        self.assertTrue(hint.reason())

    def testHintsAreCorrect(self):
        puzzle = parseSudokuLines(EASY)
        solved = parseSudokuLines(EASY)
        Solver(solved).solve()
        solution = {(i % 9, i // 9): c.getValue() for i, c in enumerate(solved.grid.getCells())}
        solver = Solver(puzzle)
        for _ in range(10):
            hint = solver.hint()
            assert hint is not None and hint.value is not None
            index = puzzle.grid.getCells().index(hint.cell)
            self.assertEqual(hint.value, solution[(index % 9, index // 9)])
            hint.cell.inferValue(hint.value)

    def testSolveStepExplainsItself(self):
        puzzle = parseSudokuLines(EASY)
        solver = Solver(puzzle)
        self.assertTrue(solver.solveStep())
        step = solver.lastStep
        assert step is not None
        self.assertEqual(step.cell.getValue(), step.value)
        self.assertEqual(step.cell.getSource(), ValueSource.DEDUCED)
        self.assertTrue(step.describe())

    def testGuessesAreRecorded(self):
        puzzle = PUZZLE_TYPES["sudoku"].parser(resourcePath("hardSudoku.txt"))
        solver = Solver(puzzle, allowGuessing=True)
        self.assertTrue(solver.solve())
        guesses = [d for d in solver.log.deductions if d.source is ValueSource.GUESSED]
        self.assertTrue(guesses)
        # the log only keeps the guesses that led to the solution
        for d in guesses:
            self.assertEqual(d.cell.getValue(), d.value)
            self.assertIn("guess", d.reason())


class CountSolutionsTest(unittest.TestCase):
    def testUniqueSolution(self):
        puzzle = parseSudokuLines(EASY)
        state = puzzle.saveState()
        self.assertEqual(Solver(puzzle).countSolutions(), 1)
        self.assertEqual(puzzle.saveState(), state)

    def testManySolutions(self):
        lines = ["- - - - - - - - -"] * 9
        puzzle = parseSudokuLines(lines)
        self.assertEqual(Solver(puzzle).countSolutions(limit=3), 3)

    def testNoSolution(self):
        lines = list(EASY)
        lines[0] = "6 6 9 - - - - - 2"  # two sixes in a row
        try:
            puzzle = parseSudokuLines(lines)
        except ContradictionError:
            return  # the parser already noticed
        self.assertEqual(Solver(puzzle).countSolutions(), 0)


class CancelTest(unittest.TestCase):
    def testStopRestoresThePuzzle(self):
        puzzle = PUZZLE_TYPES["sudoku"].parser(resourcePath("hardSudoku.txt"))
        state = puzzle.saveState()
        calls = []

        def stopAfterAFewChecks():
            calls.append(None)
            return len(calls) > 3

        solver = Solver(puzzle, allowGuessing=True)
        with self.assertRaises(SolveCancelled):
            solver.solve(shouldStop=stopAfterAFewChecks)
        self.assertEqual(puzzle.saveState(), state)
        self.assertIsNone(solver.shouldStop)
        # the solver can be used again afterwards
        self.assertTrue(solver.solve())


if __name__ == "__main__":
    unittest.main()
