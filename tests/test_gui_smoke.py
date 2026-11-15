"""Headless smoke tests: construct each puzzle GUI and load its example puzzle.

Runs with QT_QPA_PLATFORM=offscreen (set below as a default), so no display is needed.
"""

import importlib
import os
import unittest
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import shiboken6  # noqa: E402
from PySide6 import QtCore, QtGui, QtWidgets  # noqa: E402

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

    def test_black_hexagons_frame_the_cells(self):
        cells = {cell.getPosition() for cell in self.puzzle.getGrid().getCells()}
        frame = set(self.window.clueHexagons)
        self.assertFalse(cells & frame)
        import sumbreroMain

        for position in cells:
            for direction in ("N", "S", "NE", "SE", "NW", "SW"):
                neighbour = sumbreroMain.neighbour(position, direction)
                self.assertTrue(neighbour in cells or neighbour in frame)

    def test_solve_button_fills_in_the_cells(self):
        self.window.solveButtonClicked()
        self.assertTrue(self.puzzle.isSolved())
        for cell in self.puzzle.getGrid().getCells():
            piece = self.window.puzzlePieces[cell]
            self.assertEqual(piece.valueTextItem.toPlainText(), str(cell.getValue()))
            self.assertEqual(piece.valueTextItem.opacity(), 1)


class FutoshikiWindowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def setUp(self):
        import futoshikiMain

        self.window = futoshikiMain.MainWindow()
        self.window.loadPuzzle(str(REPO_ROOT / "futoshiki.txt"))
        self.addCleanup(self.window.deleteLater)
        self.addCleanup(self.window.close)
        assert self.window.puzzle is not None
        self.puzzle = self.window.puzzle

    def test_every_inequality_has_a_sign_pointing_to_the_lesser_cell(self):
        from math import hypot

        from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint

        inequalities = [
            c for c in self.puzzle.getConstraints() if isinstance(c, CellGreaterThanCellConstraint)
        ]
        self.assertEqual(len(inequalities), 24)  # the relations in futoshiki.txt
        self.assertEqual(set(self.window.inequalitySigns), set(inequalities))

        cellRects = [piece.sceneBoundingRect() for piece in self.window.puzzlePieces.values()]
        for constraint, sign in self.window.inequalitySigns.items():
            greater = self.window.puzzlePieces[constraint.greaterCell].rect().center()
            lesser = self.window.puzzlePieces[constraint.lesserCell].rect().center()

            def distance(a, b):
                return hypot(a.x() - b.x(), a.y() - b.y())

            self.assertLess(distance(sign.tip, lesser), distance(sign.tip, greater))
            # the sign is drawn in the gap between the cells, not on top of one
            outline = sign.path().boundingRect()
            for rect in cellRects:
                self.assertFalse(rect.intersects(outline), constraint)

    def test_example_relation_is_drawn_between_the_right_cells(self):
        # futoshiki.txt: "2,1>3,1" (1-based x,y): (2,1) is greater than its right neighbour
        greater = self.puzzle.grid.getCellFromSquareGrid(1, 0)
        lesser = self.puzzle.grid.getCellFromSquareGrid(2, 0)
        (sign,) = [
            s
            for c, s in self.window.inequalitySigns.items()
            if c.greaterCell is greater and c.lesserCell is lesser
        ]
        greaterRect = self.window.puzzlePieces[greater].rect()
        lesserRect = self.window.puzzlePieces[lesser].rect()
        self.assertGreater(sign.tip.x(), greaterRect.right())
        self.assertLess(sign.tip.x(), lesserRect.left())
        self.assertAlmostEqual(sign.tip.y(), greaterRect.center().y())


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
