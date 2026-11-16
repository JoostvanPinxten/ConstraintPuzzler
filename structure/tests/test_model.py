"""The puzzle model: Signal, Cell, Grid, ConstraintGroup membership and puzzle snapshots."""

import unittest

from constraints.uniquevalueconstraint import UniqueValueConstraint
from structure.cell import PositionedCell, ValueSource
from structure.errors import ContradictionError
from structure.position import Position
from structure.puzzle import Puzzle
from structure.signal import Signal
from utility.puzzlefactory import PuzzleFactory


class SignalTest(unittest.TestCase):
    def testEmitCallsCallbacksInOrder(self):
        signal = Signal()
        calls = []
        signal.connect(lambda x: calls.append(("a", x)))
        signal.connect(lambda x: calls.append(("b", x)))
        signal.emit(1)
        self.assertEqual(calls, [("a", 1), ("b", 1)])

    def testDisconnect(self):
        signal = Signal()
        calls = []
        signal.connect(calls.append)
        signal.disconnect(calls.append)
        signal.emit(1)
        self.assertEqual(calls, [])

    def testExceptionsPropagate(self):
        # the solver relies on this to see contradictions found by constraints
        signal = Signal()

        def fail(_):
            raise ContradictionError("boom")

        signal.connect(fail)
        with self.assertRaises(ContradictionError):
            signal.emit(1)

    def testCallbackMayDisconnectWhileEmitting(self):
        signal = Signal()
        calls = []

        def once(x):
            calls.append(x)
            signal.disconnect(once)

        signal.connect(once)
        signal.emit(1)
        signal.emit(2)
        self.assertEqual(calls, [1])


class CellTest(unittest.TestCase):
    def setUp(self):
        self.puzzle = Puzzle("test", {1, 2, 3})
        self.cell = self.puzzle.grid.addCell()
        self.changed = []
        self.cell.valueChanged.connect(self.changed.append)
        self.narrowed = []
        self.cell.possibleValuesChanged.connect(self.narrowed.append)

    def testSetValue(self):
        self.cell.setValue(2)
        self.assertEqual(self.cell.getValue(), 2)
        self.assertEqual(self.cell.getPossibleValues(), {2})
        self.assertTrue(self.cell.isGiven())
        self.assertEqual(self.changed, [self.cell])

    def testValueKinds(self):
        self.cell.inferValue(1)
        self.assertTrue(self.cell.isInferred())
        self.assertFalse(self.cell.isGiven())
        other = self.puzzle.grid.addCell()
        other.setValue(1, ValueSource.ENTERED)
        self.assertTrue(other.isEntered())
        self.assertFalse(other.isGiven())

    def testSetImpossibleValueRaises(self):
        self.cell.remove(3)
        with self.assertRaises(ContradictionError):
            self.cell.setValue(3)

    def testRemove(self):
        self.cell.remove(1)
        self.assertEqual(self.cell.getPossibleValues(), {2, 3})
        self.assertEqual(self.narrowed, [self.cell])
        self.cell.remove(1)  # already gone: no new notification
        self.assertEqual(self.narrowed, [self.cell])

    def testRemoveLastValueRaises(self):
        self.cell.remove(1)
        self.cell.remove(2)
        with self.assertRaises(ContradictionError):
            self.cell.remove(3)

    def testRemoveSetValueRaises(self):
        self.cell.setValue(2)
        with self.assertRaises(ContradictionError):
            self.cell.remove(2)

    def testSinglePossibilityBecomesValue(self):
        self.cell.remove(1)
        self.cell.checkForSinglePossibility()
        self.assertFalse(self.cell.hasValue())
        self.cell.remove(2)
        self.cell.checkForSinglePossibility()
        self.assertEqual(self.cell.getValue(), 3)
        self.assertTrue(self.cell.isInferred())

    def testResetKeepsGroups(self):
        group = self.puzzle.addConstraintGroup("Group")
        group.addCell(self.cell)
        self.cell.setValue(1)
        self.cell.reset()
        self.assertFalse(self.cell.hasValue())
        self.assertEqual(self.cell.getPossibleValues(), {1, 2, 3})
        self.assertEqual(self.cell.getConstraintGroups(), [group])


