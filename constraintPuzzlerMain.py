"""Launcher for all puzzle types: the entry point of the standalone executable.

python constraintPuzzlerMain.py                  # choose a puzzle in a dialog
python constraintPuzzlerMain.py --puzzle kakuro  # open a puzzle directly
python constraintPuzzlerMain.py --version
python constraintPuzzlerMain.py --smoke-test     # open and close every puzzle, exit 0 on success
"""

import argparse
import sys
import traceback

from PySide6 import QtWidgets

import futoshikiMain
import kakuroMain
import sudokuMain
import sumbreroMain
from gui.windows.basicmainwindow import BasicMainWindow
from utility.resources import resourcePath
from utility.version import APP_NAME, getVersion

# name -> (button label, window class, example puzzle loaded on start)
PUZZLES: dict[str, tuple[str, type[BasicMainWindow], str]] = {
    "sudoku": ("Sudoku", sudokuMain.MainWindow, "easySudoku.txt"),
    "kakuro": ("Kakuro", kakuroMain.MainWindow, "mediumKakuro.txt"),
    "futoshiki": ("Futoshiki", futoshikiMain.MainWindow, "futoshiki.txt"),
    "sumbrero": ("Sumbrero (work in progress)", sumbreroMain.MainWindow, "simpleSumbrero.txt"),
}


def createWindow(name: str) -> BasicMainWindow:
    _label, windowClass, example = PUZZLES[name]
    window = windowClass()
    window.loadPuzzle(resourcePath(example))
    return window


class PuzzleChooserDialog(QtWidgets.QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.choice: str | None = None
        self.setWindowTitle(f"{APP_NAME} {getVersion()}")

        layout = QtWidgets.QVBoxLayout(self)
        layout.addWidget(QtWidgets.QLabel("Which puzzle do you want to solve?"))
        for name, (label, _windowClass, _example) in PUZZLES.items():
            button = QtWidgets.QPushButton(label)
            button.clicked.connect(lambda _checked=False, n=name: self.choose(n))
            layout.addWidget(button)

    def choose(self, name: str):
        self.choice = name
        self.accept()


def smokeTest(app: QtWidgets.QApplication) -> int:
    """Open every puzzle with its example; used to check a frozen build in CI."""
    try:
        for name in PUZZLES:
            window = createWindow(name)
            window.show()
            app.processEvents()
            window.close()
            window.deleteLater()
            app.processEvents()
    except Exception:
        traceback.print_exc()
        return 1
    return 0


def parseArguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog=APP_NAME, description="Solve number puzzles.")
    parser.add_argument("--version", action="version", version=f"{APP_NAME} {getVersion()}")
    parser.add_argument("--puzzle", choices=PUZZLES, help="open this puzzle type directly")
    parser.add_argument(
        "--smoke-test", action="store_true", help="open and close every puzzle, then exit"
    )
    # Qt may add its own arguments (e.g. -platform); leave those to QApplication.
    args, _unknown = parser.parse_known_args(argv)
    return args


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    args = parseArguments(argv)

    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([sys.argv[0], *argv])
    assert isinstance(app, QtWidgets.QApplication)

    if args.smoke_test:
        return smokeTest(app)

    name = args.puzzle
    if name is None:
        chooser = PuzzleChooserDialog()
        chooser.exec()
        if chooser.choice is None:  # dialog closed without choosing
            return 0
        name = chooser.choice

    window = createWindow(name)  # keep a reference for the lifetime of the event loop
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
