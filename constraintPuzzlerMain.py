"""Launcher for all puzzle types: the entry point of the standalone executable.

One window with a tab per open puzzle; solver settings are shared by all tabs.

python constraintPuzzlerMain.py                  # start page: choose a puzzle
python constraintPuzzlerMain.py --puzzle kakuro  # open a puzzle directly
python constraintPuzzlerMain.py --version
python constraintPuzzlerMain.py --smoke-test     # open and close every puzzle, exit 0 on success
"""

import argparse
import sys
import traceback
from pathlib import Path

from PySide6 import QtCore, QtGui, QtWidgets

import futoshikiMain
import kakuroMain
import sudokuMain
import sumbreroMain
from gui.settings import PuzzleSettings
from gui.windows.basicmainwindow import BasicMainWindow, appIcon
from utility.resources import resourcePath
from utility.version import APP_NAME, getVersion

# name -> (button label, window class, example puzzle loaded on start)
PUZZLES: dict[str, tuple[str, type[BasicMainWindow], str]] = {
    "sudoku": ("Sudoku", sudokuMain.MainWindow, "easySudoku.txt"),
    "kakuro": ("Kakuro", kakuroMain.MainWindow, "mediumKakuro.txt"),
    "futoshiki": ("Futoshiki", futoshikiMain.MainWindow, "futoshiki.txt"),
    "sumbrero": ("Sumbrero", sumbreroMain.MainWindow, "simpleSumbrero.txt"),
}


def createWindow(
    name: str,
    settings: PuzzleSettings | None = None,
    embedded: bool = False,
    path: str | None = None,
) -> BasicMainWindow:
    """Create the window for a puzzle type and load `path` (its example puzzle by default)."""
    _label, windowClass, example = PUZZLES[name]
    window = windowClass(settings=settings, embedded=embedded)
    try:
        window.loadPuzzle(path if path is not None else resourcePath(example))
    except BaseException:
        window.deleteLater()
        raise
    return window


class StartPage(QtWidgets.QWidget):
    """Shown while no puzzle is open: one button per puzzle type."""

    puzzleChosen = QtCore.Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QtWidgets.QVBoxLayout(self)
        layout.addStretch()
        title = QtWidgets.QLabel("Which puzzle do you want to solve?")
        title.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        for name, (label, _windowClass, _example) in PUZZLES.items():
            button = QtWidgets.QPushButton(label)
            button.clicked.connect(lambda _checked=False, n=name: self.puzzleChosen.emit(n))
            row = QtWidgets.QHBoxLayout()
            row.addStretch()
            row.addWidget(button)
            row.addStretch()
            layout.addLayout(row)
        layout.addStretch()


