"""Headless smoke tests: construct each puzzle GUI and load its example puzzle.

Runs with QT_QPA_PLATFORM=offscreen (set below as a default), so no display is needed.
"""

import importlib
import os
import unittest
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import shiboken6  # noqa: E402
from PySide6 import QtCore, QtGui, QtTest, QtWidgets  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent


class GuiSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
        # The *Main.py modules open their example puzzles with relative paths.
        cls._old_cwd = os.getcwd()
        os.chdir(REPO_ROOT)

    @classmethod
    def tearDownClass(cls):
        os.chdir(cls._old_cwd)

    def _smoke(self, module_name, puzzle_file):
        module = importlib.import_module(module_name)
        window = module.MainWindow()
        try:
            window.loadPuzzle(puzzle_file)
            window.show()
            self.app.processEvents()
            self.assertTrue(window.isVisible())
            icon = window.windowIcon()
            self.assertFalse(icon.isNull(), "window icon (logo) is missing")
            self.assertEqual(len(icon.availableSizes()), 4)
            # fixed white background, independent of a (dark) system palette
            self.assertEqual(window.scene.backgroundBrush().color(), QtGui.QColorConstants.White)
        finally:
            window.close()
            window.deleteLater()
            self.app.processEvents()

    def test_sudoku(self):
        self._smoke("sudokuMain", "easySudoku.txt")

    def test_kakuro(self):
        self._smoke("kakuroMain", "mediumKakuro.txt")

    def test_sumbrero(self):
        self._smoke("sumbreroMain", "simpleSumbrero.txt")

    def test_futoshiki(self):
        self._smoke("futoshikiMain", "futoshiki.txt")


class SumbreroWindowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def setUp(self):
        import sumbreroMain

        self.window = sumbreroMain.MainWindow()
        self.window.loadPuzzle(str(REPO_ROOT / "simpleSumbrero.txt"))
        self.addCleanup(self.window.deleteLater)
        self.addCleanup(self.window.close)
        assert self.window.puzzle is not None
        self.puzzle = self.window.puzzle

    def test_clues_sit_in_the_wedge_facing_their_line(self):
        from math import sqrt

        from PySide6 import QtCore

        import sumbreroMain
        from gui.puzzlerepresentation.cluehexagon import ClueHexagon

        layout = sumbreroMain.clueLayout(self.puzzle)
        self.assertEqual(len(layout), len(self.puzzle.getConstraintGroups()))
        for constraint, (position, direction) in layout.items():
            hexagon = self.window.puzzlePieces[constraint]
            self.assertIsInstance(hexagon, ClueHexagon)
            self.assertIs(self.window.clueHexagons[position], hexagon)
            self.assertIs(hexagon.clues[direction], constraint)

            text = hexagon.textItems[direction]
            self.assertEqual(text.text(), str(constraint.getTotalValue()))
            center = text.mapToScene(text.boundingRect().center())
            self.assertTrue(
                hexagon.wedge(direction).containsPoint(center, QtCore.Qt.FillRule.OddEvenFill)
            )
            # the text fits in the circle inscribed in the wedge (a triangle with side size / 2)
            self.assertLess(text.font().pixelSize(), hexagon.size / 2 / sqrt(3))

    def test_clues_sit_just_before_their_line(self):
        from constraints import TotalSumValueConstraint
        from parsers.sumbrero import ASCENDING_ROW, COLUMN, DESCENDING_ROW, neighbour
        from sumbreroMain import clueLayout

        layout = clueLayout(self.puzzle)
        self.assertEqual(len(layout), len(self.puzzle.getConstraintGroups()))
        cellPositions = {c.getPosition() for c in self.puzzle.getGrid().getCells()}
        for group in self.puzzle.getConstraintGroups():
            constraint = next(
                c for c in group.getConstraints() if isinstance(c, TotalSumValueConstraint)
            )
            position, direction = layout[constraint]
            self.assertNotIn(position, cellPositions)
            # one step in the wedge's direction leads to the first cell of the line
            first = neighbour(position, direction)
            self.assertIn(first, [c.getPosition() for c in group.getCells()])
            expected = {COLUMN: "S", DESCENDING_ROW: "SE", ASCENDING_ROW: "NE"}
            self.assertEqual(direction, expected[group.getName().rsplit(" ", 1)[0]])
        # no two lines share a wedge
        self.assertEqual(len(set(layout.values())), len(layout))
        # some hexagons hold more than one sum, like in a Kakuro
        positions = [position for position, _direction in layout.values()]
        self.assertLess(len(set(positions)), len(positions))

    def test_black_hexagons_frame_the_cells(self):
        cells = {cell.getPosition() for cell in self.puzzle.getGrid().getCells()}
        frame = set(self.window.clueHexagons)
        self.assertFalse(cells & frame)
        from parsers.sumbrero import neighbour as hexNeighbour

        for position in cells:
            for direction in ("N", "S", "NE", "SE", "NW", "SW"):
                neighbour = hexNeighbour(position, direction)
                self.assertTrue(neighbour in cells or neighbour in frame)

    def test_solve_button_fills_in_the_cells(self):
        self.window.solveButtonClicked()
        self.assertTrue(self.puzzle.isSolved())
        for cell in self.puzzle.getGrid().getCells():
            piece = self.window.puzzlePieces[cell]
            self.assertEqual(piece.valueTextItem.toPlainText(), str(cell.getValue()))
            self.assertEqual(piece.valueTextItem.opacity(), 1)


