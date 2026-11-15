"""Launcher for all puzzle types: the entry point of the standalone executable.

One window with a tab per open puzzle; solver settings are shared by all tabs.

python constraintPuzzlerMain.py                  # start page: choose an example puzzle
python constraintPuzzlerMain.py --puzzle kakuro  # open a puzzle type's default example
python constraintPuzzlerMain.py --version
python constraintPuzzlerMain.py --smoke-test     # open and close every example, exit 0 on success
"""

import argparse
import importlib
import sys
import traceback

from PySide6 import QtCore, QtGui, QtWidgets

from gui.settings import PuzzleSettings, addShowHintsAction
from gui.windows.basicmainwindow import BasicMainWindow, appIcon
from utility.puzzletypes import PUZZLE_TYPES
from utility.version import APP_NAME, getVersion


def windowClass(name: str) -> type[BasicMainWindow]:
    """The MainWindow class of a registered puzzle type (see utility.puzzletypes)."""
    cls = importlib.import_module(PUZZLE_TYPES[name].windowModule).MainWindow
    assert issubclass(cls, BasicMainWindow) and cls.puzzleType is PUZZLE_TYPES[name]
    return cls


def createWindow(
    name: str,
    settings: PuzzleSettings | None = None,
    embedded: bool = False,
    path: str | None = None,
    example: str | None = None,
) -> BasicMainWindow:
    """Create the window for a puzzle type and load the puzzle file `path`, or else the
    bundled example `example` (the type's default example when both are None)."""
    window = windowClass(name)(settings=settings, embedded=embedded)
    try:
        if path is not None:
            window.loadPuzzle(path)
        else:
            window.loadExample(example)
    except BaseException:
        window.deleteLater()
        raise
    return window


class StartPage(QtWidgets.QWidget):
    """Shown while no puzzle is open: one button per puzzle type, opening its default example."""

    exampleChosen = QtCore.Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QtWidgets.QVBoxLayout(self)
        layout.addStretch()
        title = QtWidgets.QLabel("Which example puzzle do you want to solve?")
        title.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        for name, puzzleType in PUZZLE_TYPES.items():
            button = QtWidgets.QPushButton(
                f"{puzzleType.label} example: {puzzleType.defaultExample}"
            )
            button.clicked.connect(lambda _checked=False, n=name: self.exampleChosen.emit(n))
            row = QtWidgets.QHBoxLayout()
            row.addStretch()
            row.addWidget(button)
            row.addStretch()
            layout.addLayout(row)
        hint = QtWidgets.QLabel(
            "More examples are in <i>File &gt; Examples</i>; "
            "open your own puzzles with <i>File &gt; Open file</i>."
        )
        hint.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(hint)
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
        self.startPage.exampleChosen.connect(self.openExample)

        self.stack = QtWidgets.QStackedWidget()
        self.stack.addWidget(self.startPage)
        self.stack.addWidget(self.tabs)
        self.setCentralWidget(self.stack)

        self.createMenus()

        exampleTabButton = QtWidgets.QToolButton()
        exampleTabButton.setText("+")
        exampleTabButton.setToolTip("Open an example puzzle")
        exampleTabButton.setMenu(self.examplesMenu)
        exampleTabButton.setPopupMode(QtWidgets.QToolButton.ToolButtonPopupMode.InstantPopup)
        self.tabs.setCornerWidget(exampleTabButton, QtCore.Qt.Corner.TopRightCorner)

        self.updateStartPage()

    def createMenus(self):
        fileMenu = self.menuBar().addMenu("File")
        self.examplesMenu = fileMenu.addMenu("Examples")
        openMenu = fileMenu.addMenu("Open file")
        for name, puzzleType in PUZZLE_TYPES.items():
            typeMenu = self.examplesMenu.addMenu(puzzleType.label)
            for example in puzzleType.examples:
                exampleAction = typeMenu.addAction(example)
                exampleAction.triggered.connect(
                    lambda _checked=False, n=name, e=example: self.openExample(n, e)
                )
            openAction = openMenu.addAction(f"{puzzleType.label}...")
            openAction.triggered.connect(lambda _checked=False, n=name: self.openPuzzleFile(n))
        fileMenu.addSeparator()
        self.closeTabAction = fileMenu.addAction("Close tab")
        self.closeTabAction.setShortcut(QtGui.QKeySequence.StandardKey.Close)
        self.closeTabAction.triggered.connect(self.closeCurrentTab)
        quitAction = fileMenu.addAction("Quit")
        quitAction.setShortcut(QtGui.QKeySequence.StandardKey.Quit)
        quitAction.setMenuRole(QtGui.QAction.MenuRole.QuitRole)
        quitAction.triggered.connect(self.close)

        viewMenu = self.menuBar().addMenu("View")
        self.showHintsAction = addShowHintsAction(viewMenu, self.settings)

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

    def openPuzzle(
        self, name: str, path: str | None = None, example: str | None = None
    ) -> BasicMainWindow:
        """Open the puzzle file `path`, or else the bundled example `example` (the default
        example when both are None), in a new tab. Raises on parse errors."""
        window = createWindow(
            name, settings=self.settings, embedded=True, path=path, example=example
        )
        index = self.tabs.addTab(window, window.puzzleTitle or PUZZLE_TYPES[name].label)
        self.tabs.setTabToolTip(index, window.puzzleFile or "")
        self.tabs.setCurrentIndex(index)
        self.updateStartPage()
        return window

    def tryOpenPuzzle(
        self, name: str, path: str | None = None, example: str | None = None
    ) -> BasicMainWindow | None:
        """Like openPuzzle, but reports a puzzle that cannot be loaded in a message box."""
        try:
            return self.openPuzzle(name, path, example)
        except Exception as e:
            QtWidgets.QMessageBox.warning(
                self, "Cannot open puzzle", f"The puzzle could not be loaded:\n\n{e}"
            )
            return None

    def openExample(self, name: str, example: str | None = None):
        self.tryOpenPuzzle(name, example=example)

    def openPuzzleFile(self, name: str):
        puzzleType = PUZZLE_TYPES[name]
        fileName, _filter = QtWidgets.QFileDialog.getOpenFileName(
            self, f"Open {puzzleType.label}", "", puzzleType.fileFilter
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
    """Open every example puzzle in a tab and close it again; used to check a frozen build."""
    try:
        launcher = LauncherWindow()
        launcher.show()
        expected = 0
        for name, puzzleType in PUZZLE_TYPES.items():
            for example in puzzleType.examples:
                launcher.openPuzzle(name, example=example)
                expected += 1
                app.processEvents()
        if launcher.tabs.count() != expected:
            raise RuntimeError(f"expected {expected} tabs, got {launcher.tabs.count()}")
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
    parser.add_argument(
        "--puzzle", choices=PUZZLE_TYPES, help="open this puzzle type's default example directly"
    )
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