class LauncherWindow(QtWidgets.QMainWindow):
    """Single application window with one tab per open puzzle."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_NAME} {getVersion()}")
        self.setWindowIcon(appIcon())
        self.resize(1000, 700)

        self.settings = PuzzleSettings(self)

        self.tabs = QtWidgets.QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.setMovable(True)
        self.tabs.setDocumentMode(True)
        self.tabs.tabCloseRequested.connect(self.closeTab)

        self.startPage = StartPage()
        self.startPage.puzzleChosen.connect(self.newPuzzle)

        self.stack = QtWidgets.QStackedWidget()
        self.stack.addWidget(self.startPage)
        self.stack.addWidget(self.tabs)
        self.setCentralWidget(self.stack)

        self.createMenus()

        newTabButton = QtWidgets.QToolButton()
        newTabButton.setText("+")
        newTabButton.setToolTip("New puzzle")
        newTabButton.setMenu(self.newPuzzleMenu)
        newTabButton.setPopupMode(QtWidgets.QToolButton.ToolButtonPopupMode.InstantPopup)
        self.tabs.setCornerWidget(newTabButton, QtCore.Qt.Corner.TopRightCorner)

        self.updateStartPage()

    def createMenus(self):
        fileMenu = self.menuBar().addMenu("File")
        self.newPuzzleMenu = fileMenu.addMenu("New puzzle")
        openMenu = fileMenu.addMenu("Open file")
        for index, (name, (label, windowClass, _example)) in enumerate(PUZZLES.items()):
            newAction = self.newPuzzleMenu.addAction(label)
            newAction.triggered.connect(lambda _checked=False, n=name: self.newPuzzle(n))
            if index == 0:
                newAction.setShortcut(QtGui.QKeySequence.StandardKey.New)
            openAction = openMenu.addAction(f"{windowClass.puzzleTypeName}...")
            openAction.triggered.connect(lambda _checked=False, n=name: self.openPuzzleFile(n))
        fileMenu.addSeparator()
        self.closeTabAction = fileMenu.addAction("Close tab")
        self.closeTabAction.setShortcut(QtGui.QKeySequence.StandardKey.Close)
        self.closeTabAction.triggered.connect(self.closeCurrentTab)
        quitAction = fileMenu.addAction("Quit")
        quitAction.setShortcut(QtGui.QKeySequence.StandardKey.Quit)
        quitAction.setMenuRole(QtGui.QAction.MenuRole.QuitRole)
        quitAction.triggered.connect(self.close)

        solverMenu = self.menuBar().addMenu("Solver")
        self.allowGuessingAction = solverMenu.addAction("Allow guessing (backtracking)")
        self.allowGuessingAction.setCheckable(True)
        self.allowGuessingAction.setChecked(self.settings.allowGuessing)
        self.allowGuessingAction.toggled.connect(self.settings.setAllowGuessing)
        self.settings.allowGuessingChanged.connect(self.allowGuessingAction.setChecked)

        helpMenu = self.menuBar().addMenu("Help")
        aboutAction = helpMenu.addAction(f"About {APP_NAME}")
        aboutAction.setMenuRole(QtGui.QAction.MenuRole.AboutRole)
        aboutAction.triggered.connect(self.showAbout)

    def showAbout(self):
        QtWidgets.QMessageBox.about(self, f"About {APP_NAME}", BasicMainWindow.aboutText())

    def openPuzzle(self, name: str, path: str | None = None) -> BasicMainWindow:
        """Open a puzzle in a new tab (its example when `path` is None). Raises on parse errors."""
        window = createWindow(name, settings=self.settings, embedded=True, path=path)
        label = PUZZLES[name][0]
        fileName = Path(window.puzzleFile).name if window.puzzleFile else ""
        index = self.tabs.addTab(window, f"{label} - {fileName}" if fileName else label)
        self.tabs.setTabToolTip(index, window.puzzleFile or "")
        self.tabs.setCurrentIndex(index)
        self.updateStartPage()
        return window

    def tryOpenPuzzle(self, name: str, path: str | None = None) -> BasicMainWindow | None:
        """Like openPuzzle, but reports a puzzle that cannot be loaded in a message box."""
        try:
            return self.openPuzzle(name, path)
        except Exception as e:
            QtWidgets.QMessageBox.warning(
                self, "Cannot open puzzle", f"The puzzle could not be loaded:\n\n{e}"
            )
            return None

    def newPuzzle(self, name: str):
        self.tryOpenPuzzle(name)

    def openPuzzleFile(self, name: str):
        windowClass = PUZZLES[name][1]
        fileName, _filter = QtWidgets.QFileDialog.getOpenFileName(
            self, f"Open {windowClass.puzzleTypeName}", "", windowClass.fileFilter
        )
        if fileName:
            self.tryOpenPuzzle(name, fileName)

    def puzzleWindows(self) -> list[BasicMainWindow]:
        windows = []
        for index in range(self.tabs.count()):
            widget = self.tabs.widget(index)
            assert isinstance(widget, BasicMainWindow)
            windows.append(widget)
        return windows

    def closeTab(self, index: int):
        widget = self.tabs.widget(index)
        if widget is None:
            return
        self.tabs.removeTab(index)
        widget.close()
        widget.deleteLater()
        self.updateStartPage()

    def closeCurrentTab(self):
        if self.tabs.count():
            self.closeTab(self.tabs.currentIndex())

    def updateStartPage(self):
        hasTabs = self.tabs.count() > 0
        self.stack.setCurrentWidget(self.tabs if hasTabs else self.startPage)
        self.closeTabAction.setEnabled(hasTabs)


def smokeTest(app: QtWidgets.QApplication) -> int:
    """Open every puzzle in a tab and close it again; used to check a frozen build in CI."""
    try:
        launcher = LauncherWindow()
        launcher.show()
        for name in PUZZLES:
            launcher.openPuzzle(name)
            app.processEvents()
        if launcher.tabs.count() != len(PUZZLES):
            raise RuntimeError(f"expected {len(PUZZLES)} tabs, got {launcher.tabs.count()}")
        while launcher.tabs.count():
            launcher.closeTab(0)
            app.processEvents()
        launcher.close()
        launcher.deleteLater()
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

    launcher = LauncherWindow()  # keep a reference for the lifetime of the event loop
    if args.puzzle is not None:
        launcher.tryOpenPuzzle(args.puzzle)
    launcher.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