class GridTest(unittest.TestCase):
    def testPositionedCells(self):
        puzzle = Puzzle("test", {1, 2})
        cell = puzzle.grid.addCell(Position(2, 3))
        self.assertIsInstance(cell, PositionedCell)
        self.assertEqual(cell.getName(), "2, 3")
        self.assertIs(puzzle.grid.searchCellWithPosition(Position(2, 3)), cell)
        self.assertIs(cell.getGrid().getPuzzle(), puzzle)

    def testSquareGridIsRowMajor(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        cells = sudoku.grid.getCells()
        self.assertEqual(len(cells), 81)
        self.assertIs(sudoku.grid.getCellFromSquareGrid(0, 0), cells[0])
        self.assertIs(sudoku.grid.getCellFromSquareGrid(8, 0), cells[8])
        self.assertIs(sudoku.grid.getCellFromSquareGrid(0, 1), cells[9])
        self.assertIs(sudoku.grid.getCellFromSquareGrid(8, 8), cells[80])


class ConstraintGroupTest(unittest.TestCase):
    def testCellsKnowTheirGroups(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        cell = sudoku.grid.getCellFromSquareGrid(4, 4)
        names = sorted(g.getName() for g in cell.getConstraintGroups())
        self.assertEqual(names, ["Block 5", "Column 5", "Row 5"])
        for group in cell.getConstraintGroups():
            self.assertIn(cell, group.getCells())

    def testGroupsAddedByParserAreKnownToCells(self):
        # the futoshiki factory adds cells through ConstraintGroup.addCell
        puzzle = PuzzleFactory.createFutoshikiPuzzle(4)
        for cell in puzzle.grid.getCells():
            self.assertEqual(len(cell.getConstraintGroups()), 2)

    def testGroupValuesComeFromThePuzzle(self):
        puzzle = Puzzle("test", {1, 2, 3})
        group = puzzle.addConstraintGroup("Group")
        self.assertEqual(sorted(group.getValues()), [1, 2, 3])
        constraint = group.addConstraint(UniqueValueConstraint)
        self.assertEqual(sorted(constraint.values), [1, 2, 3])

    def testPlacedValueIsRemovedFromPeers(self):
        puzzle = Puzzle("test", {1, 2, 3})
        group = puzzle.addConstraintGroup("Group")
        group.addConstraint(UniqueValueConstraint)
        cells = [puzzle.grid.addCell() for _ in range(3)]
        for cell in cells:
            group.addCell(cell)
        cells[0].setValue(2)
        self.assertEqual(cells[1].getPossibleValues(), {1, 3})
        self.assertEqual(cells[2].getPossibleValues(), {1, 3})


class PuzzleStateTest(unittest.TestCase):
    def testRestoreUndoesChanges(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        state = sudoku.saveState()
        cell = sudoku.grid.getCellFromSquareGrid(0, 0)
        peer = sudoku.grid.getCellFromSquareGrid(5, 0)
        cell.setValue(4)
        self.assertNotIn(4, peer.getPossibleValues())
        self.assertNotEqual(sudoku.saveState(), state)

        sudoku.restoreState(state)
        self.assertFalse(cell.hasValue())
        self.assertIn(4, peer.getPossibleValues())
        self.assertEqual(sudoku.saveState(), state)

    def testRestoreOnlyNotifiesChangedCells(self):
        sudoku = PuzzleFactory.createEmptySudoku()
        state = sudoku.saveState()
        cell = sudoku.grid.getCellFromSquareGrid(0, 0)
        cell.setValue(4)
        notified = []
        for c in sudoku.grid.getCells():
            c.possibleValuesChanged.connect(notified.append)
            c.valueChanged.connect(notified.append)
        sudoku.restoreState(state)
        # the cell itself plus the 20 cells in its row, column and block
        self.assertEqual(len(notified), 21)
        self.assertEqual(len(set(notified)), 21)


if __name__ == "__main__":
    unittest.main()
