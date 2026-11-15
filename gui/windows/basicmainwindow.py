"""
Created on 26 jan. 2013

@author: Juice
"""

import platform
from collections.abc import Callable

import PySide6
from PySide6 import QtCore, QtGui, QtStateMachine, QtWidgets

import gui.icons.icons_rc  # noqa: F401 -- registers the :/icons/* resources
from gui.puzzlemodel.puzzletreemodel import (
    CellProxyItem,
    ConstraintGroupProxyItem,
    ConstraintProxyItem,
    ConstraintPuzzleModel,
    GridProxyItem,
    ReferencedCellProxyItem,
    buildPuzzleTree,
)
from gui.settings import PuzzleSettings
from gui.ui import mainWindowUi
from solver.Solver import Solver
from structure.errors import ContradictionError
from structure.puzzle import Puzzle
from utility.version import APP_NAME, getVersion


def appIcon() -> QtGui.QIcon:
    """The ConstraintPuzzler logo, at every size bundled in the icon resources."""
    icon = QtGui.QIcon()
    for size in (16, 32, 64, 256):
        icon.addFile(f":/icons/appIcon{size}", QtCore.QSize(size, size))
    return icon


class BasicMainWindow(QtWidgets.QMainWindow):
    #    MaxRecentFiles = 5
    #    windowList = []

    acceptedFileExtensios = [(".puzzle", "Generic constraint puzzle format")]

    # Set by subclasses: shown in the File menu and the open-file dialog
    puzzleTypeName = "Puzzle"
    fileFilter = "Puzzle Files (*.txt)"
    # Reads a puzzle file into a Puzzle; subclasses set it to one of the `parsers` functions
    puzzleParser: Callable[[str], Puzzle] | None = None

    showNextSelectionState = QtCore.Signal()

    # Set by subclasses in initializePuzzleRepresentation()
    scene: QtWidgets.QGraphicsScene
    puzzlePieces: dict
    selectedItems: set

    def __init__(self, settings: PuzzleSettings | None = None, embedded: bool = False):
        """Create a puzzle window.

        settings: solver settings, shared with other puzzles (a new instance when omitted).
        embedded: the window is a page inside another window (a launcher tab), which provides
        the menus; this window then hides its own menu and status bar.
        """
        super().__init__()
        self.settings = settings if settings is not None else PuzzleSettings(self)
        self.embedded = embedded
        self.puzzleFile: str | None = None
        self.ui = mainWindowUi.Ui_MainWindow()
        self.ui.setupUi(self)

        self.setWindowTitle(f"{APP_NAME} {getVersion()}")
        self.setWindowIcon(appIcon())

        #        self.recentFileActs = []
        #
        #        self.setAttribute(QtCore.Qt.WA_DeleteOnClose)
        #
        #        self.view = QtGui.QGraphicsView(self)
        #        self.setCentralWidget(self.view)
        #

        self.selectionState = QtStateMachine.QState()
        self.currentSelectionState = QtStateMachine.QState(self.selectionState)
        self.previousSelectionState = QtStateMachine.QState(self.selectionState)

        self.selectionStatemachine = QtStateMachine.QStateMachine()
        self.selectionStatemachine.addState(self.selectionState)
        self.selectionStatemachine.setInitialState(self.selectionState)
        self.selectionState.setInitialState(self.currentSelectionState)

        self.ui.solvePushButton.clicked.connect(self.solveButtonClicked)

        self.selectionStatemachine.addTransition(
            self.showNextSelectionState, self.currentSelectionState
        )
        self.showNextSelectionState.emit()
        self.trans1 = self.currentSelectionState.addTransition(
            self.showNextSelectionState, self.previousSelectionState
        )
        self.trans2 = self.previousSelectionState.addTransition(
            self.showNextSelectionState, self.currentSelectionState
        )

        self.selectionStatemachine.start()
        self.puzzle = None
        self.solver = None

        self.createActions()
        self.createMenus()
        self.createSolverMenu()
        self.createHelpMenu()
        self.createStatusBar()

        if embedded:
            self.setWindowFlags(QtCore.Qt.WindowType.Widget)
            self.menuBar().hide()
            self.statusBar().hide()
            # keep the structure dock inside the tab: it can neither float away nor be closed
            self.ui.puzzleStructureDockWidget.setFeatures(
                QtWidgets.QDockWidget.DockWidgetFeature.DockWidgetMovable
            )

    #
    #        self.setWindowTitle("Constraints solver")
    #        self.resize(800, 600)

    def loadPuzzle(self, filename):
        self.puzzle, self.solver = self.parsePuzzle(filename)
        self.puzzleFile = filename

        # create a new PuzzleModel, presenting the puzzle in the tree view
        self.constraintModel = ConstraintPuzzleModel()
        buildPuzzleTree(self.puzzle, self.constraintModel.getItem(QtCore.QModelIndex()))
        self.ui.puzzleTreeView.setModel(self.constraintModel)

        m = self.ui.puzzleTreeView.selectionModel()
        m.selectionChanged.connect(self.showSelectionInPuzzleView)

        # one animation proxy per cell of the current puzzle
        self.puzzlePieceProxies = {}
        self.initializePuzzleRepresentation()
        # The puzzle is drawn in black on a transparent background, so with a dark palette it
        # would be black on black. Give the puzzle a fixed white background regardless of theme.
        self.scene.setBackgroundBrush(QtGui.QBrush(QtGui.QColorConstants.White))
        self.ui.puzzleGraphicsView.setScene(self.scene)

    def parsePuzzle(self, filename) -> tuple[Puzzle, Solver]:
        """Reads filename with puzzleParser and returns the puzzle with a solver for it."""
        parser = type(self).puzzleParser
        if parser is None:
            raise NotImplementedError(
                "Set puzzleParser to enable loading of puzzles through the main menu"
            )
        puzzle = parser(filename)
        return puzzle, Solver(puzzle)

    def createActions(self):
        pass

    def createMenus(self):
        fileMenu = self.menuBar().addMenu("File")
        openAction = fileMenu.addAction(f"Open {self.puzzleTypeName}...")
        openAction.triggered.connect(self.openPuzzleDialog)

    def openPuzzleDialog(self):
        fileName, _filter = QtWidgets.QFileDialog.getOpenFileName(
            self, f"Open {self.puzzleTypeName}", "", self.fileFilter
        )
        if fileName:
            self.loadPuzzle(fileName)

    def createSolverMenu(self):
        solverMenu = self.menuBar().addMenu("Solver")
        self.allowGuessingAction = solverMenu.addAction("Allow guessing (backtracking)")
        self.allowGuessingAction.setCheckable(True)
        self.allowGuessingAction.setChecked(self.settings.allowGuessing)
        self.allowGuessingAction.toggled.connect(self.settings.setAllowGuessing)
        self.settings.allowGuessingChanged.connect(self.allowGuessingAction.setChecked)

    def createHelpMenu(self):
        helpMenu = self.menuBar().addMenu("Help")
        aboutAction = helpMenu.addAction(f"About {APP_NAME}")
        aboutAction.setMenuRole(QtGui.QAction.MenuRole.AboutRole)
        aboutAction.triggered.connect(self.showAbout)

    @staticmethod
    def aboutText():
        return (
            f"<h3>{APP_NAME} {getVersion()}</h3>"
            "<p>Solves number puzzles by constraint propagation.</p>"
            f"<p>Python {platform.python_version()}<br>"
            f"PySide6 {PySide6.__version__}<br>"
            f"Qt {QtCore.qVersion()}</p>"
        )

    def showAbout(self):
        QtWidgets.QMessageBox.about(self, f"About {APP_NAME}", self.aboutText())

    def createStatusBar(self):
        pass

    def showSelectionInPuzzleView(self, selectedItems, deselectedItems):
        selectionChanged = False

        # update the selected cells:
        for itemRange in selectedItems:
            index = itemRange.topLeft()
            index = index.sibling(index.row(), 0)
            # iterate the ranges in this row
            while True:
                if index == QtCore.QModelIndex():
                    break
                if not index.isValid():
                    break

                item = self.constraintModel.getItem(index)
                if isinstance(
                    item,
                    (
                        ConstraintProxyItem,
                        CellProxyItem,
                        ReferencedCellProxyItem,
                        GridProxyItem,
                        ConstraintGroupProxyItem,
                    ),
                ):
                    # self.selectedCells |= item.getCells()
                    selectionChanged = True
                    self.selectedItems.add(item)

                # check whether to calculate the next index
                if index.row() + 1 < itemRange.bottomRight().row():
                    index = index.sibling(index.row() + 1, 0)
                else:
                    break

        # remove the de-selected cells:
        for itemRange in deselectedItems:
            index = itemRange.topLeft()
            index = index.sibling(index.row(), 0)
            # iterate the ranges in this row
            while True:
                if index == QtCore.QModelIndex():
                    break
                if not index.isValid():
                    break

                item = self.constraintModel.getItem(index)
                if item in self.selectedItems:
                    self.selectedItems.remove(item)
                    selectionChanged = True
                # check whether to calculate the next index
                if index.row() + 1 < itemRange.bottomRight().row():
                    index = index.sibling(index.row() + 1, 0)
                else:
                    break

        if selectionChanged:
            # first copy the reference to the current state to the previous state

            self.trans1, self.trans2 = self.trans2, self.trans1

            self.previousSelectionState, self.currentSelectionState = (
                self.currentSelectionState,
                self.previousSelectionState,
            )

            selectedCells = set()

            for item in self.selectedItems:
                selectedCells |= item.getCells()

            group = QtCore.QParallelAnimationGroup()

            for cell in self.puzzlePieceProxies:
                # it = self.puzzlePieces[cell]
                it = self.puzzlePieceProxies[cell]

                animation = QtCore.QPropertyAnimation(
                    it, QtCore.QByteArray(b"backgroundColor"), self
                )

                animation.setDuration(200)
                animation.setEasingCurve(QtCore.QEasingCurve.Type.InOutQuad)

                group.addAnimation(animation)

                if cell in selectedCells:
                    self.currentSelectionState.assignProperty(
                        it, "backgroundColor", QtGui.QColor(255, 255, 0, 100)
                    )
                else:
                    self.currentSelectionState.assignProperty(
                        it, "backgroundColor", QtGui.QColor(255, 255, 0, 0)
                    )

            for anim in self.trans1.animations():
                self.trans1.removeAnimation(anim)

            self.trans1.addAnimation(group)

            self.showNextSelectionState.emit()

    def solveButtonClicked(self):
        if self.solver is not None:
            self.solver.allowGuessing = self.settings.allowGuessing
            try:
                self.solver.solve()
            except ContradictionError as e:
                QtWidgets.QMessageBox.warning(
                    self,
                    "Puzzle cannot be solved",
                    "The solver ran into a contradiction:\n\n" + str(e),
                )

    def undo(self):
        pass

    def redo(self):
        pass

    def cellPossibleValuesChanged(self, cell):
        self.puzzlePieces[cell].updateRepresentation()

    def initializePuzzleRepresentation(self):
        raise NotImplementedError

    def updatePuzzleRepresentation(self):
        pass

    def cellHintValuesChanged(self, cell, value):
        pass

    def cellValueChanged(self, cell):
        self.puzzlePieces[cell].updateRepresentation()
