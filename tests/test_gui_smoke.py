"""Headless smoke tests: construct each puzzle GUI and load its example puzzle.

Runs with QT_QPA_PLATFORM=offscreen (set below as a default), so no display is needed.
"""

import importlib
import os
import unittest
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6 import QtWidgets  # noqa: E402

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

    @staticmethod
    def textArea(piece):
        """Scene rectangle covered by the text of a hexagon (centered in its text item)."""
        from PySide6 import QtCore, QtGui

        text = piece.valueTextItem
        metrics = QtGui.QFontMetricsF(text.font())
        width = metrics.horizontalAdvance(text.toPlainText())
        center = text.sceneBoundingRect().center()
        return QtCore.QRectF(
            center.x() - width / 2, center.y() - metrics.height() / 2, width, metrics.height()
        )

    def test_clue_labels_do_not_overlap(self):
        from PySide6 import QtGui

        clues = [
            piece
            for item, piece in self.window.puzzlePieces.items()
            if item not in self.puzzle.getGrid().getCells()
        ]
        self.assertEqual(len(clues), len(self.puzzle.getConstraintGroups()))
        areas = [self.textArea(piece) for piece in clues]
        for i, area in enumerate(areas):
            for other in areas[i + 1 :]:
                self.assertFalse(area.intersects(other))
            for cell in self.puzzle.getGrid().getCells():
                hexagon = self.window.puzzlePieces[cell]
                outline = hexagon.mapToScene(hexagon.polygon())
                self.assertFalse(QtGui.QPolygonF(area).intersects(outline))

    def test_solve_button_fills_in_the_cells(self):
        self.window.solveButtonClicked()
        self.assertTrue(self.puzzle.isSolved())
        for cell in self.puzzle.getGrid().getCells():
            piece = self.window.puzzlePieces[cell]
            self.assertEqual(piece.valueTextItem.toPlainText(), str(cell.getValue()))
            self.assertEqual(piece.valueTextItem.opacity(), 1)


class LauncherSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])

    def test_every_puzzle_window_shows_version(self):
        import constraintPuzzlerMain
        from utility.version import getVersion

        for name in constraintPuzzlerMain.PUZZLES:
            with self.subTest(puzzle=name):
                window = constraintPuzzlerMain.createWindow(name)
                try:
                    window.show()
                    self.app.processEvents()
                    self.assertIn(getVersion(), window.windowTitle())
                    self.assertIn(getVersion(), window.aboutText())
                finally:
                    window.close()
                    window.deleteLater()
                    self.app.processEvents()

    def test_smoke_test_flag(self):
        import constraintPuzzlerMain

        self.assertEqual(constraintPuzzlerMain.main(["--smoke-test"]), 0)

    def test_chooser_lists_all_puzzles(self):
        import constraintPuzzlerMain

        dialog = constraintPuzzlerMain.PuzzleChooserDialog()
        buttons = dialog.findChildren(QtWidgets.QPushButton)
        self.assertEqual(len(buttons), len(constraintPuzzlerMain.PUZZLES))
        buttons[1].click()
        self.assertEqual(dialog.choice, "kakuro")
        dialog.deleteLater()


if __name__ == "__main__":
    unittest.main()