class SelectionHighlightTest(unittest.TestCase):
    """Selecting an item in the puzzle tree colours its cells and explains it below the tree."""

    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def setUp(self):
        import sudokuMain

        self.window = sudokuMain.MainWindow()
        self.window.loadPuzzle(str(REPO_ROOT / "easySudoku.txt"))
        self.window.show()
        self.addCleanup(self.window.deleteLater)
        self.addCleanup(self.window.close)
        assert self.window.puzzle is not None
        self.puzzle = self.window.puzzle
        self.model = self.window.constraintModel
        self.puzzleIndex = self.model.index(0, 0, QtCore.QModelIndex())

    def select(self, index):
        self.window.ui.puzzleTreeView.setCurrentIndex(index)
        # let the highlight animation (200 ms) finish
        QtTest.QTest.qWait(400)

    def brushColor(self, cell):
        return self.window.puzzlePieces[cell].brush().color()

    def test_group_colours_open_and_solved_cells(self):
        from gui.highlighting import HighlightRole, roleColor
        from gui.puzzlemodel.puzzletreemodel import ConstraintGroupProxyItem

        label = self.window.selectionInfoLabel
        self.assertIn("Click a cell", label.text())

        blockIndex = self.model.index(1, 0, self.puzzleIndex)  # Block 1
        self.select(blockIndex)
        blockItem = self.model.getItem(blockIndex)
        self.assertIsInstance(blockItem, ConstraintGroupProxyItem)
        assert isinstance(blockItem, ConstraintGroupProxyItem)
        group = blockItem.constraintGroup
        self.assertIn("Block 1", label.text())
        self.assertIn("still missing", label.text())
        self.assertIn("open cell", label.text())
        for cell in group.getCells():
            role = HighlightRole.SOLVED if cell.hasValue() else HighlightRole.OPEN
            self.assertEqual(self.brushColor(cell), roleColor(role), cell.getName())
        outside = next(c for c in self.puzzle.grid.getCells() if c not in group.getCells())
        self.assertEqual(self.brushColor(outside).alpha(), 0)

        # solving refreshes the colours and the description of the selection
        self.window.solveButtonClicked()
        QtTest.QTest.qWait(400)
        self.assertIn("complete", label.text())
        for cell in group.getCells():
            self.assertEqual(self.brushColor(cell), roleColor(HighlightRole.SOLVED))

    def test_cell_highlights_the_cells_it_shares_a_group_with(self):
        from gui.highlighting import HighlightRole, roleColor
        from gui.puzzlemodel.puzzletreemodel import CellProxyItem

        gridIndex = self.model.index(0, 0, self.puzzleIndex)
        cellIndex = self.model.index(0, 0, gridIndex)
        self.select(cellIndex)
        cellItem = self.model.getItem(cellIndex)
        assert isinstance(cellItem, CellProxyItem)
        cell = cellItem.cell
        self.assertEqual(self.brushColor(cell), roleColor(HighlightRole.SELECTED))
        peers = [c for c, r in self.window.highlightRoles.items() if r == HighlightRole.PEER]
        self.assertEqual(len(peers), 20)  # row, column and block of a Sudoku cell
        self.assertIn("In groups: Block 1, Row 1, Column 1", self.window.selectionInfoLabel.text())

        # deselecting removes the highlight and the description
        self.window.ui.puzzleTreeView.selectionModel().clearSelection()
        QtTest.QTest.qWait(400)
        self.assertEqual(self.brushColor(cell).alpha(), 0)
        self.assertIn("Click a cell", self.window.selectionInfoLabel.text())


