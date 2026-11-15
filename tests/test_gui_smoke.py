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


if __name__ == "__main__":
    unittest.main()
