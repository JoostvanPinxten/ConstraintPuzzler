"""The base window of every puzzle type: loading a puzzle, the menus, undo and redo, and
drawing the cells. The selection, cell input and solver buttons live in the layers below it
(see gui/windows/windowbase.py)."""

from __future__ import annotations

import os
import platform
from typing import TYPE_CHECKING

import PySide6
from PySide6 import QtCore, QtGui, QtWidgets

import gui.icons.icons_rc  # noqa: F401 -- registers the :/icons/* resources
from gui.puzzlemodel.puzzletreemodel import (
    CellProxyItem,
    ConstraintPuzzleModel,
    buildPuzzleTree,
)
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.settings import PuzzleSettings, addShowHintsAction
from gui.ui import mainWindowUi
from gui.windows.solvingwindow import SolvingWindow
from solver.hints import HintSession
from solver.solver import Solver
from structure.game import Game
from structure.puzzle import Puzzle
from utility.resources import resourcePath
from utility.version import APP_NAME, getVersion

if TYPE_CHECKING:
    from structure.cell import Cell


def appIcon() -> QtGui.QIcon:
    """The ConstraintPuzzler logo, at every size bundled in the icon resources."""
    icon = QtGui.QIcon()
    for size in (16, 32, 64, 256):
        icon.addFile(f":/icons/appIcon{size}", QtCore.QSize(size, size))
    return icon