class CellInputTest(unittest.TestCase):
    """Clicking a cell selects it; typing a number enters a value in it."""

    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def setUp(self):
        import sudokuMain

        self.window = sudokuMain.MainWindow()
        self.window.resize(1000, 700)
        self.window.loadPuzzle(str(REPO_ROOT / "easySudoku.txt"))
        self.window.show()
        self.app.processEvents()
        self.addCleanup(self.window.deleteLater)
        self.addCleanup(self.window.close)
        assert self.window.puzzle is not None
        self.grid = self.window.puzzle.grid
        self.view = self.window.ui.puzzleGraphicsView

    def click(self, cell):
        center = self.window.puzzlePieces[cell].sceneBoundingRect().center()
        position = self.view.mapFromScene(center)
        QtTest.QTest.mouseClick(
            self.view.viewport(), QtCore.Qt.MouseButton.LeftButton, pos=position
        )
        self.app.processEvents()

    def type(self, key):
        QtTest.QTest.keyClick(self.view, key)
        self.app.processEvents()

    def test_clicking_a_cell_selects_it(self):
        cell = self.grid.getCellFromSquareGrid(4, 2)
        self.click(cell)
        self.assertIs(self.window.selectedCell(), cell)
        tree = self.window.ui.puzzleTreeView
        self.assertEqual(tree.currentIndex(), self.window.cellIndexes[cell])
        self.assertIn(f"Cell {cell.getName()}", self.window.selectionInfoLabel.text())
        self.assertTrue(self.view.hasFocus())

        # clicking next to the puzzle clears the selection
        corner = self.view.mapFromScene(self.window.scene.itemsBoundingRect().bottomRight())
        QtTest.QTest.mouseClick(
            self.view.viewport(),
            QtCore.Qt.MouseButton.LeftButton,
            pos=corner + QtCore.QPoint(20, 20),
        )
        self.assertIsNone(self.window.selectedCell())

    def test_typing_enters_changes_and_clears_a_value(self):
        from gui.puzzlerepresentation.valuerectangle import ENTERED_VALUE_COLOR

        cell = self.grid.getCellFromSquareGrid(0, 0)  # candidates 4 and 7
        self.click(cell)
        self.type(QtCore.Qt.Key.Key_4)
        self.assertEqual(cell.getValue(), 4)
        self.assertTrue(cell.isEntered())
        piece = self.window.puzzlePieces[cell]
        self.assertEqual(piece.valueTextItem.toPlainText(), "4")
        self.assertEqual(piece.valueTextItem.defaultTextColor(), ENTERED_VALUE_COLOR)
        self.assertIn("Value: 4 (entered)", self.window.selectionInfoLabel.text())

        self.type(QtCore.Qt.Key.Key_7)
        self.assertEqual(cell.getValue(), 7)

        self.type(QtCore.Qt.Key.Key_Delete)
        self.assertIsNone(cell.getValue())
        self.assertEqual(cell.getPossibleValues(), {4, 7})
        self.assertEqual(piece.valueTextItem.opacity(), 0)

    def test_given_cells_cannot_be_changed(self):
        given = self.grid.getCellFromSquareGrid(1, 0)
        self.click(given)
        self.type(QtCore.Qt.Key.Key_4)
        self.assertEqual(given.getValue(), 6)
        self.assertIn("is given", self.window.selectionInfoLabel.text())

        self.click(self.grid.getCellFromSquareGrid(0, 0))
        self.assertNotIn("is given", self.window.selectionInfoLabel.text())

    def test_a_mistake_is_shown_in_red_with_the_cells_it_clashes_with(self):
        from gui.puzzlerepresentation.valuerectangle import (
            ENTERED_VALUE_COLOR,
            VIOLATION_COLOR,
        )

        cell = self.grid.getCellFromSquareGrid(0, 0)  # candidates 4 and 7
        given = self.grid.getCellFromSquareGrid(1, 0)  # the 6 in the same row
        piece, givenPiece = self.window.puzzlePieces[cell], self.window.puzzlePieces[given]
        givenColor = givenPiece.valueTextItem.defaultTextColor()

        self.click(cell)
        self.type(QtCore.Qt.Key.Key_6)
        # the mistake is shown, but not set in the puzzle
        self.assertIsNone(cell.getValue())
        self.assertEqual(piece.valueTextItem.toPlainText(), "6")
        self.assertEqual(piece.valueTextItem.opacity(), 1)
        self.assertEqual(piece.valueTextItem.defaultTextColor(), VIOLATION_COLOR)
        self.assertEqual(givenPiece.valueTextItem.defaultTextColor(), VIOLATION_COLOR)
        self.assertIn(
            f"6 breaks a rule together with cell(s) {given.getName()}",
            self.window.selectionInfoLabel.text(),
        )

        # fixing it turns both back to their normal colours
        self.type(QtCore.Qt.Key.Key_4)
        self.assertEqual(cell.getValue(), 4)
        self.assertEqual(piece.valueTextItem.defaultTextColor(), ENTERED_VALUE_COLOR)
        self.assertEqual(givenPiece.valueTextItem.defaultTextColor(), givenColor)
        self.assertNotIn("breaks a rule", self.window.selectionInfoLabel.text())

        # a mistake can be cleared too
        self.type(QtCore.Qt.Key.Key_6)
        self.type(QtCore.Qt.Key.Key_Delete)
        self.assertEqual(piece.valueTextItem.opacity(), 0)
        self.assertEqual(givenPiece.valueTextItem.defaultTextColor(), givenColor)

    def test_typing_in_the_tree_enters_a_value_too(self):
        cell = self.grid.getCellFromSquareGrid(0, 0)
        self.window.selectCell(cell)
        QtTest.QTest.keyClick(self.window.ui.puzzleTreeView, QtCore.Qt.Key.Key_7)
        self.assertEqual(cell.getValue(), 7)


class LauncherSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def setUp(self):
        import constraintPuzzlerMain

        self.launcherModule = constraintPuzzlerMain
        self.launcher = constraintPuzzlerMain.LauncherWindow()
        self.launcher.show()
        self.app.processEvents()

    def tearDown(self):
        self.launcher.close()
        self.launcher.deleteLater()
        self._flushDeletes()

    def _flushDeletes(self):
        self.app.processEvents()
        QtCore.QCoreApplication.sendPostedEvents(None, QtCore.QEvent.Type.DeferredDelete)

    def test_launcher_shows_version(self):
        from utility.version import getVersion

        self.assertIn(getVersion(), self.launcher.windowTitle())

    def test_smoke_test_flag(self):
        self.assertEqual(self.launcherModule.main(["--smoke-test"]), 0)

    def test_start_page_lists_all_puzzles(self):
        import kakuroMain

        self.assertIs(self.launcher.stack.currentWidget(), self.launcher.startPage)
        buttons = self.launcher.startPage.findChildren(QtWidgets.QPushButton)
        self.assertEqual(len(buttons), len(self.launcherModule.PUZZLES))

        buttons[1].click()  # kakuro
        self.assertEqual(self.launcher.tabs.count(), 1)
        self.assertIs(self.launcher.stack.currentWidget(), self.launcher.tabs)
        self.assertIsInstance(self.launcher.tabs.widget(0), kakuroMain.MainWindow)

    def test_open_and_close_tabs(self):
        names = list(self.launcherModule.PUZZLES)
        windows = [self.launcher.openPuzzle(name) for name in names]
        self.launcher.openPuzzle("sudoku")  # a second puzzle of the same type
        self.app.processEvents()
        self.assertEqual(self.launcher.tabs.count(), len(names) + 1)
        for window in windows:
            self.assertTrue(window.embedded)
            self.assertFalse(window.menuBar().isVisible())

        first = windows[0]
        self.launcher.closeTab(0)
        self._flushDeletes()
        self.assertEqual(self.launcher.tabs.count(), len(names))
        self.assertFalse(shiboken6.isValid(first))

        while self.launcher.tabs.count():
            self.launcher.closeCurrentTab()
        self._flushDeletes()
        self.assertIs(self.launcher.stack.currentWidget(), self.launcher.startPage)
        self.assertFalse(self.launcher.closeTabAction.isEnabled())

        # the shared settings must not call into deleted tabs
        self.launcher.allowGuessingAction.setChecked(True)
        self.assertTrue(self.launcher.settings.allowGuessing)

    def test_allow_guessing_is_shared(self):
        sudoku = self.launcher.openPuzzle("sudoku")
        futoshiki = self.launcher.openPuzzle("futoshiki")
        self.assertIs(sudoku.settings, self.launcher.settings)
        self.assertIs(futoshiki.settings, self.launcher.settings)

        self.launcher.allowGuessingAction.setChecked(True)
        self.assertTrue(sudoku.allowGuessingAction.isChecked())
        for window in (sudoku, futoshiki):
            window.solveButtonClicked()
            assert window.solver is not None
            self.assertTrue(window.solver.allowGuessing)

        self.launcher.allowGuessingAction.setChecked(False)
        sudoku.solveButtonClicked()
        assert sudoku.solver is not None
        self.assertFalse(sudoku.solver.allowGuessing)

    def test_examples_are_marked_as_examples(self):
        for name, (_label, windowClass) in self.launcherModule.PUZZLES.items():
            self.assertIn(windowClass.defaultExample, windowClass.examples)
            for example in windowClass.examples:
                with self.subTest(puzzle=name, example=example):
                    window = self.launcher.openPuzzle(name, example=example)
                    index = self.launcher.tabs.indexOf(window)
                    title = f"{windowClass.puzzleTypeName} example: {example}"
                    self.assertEqual(self.launcher.tabs.tabText(index), title)
                    self.assertIn(title, window.windowTitle())

        # every example is listed under File > Examples > <puzzle type>
        listed = set()
        for typeAction in self.launcher.examplesMenu.actions():
            typeMenu = typeAction.menu()
            assert isinstance(typeMenu, QtWidgets.QMenu)
            listed |= {(typeMenu.title(), action.text()) for action in typeMenu.actions()}
        expected = {
            (label, example)
            for label, windowClass in self.launcherModule.PUZZLES.values()
            for example in windowClass.examples
        }
        self.assertEqual(listed, expected)

    def test_user_file_is_not_marked_as_example(self):
        window = self.launcher.openPuzzle("sudoku", str(REPO_ROOT / "hardSudoku.txt"))
        index = self.launcher.tabs.indexOf(window)
        self.assertEqual(self.launcher.tabs.tabText(index), "Sudoku - hardSudoku.txt")
        self.assertNotIn("example", window.windowTitle())

    def test_unloadable_file_adds_no_tab(self):
        with self.assertRaises(OSError):
            self.launcher.openPuzzle("sudoku", str(REPO_ROOT / "does-not-exist.txt"))
        self.assertEqual(self.launcher.tabs.count(), 0)


if __name__ == "__main__":
    unittest.main()
