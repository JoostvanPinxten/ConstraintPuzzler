"""Playing a puzzle: entries and solver actions through Game, with undo and redo."""

import unittest

from parsers.sudoku import parseSudokuFile, parseSudokuLines
from solver.Solver import Solver
from structure.cell import ValueSource
from structure.entries import EntryError
from structure.game import Game
from structure.tests.test_entries import EASY
from utility.resources import resourcePath


class GameTest(unittest.TestCase):
    def setUp(self):
        self.puzzle = parseSudokuLines(EASY)
        self.game = Game(self.puzzle)
        self.cell = self.puzzle.grid.getCellFromSquareGrid
        self.topLeft = self.cell(0, 0)  # candidates 4 and 7
        self.loaded = self.puzzle.saveState()

    def testNothingToUndoAtStart(self):
        self.assertFalse(self.game.canUndo())
        self.assertFalse(self.game.undo())
        self.assertFalse(self.game.redo())

    def testUndoAndRedoAnEntry(self):
        self.game.enter(self.topLeft, 4)
        self.assertEqual(self.topLeft.getValue(), 4)
        self.assertEqual(self.topLeft.getSource(), ValueSource.ENTERED)
        self.assertTrue(self.game.canUndo())

        self.assertTrue(self.game.undo())
        self.assertFalse(self.topLeft.hasValue())
        self.assertEqual(self.puzzle.saveState(), self.loaded)
        self.assertEqual(self.game.entries.entries, {})
        self.assertTrue(self.game.canRedo())

        self.assertTrue(self.game.redo())
        self.assertEqual(self.topLeft.getValue(), 4)
        self.assertEqual(self.game.entries.entries, {self.topLeft: 4})

    def testUndoAMistake(self):
        self.game.enter(self.topLeft, 1)  # 1 is in its column: a mistake
        self.assertTrue(self.game.isMistake(self.topLeft))
        self.assertIn(self.topLeft, self.game.violations())
        self.assertIsNotNone(self.game.violationNote(self.topLeft))
        self.game.undo()
        self.assertFalse(self.game.isMistake(self.topLeft))
        self.assertEqual(self.game.violations(), set())

    def testNewActionClearsRedo(self):
        self.game.enter(self.topLeft, 4)
        self.game.undo()
        self.game.enter(self.topLeft, 7)
        self.assertFalse(self.game.canRedo())
        self.assertEqual(self.topLeft.getValue(), 7)

    def testRejectedEntryIsNotRecorded(self):
        given = self.cell(1, 0)
        with self.assertRaises(EntryError):
            self.game.enter(given, 3)
        self.assertFalse(self.game.canUndo())

    def testUnchangedEntryIsNotRecorded(self):
        self.game.clear(self.topLeft)  # already empty
        self.assertFalse(self.game.canUndo())

    def testUndoSolve(self):
        solver = Solver(self.puzzle)
        self.assertTrue(self.game.solve(solver))
        self.assertTrue(self.game.isSolved())
        self.assertEqual(self.topLeft.getSource(), ValueSource.DEDUCED)
        self.game.undo()
        self.assertEqual(self.puzzle.saveState(), self.loaded)

    def testUndoSolveStep(self):
        solver = Solver(self.puzzle)
        openCells = self.puzzle.getNumberOfOpenCells()
        self.assertTrue(self.game.solveStep(solver))
        self.assertEqual(self.puzzle.getNumberOfOpenCells(), openCells - 1)
        self.game.undo()
        self.assertEqual(self.puzzle.getNumberOfOpenCells(), openCells)

    def testSolveReplacesMistakes(self):
        self.game.enter(self.topLeft, 1)
        self.game.solve(Solver(self.puzzle))
        self.assertFalse(self.game.isMistake(self.topLeft))
        self.assertIn(self.game.valueOf(self.topLeft), {4, 7})
        self.assertTrue(self.game.isSolved())
        # undo brings the mistake back
        self.game.undo()
        self.assertTrue(self.game.isMistake(self.topLeft))

    def testHistoryIsLimited(self):
        game = Game(self.puzzle, maxHistory=2)
        for value in (4, 7, 4):
            game.enter(self.topLeft, value)
        self.assertTrue(game.undo())
        self.assertTrue(game.undo())
        self.assertFalse(game.undo())


class NotesTest(unittest.TestCase):
    def setUp(self):
        self.puzzle = parseSudokuLines(EASY)
        self.game = Game(self.puzzle)
        self.topLeft = self.puzzle.grid.getCellFromSquareGrid(0, 0)  # candidates 4 and 7
        self.given = self.puzzle.grid.getCellFromSquareGrid(1, 0)

    def testToggleANote(self):
        state = self.puzzle.saveState()
        self.game.toggleNote(self.topLeft, 4)
        self.game.toggleNote(self.topLeft, 1)  # any value of the puzzle, not only candidates
        self.assertEqual(self.game.notesOf(self.topLeft), {1, 4})
        self.game.toggleNote(self.topLeft, 4)
        self.assertEqual(self.game.notesOf(self.topLeft), {1})
        self.game.toggleNote(self.topLeft, 1)
        self.assertEqual(self.game.notesOf(self.topLeft), frozenset())
        self.assertNotIn(self.topLeft, self.game.notes)
        # notes do not touch the puzzle model
        self.assertEqual(self.puzzle.saveState(), state)

    def testNotesAreUndone(self):
        self.game.toggleNote(self.topLeft, 4)
        self.game.toggleNote(self.topLeft, 7)
        self.assertTrue(self.game.undo())
        self.assertEqual(self.game.notesOf(self.topLeft), {4})
        self.assertTrue(self.game.redo())
        self.assertEqual(self.game.notesOf(self.topLeft), {4, 7})

    def testNoNotesInAGivenOrFilledCell(self):
        with self.assertRaises(EntryError):
            self.game.toggleNote(self.given, 4)
        with self.assertRaises(EntryError):
            self.game.toggleNote(self.topLeft, 0)  # not a value of a sudoku
        self.game.enter(self.topLeft, 4)
        with self.assertRaises(EntryError):
            self.game.toggleNote(self.topLeft, 7)
        self.game.undo()
        self.assertFalse(self.game.canUndo())  # the rejected notes were not recorded

    def testNotesStayWhileTheCellHasAValue(self):
        self.game.toggleNote(self.topLeft, 7)
        self.game.enter(self.topLeft, 4)
        self.game.clear(self.topLeft)
        self.assertEqual(self.game.notesOf(self.topLeft), {7})


class GuessedValuesTest(unittest.TestCase):
    def testSolverMarksGuesses(self):
        puzzle = parseSudokuFile(resourcePath("hardSudoku.txt"))
        solver = Solver(puzzle, allowGuessing=True)
        self.assertTrue(Game(puzzle).solve(solver))
        sources = {c.getSource() for c in puzzle.grid.getCells()}
        self.assertIn(ValueSource.GUESSED, sources)
        self.assertIn(ValueSource.GIVEN, sources)
        guessed = [c for c in puzzle.grid.getCells() if c.isGuessed()]
        self.assertTrue(all(c.isInferred() and not c.isGiven() for c in guessed))


if __name__ == "__main__":
    unittest.main()