class BasicMainWindow(SolvingWindow):
    """A puzzle window. Subclasses set puzzleType and implement
    initializePuzzleRepresentation()."""

    def __init__(self, settings: PuzzleSettings | None = None, embedded: bool = False) -> None:
        """Create a puzzle window.

        settings: solver settings, shared with other puzzles (a new instance when omitted).
        embedded: the window is a page inside another window (a launcher tab), which provides
        the menus; this window then hides its own menu and status bar.
        """
        super().__init__()
        self.settings = settings if settings is not None else PuzzleSettings(self)
        self.embedded = embedded
        self.puzzleFile: str | None = None
        # what is loaded, e.g. "Sudoku example: Easy" or "Sudoku - myPuzzle.txt"
        self.puzzleTitle: str | None = None
        self.ui = mainWindowUi.Ui_MainWindow()
        self.ui.setupUi(self)

        self.setWindowTitle(f"{APP_NAME} {getVersion()}")
        self.setWindowIcon(appIcon())

        # Keep the Name column wide enough for the expanded rows (see fitTreeNameColumn). Expanding
        # many rows at once (expandAll) emits one signal per row, so coalesce them into one fit.
        self.fitTreeNameColumnTimer = QtCore.QTimer(self)
        self.fitTreeNameColumnTimer.setSingleShot(True)
        self.fitTreeNameColumnTimer.timeout.connect(self.fitTreeNameColumn)
        self.ui.puzzleTreeView.expanded.connect(self.fitTreeNameColumnTimer.start)

        self.ui.solvePushButton.clicked.connect(self.solveButtonClicked)
        self.ui.solveStepPushButton.clicked.connect(self.solveStepButtonClicked)
        self.ui.hintPushButton.clicked.connect(self.hintButtonClicked)
        self.ui.checkPushButton.clicked.connect(self.checkButtonClicked)
        self.ui.notesPushButton.toggled.connect(lambda _checked: self.updateSelectionInfo())
        self.solveJob = None
        self.highlightAnimation = None
        self.puzzle = None
        self.solver = None
        self.stepMessage = None
        self.hintSession = HintSession()
        self.hintRegion = set()
        self.checkMarks = set()

        self.createMenus()
        self.createEditMenu()
        self.createViewMenu()
        self.createSolverMenu()
        self.createHelpMenu()
        self.createSelectionInfo()
        self.createCellInput()
        self.settings.showHintsChanged.connect(self.applyShowHints)

        if embedded:
            self.setWindowFlags(QtCore.Qt.WindowType.Widget)
            self.menuBar().hide()
            self.statusBar().hide()
            # keep the structure dock inside the tab: it can neither float away nor be closed
            self.ui.puzzleStructureDockWidget.setFeatures(
                QtWidgets.QDockWidget.DockWidgetFeature.DockWidgetMovable
            )

    def loadExample(self, label: str | None = None) -> None:
        """Load a bundled example puzzle (the type's default example when no label is given)."""
        puzzleType = self.puzzleType
        if label is None:
            label = puzzleType.defaultExample
        if label is None or label not in puzzleType.examples:
            raise ValueError(f"{puzzleType.label} has no example {label!r}")
        self.loadPuzzle(
            resourcePath(puzzleType.examples[label]), title=f"{puzzleType.label} example: {label}"
        )

    def loadPuzzle(self, filename: str, title: str | None = None) -> None:
        """Load a puzzle file. ``title`` describes it (default: puzzle type and file name)."""
        self.stopSolving()
        self.puzzle, self.solver = self.parsePuzzle(filename)
        self.puzzleFile = filename
        if title is None:
            title = f"{self.puzzleType.label} - {os.path.basename(filename)}"
        self.puzzleTitle = title
        self.setWindowTitle(f"{APP_NAME} {getVersion()} - {title}")

        # create a new PuzzleModel, presenting the puzzle in the tree view
        self.constraintModel = ConstraintPuzzleModel()
        self.constraintModel.showHints = self.settings.showHints
        buildPuzzleTree(self.puzzle, self.constraintModel.getItem(QtCore.QModelIndex()))
        self.ui.puzzleTreeView.setModel(self.constraintModel)
        self.fitTreeNameColumn()

        m = self.ui.puzzleTreeView.selectionModel()
        m.selectionChanged.connect(self.showSelectionInPuzzleView)

        # one animation proxy per cell of the current puzzle
        self.stopHighlightAnimation()
        self.puzzlePieceProxies = {}
        self.initializePuzzleRepresentation()
        self.applyShowHints(self.settings.showHints)
        self.highlightRoles = {}
        self.game = Game(self.puzzle)
        self.inputMessage = None
        self.resetGuidance()
        self.violations = set()
        # to find the cell under the mouse, and the tree row of a cell
        self.pieceCells = {
            proxy.getPuzzlePiece(): cell for cell, proxy in self.puzzlePieceProxies.items()
        }
        puzzleIndex = self.constraintModel.index(0, 0, QtCore.QModelIndex())
        gridIndex = self.constraintModel.index(0, 0, puzzleIndex)
        self.cellIndexes = {}
        for row in range(self.constraintModel.rowCount(gridIndex)):
            index = self.constraintModel.index(row, 0, gridIndex)
            item = self.constraintModel.getItem(index)
            if isinstance(item, CellProxyItem):
                self.cellIndexes[item.cell] = index
        self.refreshCellStyles()
        self.updateSelectionInfo()
        self.updateUndoActions()
        # The puzzle is drawn in black on a transparent background, so with a dark palette it
        # would be black on black. Give the puzzle a fixed white background regardless of theme.
        self.scene.setBackgroundBrush(QtGui.QBrush(QtGui.QColorConstants.White))
        self.ui.puzzleGraphicsView.setScene(self.scene)

    def fitTreeNameColumn(self) -> None:
        """Widen the tree's Name column to fit its visible rows.

        With the default fixed width, deeply indented rows push their icon past the column
        edge, where it is drawn over the Type text. The column stays resizable by the user.
        """
        self.ui.puzzleTreeView.resizeColumnToContents(0)

    def parsePuzzle(self, filename: str) -> tuple[Puzzle, Solver]:
        """Reads filename with the type's parser and returns the puzzle with a solver for it."""
        puzzle = self.puzzleType.parser(filename)
        return puzzle, Solver(puzzle)

    def createMenus(self) -> None:
        fileMenu = self.menuBar().addMenu("File")
        openAction = fileMenu.addAction(f"Open {self.puzzleType.label}...")
        openAction.setShortcut(QtGui.QKeySequence.StandardKey.Open)
        openAction.triggered.connect(self.openPuzzleDialog)
        if self.puzzleType.examples:
            examplesMenu = fileMenu.addMenu("Examples")
            for label in self.puzzleType.examples:
                action = examplesMenu.addAction(label)
                action.triggered.connect(lambda _checked=False, lbl=label: self.loadExample(lbl))

    def openPuzzleDialog(self) -> None:
        fileName, _filter = QtWidgets.QFileDialog.getOpenFileName(
            self, f"Open {self.puzzleType.label}", "", self.puzzleType.fileFilter
        )
        if fileName:
            self.loadPuzzle(fileName)

    def createEditMenu(self) -> None:
        editMenu = self.menuBar().addMenu("Edit")
        self.undoAction = editMenu.addAction("Undo")
        self.undoAction.triggered.connect(self.undo)
        self.redoAction = editMenu.addAction("Redo")
        self.redoAction.triggered.connect(self.redo)
        # an embedded window's launcher has the shortcuts
        if not self.embedded:
            self.undoAction.setShortcut(QtGui.QKeySequence.StandardKey.Undo)
            self.redoAction.setShortcut(QtGui.QKeySequence.StandardKey.Redo)
        self.updateUndoActions()

    def updateUndoActions(self) -> None:
        game = getattr(self, "game", None)
        idle = getattr(self, "solveJob", None) is None
        self.undoAction.setEnabled(idle and game is not None and game.canUndo())
        self.redoAction.setEnabled(idle and game is not None and game.canRedo())

    def undo(self) -> bool:
        """Undo the last change to the puzzle (an entry or a solver action)."""
        if self.game is None or self.solveJob is not None or not self.game.undo():
            return False
        self.inputMessage = None
        self.puzzleChanged()
        return True

    def redo(self) -> bool:
        if self.game is None or self.solveJob is not None or not self.game.redo():
            return False
        self.inputMessage = None
        self.puzzleChanged()
        return True

    def createViewMenu(self) -> None:
        viewMenu = self.menuBar().addMenu("View")
        # an embedded window's launcher has the shortcut
        self.showHintsAction = addShowHintsAction(
            viewMenu, self.settings, shortcut=not self.embedded
        )

    def applyShowHints(self, show: bool) -> None:
        """Show or hide the candidate values in the cells and in the explanations."""
        if self.puzzle is None:
            return
        for piece in self.puzzlePieces.values():
            # only the cells have hints, not e.g. the Kakuro sum triangles
            setHintsEnabled = getattr(piece, "setHintsEnabled", None)
            if setHintsEnabled is not None:
                setHintsEnabled(show)
        self.constraintModel.showHints = show
        self.updateSelectionInfo()

    def createSolverMenu(self) -> None:
        solverMenu = self.menuBar().addMenu("Solver")
        self.allowGuessingAction = solverMenu.addAction("Allow guessing (backtracking)")
        self.allowGuessingAction.setCheckable(True)
        self.allowGuessingAction.setChecked(self.settings.allowGuessing)
        self.allowGuessingAction.toggled.connect(self.settings.setAllowGuessing)
        self.settings.allowGuessingChanged.connect(self.allowGuessingAction.setChecked)

    def createHelpMenu(self) -> None:
        helpMenu = self.menuBar().addMenu("Help")
        aboutAction = helpMenu.addAction(f"About {APP_NAME}")
        aboutAction.setMenuRole(QtGui.QAction.MenuRole.AboutRole)
        aboutAction.triggered.connect(self.showAbout)

    @staticmethod
    def aboutText() -> str:
        return (
            f"<h3>{APP_NAME} {getVersion()}</h3>"
            "<p>Solves number puzzles by constraint propagation.</p>"
            f"<p>Python {platform.python_version()}<br>"
            f"PySide6 {PySide6.__version__}<br>"
            f"Qt {QtCore.qVersion()}</p>"
        )

    def showAbout(self) -> None:
        QtWidgets.QMessageBox.about(self, f"About {APP_NAME}", self.aboutText())

    def cellPossibleValuesChanged(self, cell: Cell) -> None:
        self.refreshPiece(cell)

    def initializePuzzleRepresentation(self) -> None:
        """Draw the puzzle: start with newScene(), then addCellPiece() for every cell."""
        raise NotImplementedError

    def newScene(self) -> None:
        """Start drawing a puzzle on a new, empty scene."""
        self.scene = QtWidgets.QGraphicsScene(self)
        self.puzzlePieces = {}
        self.selectedItems = set()

    def addCellPiece(self, cell: Cell, piece: QtWidgets.QAbstractGraphicsShapeItem) -> None:
        """Show a cell with `piece` (e.g. a ValueRectangle): add it to the scene, redraw it
        when the cell changes, and make it selectable and highlightable."""
        self.scene.addItem(piece)
        cell.valueChanged.connect(self.cellValueChanged)
        cell.possibleValuesChanged.connect(self.cellPossibleValuesChanged)
        self.puzzlePieces[cell] = piece
        self.puzzlePieceProxies[cell] = PuzzlePieceProxy(piece)

    def cellValueChanged(self, cell: Cell) -> None:
        self.refreshPiece(cell)
