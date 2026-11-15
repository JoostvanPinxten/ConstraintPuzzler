"""Entering, changing and clearing values by hand (UserEntries)."""

import unittest

from parsers.sudoku import parseSudokuLines
from structure.entries import EntryError, UserEntries

EASY = """\
- 6 9 - - - - - 2
8 2 - 3 6 - - 9 -
3 - - - 9 - - - 1
- - - 4 - - - 5 -
- 5 2 1 - 3 - - 6
1 - 4 - - 6 - 7 3
5 - 7 6 - - - - 8
- - 3 - - 1 5 6 -
- - - 5 3 2 - - -
""".splitlines()


class UserEntriesTest(unittest.TestCase):
    def setUp(self):
        self.puzzle = parseSudokuLines(EASY)
        self.entries = UserEntries(self.puzzle)
        self.cell = self.puzzle.grid.getCellFromSquareGrid
        # top-left cell: 6, 9, 2 in its row, 8, 3, 1, 5 in its column
        self.topLeft = self.cell(0, 0)
        self.assertEqual(self.topLeft.getPossibleValues(), {4, 7})

    def testEnteredValuePropagates(self):
        self.entries.enter(self.topLeft, 4)
        self.assertEqual(self.topLeft.getValue(), 4)
        self.assertTrue(self.topLeft.isEntered())
        self.assertFalse(self.topLeft.isGiven())
        self.assertFalse(self.topLeft.isInferred())
        self.assertNotIn(4, self.cell(4, 0).getPossibleValues())

    def testGivenCellsCannotBeChanged(self):
        given = self.cell(1, 0)
        self.assertTrue(given.isGiven())
        with self.assertRaisesRegex(EntryError, "given"):
            self.entries.enter(given, 4)
        with self.assertRaisesRegex(EntryError, "given"):
            self.entries.clear(given)
        self.assertEqual(given.getValue(), 6)

    def testValueThatIsNotACandidateIsAMistake(self):
        state = self.puzzle.saveState()
        self.assertEqual(self.entries.violations(), set())
        self.entries.enter(self.topLeft, 6)
        # shown, but kept out of the model
        self.assertEqual(self.puzzle.saveState(), state)
        self.assertTrue(self.entries.isMistake(self.topLeft))
        self.assertEqual(self.entries.valueOf(self.topLeft), 6)
        self.assertIsNone(self.topLeft.getValue())
        # the given 6 in the same row clashes with it
        self.assertEqual(self.entries.violations(), {self.topLeft, self.cell(1, 0)})

        # fixing the mistake
        self.entries.enter(self.topLeft, 4)
        self.assertFalse(self.entries.isMistake(self.topLeft))
        self.assertEqual(self.topLeft.getValue(), 4)
        self.assertEqual(self.entries.violations(), set())

    def testClearingAMistake(self):
        state = self.puzzle.saveState()
        self.entries.enter(self.topLeft, 6)
        self.entries.clear(self.topLeft)
        self.assertEqual(self.entries.mistakes, {})
        self.assertEqual(self.entries.violations(), set())
        self.assertEqual(self.puzzle.saveState(), state)

    def testValuesThePuzzleDoesNotUseAreRefused(self):
        state = self.puzzle.saveState()
        with self.assertRaisesRegex(EntryError, "not a value"):
            self.entries.enter(self.topLeft, 0)
        self.assertEqual(self.puzzle.saveState(), state)
        self.assertEqual(self.entries.entries, {})

    def testChangingAValueReplaysTheEntries(self):
        self.entries.enter(self.topLeft, 4)
        self.entries.enter(self.topLeft, 7)
        self.assertEqual(self.topLeft.getValue(), 7)
        # the same as entering 7 straight away: the 4 is back as a candidate in the row
        fresh = parseSudokuLines(EASY)
        UserEntries(fresh).enter(fresh.grid.getCellFromSquareGrid(0, 0), 7)
        self.assertEqual(self.puzzle.saveState(), fresh.saveState())

    def testClearingRestoresTheLoadedPuzzle(self):
        state = self.puzzle.saveState()
        self.entries.enter(self.topLeft, 4)
        self.entries.clear(self.topLeft)
        self.assertEqual(self.puzzle.saveState(), state)
        self.assertEqual(self.entries.entries, {})

    def testChangeThatClashesWithAnotherEntryBecomesAMistake(self):
        self.entries.enter(self.topLeft, 4)
        other = self.cell(3, 0)  # same row, candidates 7 and 8
        self.entries.enter(other, 7)
        self.entries.enter(self.topLeft, 7)
        self.assertEqual(self.entries.mistakes, {self.topLeft: 7})
        self.assertIsNone(self.topLeft.getValue())
        self.assertEqual(other.getValue(), 7)
        self.assertEqual(self.entries.violations(), {self.topLeft, other})

        # clearing the other entry makes the 7 fit: it is entered in the model after all
        self.entries.clear(other)
        self.assertEqual(self.entries.mistakes, {})
        self.assertEqual(self.topLeft.getValue(), 7)
        self.assertEqual(self.entries.violations(), set())

    def testEnteredFlagSurvivesSaveAndRestore(self):
        state = self.puzzle.saveState()
        self.entries.enter(self.topLeft, 4)
        entered = self.puzzle.saveState()
        self.puzzle.restoreState(state)
        self.assertFalse(self.topLeft.isEntered())
        self.puzzle.restoreState(entered)
        self.assertTrue(self.topLeft.isEntered())


if __name__ == "__main__":
    unittest.main()
