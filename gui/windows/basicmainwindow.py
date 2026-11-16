"""
Created on 26 jan. 2013

@author: Juice
"""

from __future__ import annotations

import html
import os
import platform
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

import PySide6
from PySide6 import QtCore, QtGui, QtWidgets

import gui.icons.icons_rc  # noqa: F401 -- registers the :/icons/* resources
from gui.highlighting import HighlightRole, combinedHighlightRoles, legendHtml, roleColor
from gui.puzzlemodel.puzzletreemodel import (
    CellProxyItem,
    ConstraintGroupProxyItem,
    ConstraintProxyItem,
    ConstraintPuzzleModel,
    GridProxyItem,
    ProxyItem,
    ReferencedCellProxyItem,
    buildPuzzleTree,
)
from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
from gui.settings import PuzzleSettings, addShowHintsAction
from gui.solverworker import SolveJob, SolveWorker
from gui.ui import mainWindowUi
from solver.hints import CELL, REGION, VALUE, HintSession
from solver.Solver import Solver
from structure.entries import EntryError
from structure.errors import ContradictionError
from structure.game import Game
from structure.puzzle import Puzzle
from utility.puzzletypes import PuzzleType
from utility.resources import resourcePath
from utility.version import APP_NAME, getVersion

if TYPE_CHECKING:
    from structure.cell import Cell
    from structure.types import PuzzleState


def appIcon() -> QtGui.QIcon:
    """The ConstraintPuzzler logo, at every size bundled in the icon resources."""
    icon = QtGui.QIcon()
    for size in (16, 32, 64, 256):
        icon.addFile(f":/icons/appIcon{size}", QtCore.QSize(size, size))
    return icon


class BasicMainWindow(QtWidgets.QMainWindow):
    #    MaxRecentFiles = 5
    #    windowList = []

    # Set by subclasses: the registry entry (utility.puzzletypes) with the type's label,
    # parser, file filter and bundled examples
    puzzleType: PuzzleType

    # Set by subclasses in initializePuzzleRepresentation() (see newScene/addCellPiece):
    # the graphics item of every cell (a CellPiece) and of the clues (keyed by constraint)
    scene: QtWidgets.QGraphicsScene
    puzzlePieces: dict[Any, Any]
    selectedItems: set[ProxyItem]

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

        #        self.recentFileActs = []
        #
        #        self.setAttribute(QtCore.Qt.WA_DeleteOnClose)
        #
        #        self.view = QtGui.QGraphicsView(self)
        #        self.setCentralWidget(self.view)
        #

        self.ui.solvePushButton.clicked.connect(self.solveButtonClicked)
        self.ui.solveStepPushButton.clicked.connect(self.solveStepButtonClicked)
        self.ui.hintPushButton.clicked.connect(self.hintButtonClicked)
        self.ui.notesPushButton.toggled.connect(lambda _checked: self.updateSelectionInfo())
        # the running background solve, if any (see solveButtonClicked)
        self.solveJob: SolveJob | None = None
        # the running fade of the cell highlight, if any (kept so it is not garbage collected)
        self.highlightAnimation: QtCore.QParallelAnimationGroup | None = None

        self.puzzle: Puzzle | None = None
        self.solver: Solver | None = None
        # explains the value the last solver step filled in (shown until the selection changes)
        self.stepMessage: str | None = None
        # the hint being revealed level by level (see hintButtonClicked), and its region
        self.hintSession = HintSession()
        self.hintRegion: set[Cell] = set()
        # the cells Check marked as wrong (until the puzzle changes)
        self.checkMarks: set[Cell] = set()

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

    #
    #        self.setWindowTitle("Constraints solver")
    #        self.resize(800, 600)

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

    def puzzleChanged(self) -> None:
        """Redraw after values changed: cell colours, highlight, description and undo state."""
        self.resetGuidance()
        self.refreshCellStyles()
        self.updateHighlight()
        self.updateSelectionInfo()
        self.updateUndoActions()

    def resetGuidance(self) -> None:
        """Forget the hint being revealed and the Check marks: they belong to the puzzle as it
        was before a change."""
        self.hintSession.reset()
        self.hintRegion = set()
        self.checkMarks = set()
        self.ui.hintPushButton.setText("Hint")

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

    def showSelectionInPuzzleView(
        self,
        selectedItems: Iterable[QtCore.QItemSelectionRange],
        deselectedItems: Iterable[QtCore.QItemSelectionRange],
    ) -> None:
        """Follow the selection in the tree (the QItemSelections of selectionChanged)."""
        selectionChanged = False
        # a message about entering a value belongs to the previous selection
        self.inputMessage = None
        self.stepMessage = None

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
            self.updateHighlight()
        self.updateSelectionInfo()

    def updateHighlight(self) -> None:
        """Colour the cells of the selected tree items by the role they play in them."""
        roles = combinedHighlightRoles(self.selectedItems)
        # where a hint says to look, and what Check found to be wrong
        for cells, role in (
            (self.hintRegion, HighlightRole.HINT),
            (self.checkMarks, HighlightRole.WRONG),
        ):
            for cell in cells:
                roles[cell] = max(role, roles.get(cell, HighlightRole.NONE))
        self.highlightRoles = roles

        # continue from wherever the previous fade got to
        self.stopHighlightAnimation()
        group = QtCore.QParallelAnimationGroup(self)
        for cell, proxy in self.puzzlePieceProxies.items():
            animation = QtCore.QPropertyAnimation(proxy, QtCore.QByteArray(b"backgroundColor"))
            animation.setDuration(200)
            animation.setEasingCurve(QtCore.QEasingCurve.Type.InOutQuad)
            animation.setStartValue(proxy.backgroundColor)
            animation.setEndValue(roleColor(roles.get(cell, HighlightRole.NONE)))
            group.addAnimation(animation)
        self.highlightAnimation = group
        group.start(QtCore.QAbstractAnimation.DeletionPolicy.KeepWhenStopped)

    def stopHighlightAnimation(self) -> None:
        if self.highlightAnimation is not None:
            self.highlightAnimation.stop()
            self.highlightAnimation.deleteLater()
            self.highlightAnimation = None

    def createSelectionInfo(self) -> None:
        """A label below the puzzle tree that explains the selected item."""
        self.highlightRoles = {}
        self.selectionInfoLabel = QtWidgets.QLabel(self.ui.dockWidgetContents)
        self.selectionInfoLabel.setObjectName("selectionInfoLabel")
        self.selectionInfoLabel.setTextFormat(QtCore.Qt.TextFormat.RichText)
        self.selectionInfoLabel.setWordWrap(True)
        self.selectionInfoLabel.setAlignment(
            QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignTop
        )
        self.selectionInfoLabel.setTextInteractionFlags(
            QtCore.Qt.TextInteractionFlag.TextSelectableByMouse
        )
        self.selectionInfoLabel.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
        self.selectionInfoLabel.setMargin(4)
        # directly below the tree, above the solver controls
        self.ui.verticalLayout_2.insertWidget(1, self.selectionInfoLabel)
        self.updateSelectionInfo()

    def updateSelectionInfo(self) -> None:
        """Describe the item selected in the tree, with a legend of the highlight colours."""
        selectionModel = self.ui.puzzleTreeView.selectionModel()
        rows = selectionModel.selectedRows(0) if selectionModel is not None else []
        if not rows:
            # e.g. a hint that shows where to look, without selecting a cell yet
            if self.stepMessage:
                legend = legendHtml(self.highlightRoles.values())
                parts = [f"<i>{html.escape(self.stepMessage)}</i>"] + ([legend] if legend else [])
                self.selectionInfoLabel.setText("<br>".join(parts))
                return
            self.selectionInfoLabel.setText(
                "Click a cell in the puzzle, or select a cell, group or constraint in the tree"
                " to see its cells and rules."
            )
            return
        showHints = self.settings.showHints
        parts = [self.constraintModel.getItem(index).describe(showHints) for index in rows]
        cell = self.selectedCell()
        if cell is not None and not cell.isGiven():
            if self.ui.notesPushButton.isChecked():
                parts.append(
                    "<i>Notes mode: type a number to note it, again to remove it (N ends"
                    " notes mode).</i>"
                )
            else:
                parts.append(
                    "<i>Type a number to enter it; Delete clears the cell. Ctrl+number (or"
                    " notes mode, N) notes a candidate.</i>"
                )
        note = self.violationNote(cell) if cell is not None else None
        if note:
            parts.append(f'<span style="color:#c00000">{html.escape(note)}</span>')
        if self.inputMessage:
            parts.append(f'<span style="color:#c00000">{html.escape(self.inputMessage)}</span>')
        if self.stepMessage:
            parts.append(f"<i>{html.escape(self.stepMessage)}</i>")
        legend = legendHtml(self.highlightRoles.values())
        if legend:
            parts.append(legend)
        self.selectionInfoLabel.setText("<br>".join(parts))

    def createCellInput(self) -> None:
        """Clicking a cell selects it; typing a number enters it in the selected cell."""
        self.game: Game | None = None
        self.inputMessage: str | None = None
        # the cells whose shown value breaks a rule (drawn in red)
        self.violations = set()
        self.pieceCells = {}
        self.cellIndexes = {}
        view = self.ui.puzzleGraphicsView
        view.setFocusPolicy(QtCore.Qt.FocusPolicy.StrongFocus)
        view.viewport().installEventFilter(self)
        view.installEventFilter(self)
        self.ui.puzzleTreeView.installEventFilter(self)

    def eventFilter(self, watched: QtCore.QObject, event: QtCore.QEvent) -> bool:
        view = self.ui.puzzleGraphicsView
        if (
            watched is view.viewport()
            and isinstance(event, QtGui.QMouseEvent)
            and event.type() == QtCore.QEvent.Type.MouseButtonPress
            and event.button() == QtCore.Qt.MouseButton.LeftButton
        ):
            self.selectCell(self.cellAt(view.mapToScene(event.position().toPoint())))
            view.setFocus()
        elif (
            watched in (view, self.ui.puzzleTreeView)
            and isinstance(event, QtGui.QKeyEvent)
            and event.type() == QtCore.QEvent.Type.KeyPress
            and self.handleCellKey(event)
        ):
            return True
        return super().eventFilter(watched, event)

    def cellAt(self, scenePosition: QtCore.QPointF) -> Cell | None:
        """The cell drawn at a position in the scene (or None)."""
        for item in self.scene.items(scenePosition):
            # the value and hint texts are children of the cell's shape
            while item is not None:
                if item in self.pieceCells:
                    return self.pieceCells[item]
                item = item.parentItem()
        return None

    def selectCell(self, cell: Cell | None) -> None:
        """Select a cell in the tree (which highlights it), or clear the selection for None."""
        tree = self.ui.puzzleTreeView
        if cell is None or cell not in self.cellIndexes:
            if tree.selectionModel() is not None:
                tree.selectionModel().clearSelection()
            return
        index = self.cellIndexes[cell]
        tree.setCurrentIndex(index)
        tree.scrollTo(index)

    def selectedCell(self) -> Cell | None:
        """The cell selected in the tree, if a single cell is selected."""
        selectionModel = self.ui.puzzleTreeView.selectionModel()
        if selectionModel is None:
            return None
        rows = selectionModel.selectedRows(0)
        if len(rows) != 1:
            return None
        item = self.constraintModel.getItem(rows[0])
        if isinstance(item, (CellProxyItem, ReferencedCellProxyItem)):
            return item.cell
        return None

    def handleCellKey(self, event: QtGui.QKeyEvent) -> bool:
        """Enter (a number) or clear (Delete, Backspace) the value of the selected cell.

        In notes mode (N toggles it), or with Ctrl held, a number toggles a note instead."""
        game = self.game
        if game is None:
            return False
        modifiers = event.modifiers()
        ctrl = bool(modifiers & QtCore.Qt.KeyboardModifier.ControlModifier)
        if event.key() == QtCore.Qt.Key.Key_N and not ctrl:
            self.ui.notesPushButton.toggle()
            return True
        cell = self.selectedCell()
        if cell is None:
            return False
        # the digit of the key itself: with Ctrl, text() is a control character
        digit = event.key() - QtCore.Qt.Key.Key_0.value
        isDigit = 0 <= digit <= 9
        clearKeys = (QtCore.Qt.Key.Key_Delete, QtCore.Qt.Key.Key_Backspace)
        if self.solveJob is not None and (event.key() in clearKeys or isDigit):
            self.inputMessage = "The solver is busy; wait for it or cancel it first."
            self.updateSelectionInfo()
            return True
        try:
            if isDigit and (ctrl or self.ui.notesPushButton.isChecked()):
                game.toggleNote(cell, digit)
            elif ctrl:
                return False  # leave e.g. Ctrl+Z to the shortcuts
            elif event.key() in clearKeys or (digit == 0 and 0 not in game.puzzle.getValues()):
                game.clear(cell)
            elif isDigit:
                game.enter(cell, digit)
            else:
                return False
            self.inputMessage = None
        except EntryError as e:
            self.inputMessage = str(e)
        self.refreshCellStyles()
        if game.isSolved(self.violations):
            self.inputMessage = "Solved!"
        self.updateHighlight()
        self.updateSelectionInfo()
        self.updateUndoActions()
        return True

    def violationNote(self, cell: Cell) -> str | None:
        """Explain why the value of a cell is drawn in red (None when it is not)."""
        if self.game is None:
            return None
        return self.game.violationNote(cell, self.violations)

    def refreshPiece(self, cell: Cell) -> None:
        """Redraw a cell, showing a mistake typed in it and drawing broken rules in red."""
        piece = self.puzzlePieces[cell]
        if self.game is not None:
            # only the cell shapes have notes (see CellPiece)
            setNotes = getattr(piece, "setNotes", None)
            if setNotes is not None:
                setNotes(self.game.notesOf(cell))
        piece.updateRepresentation()
        if self.game is None:
            return
        if self.game.isMistake(cell):
            piece.showMistake(self.game.valueOf(cell))
        elif cell in self.violations and cell.hasValue():
            piece.markViolation()

    def refreshCellStyles(self) -> None:
        """Find the cells that break a rule and redraw all cells."""
        if self.game is None:
            return
        self.violations = self.game.violations()
        for cell in self.puzzlePieceProxies:
            self.refreshPiece(cell)

    def solveButtonClicked(self) -> None:
        """Solve in a background thread; while it runs, the button cancels it."""
        if self.solveJob is not None:
            self.solveJob.cancel()
            self.ui.solvePushButton.setEnabled(False)  # until the solver has stopped
            return
        if self.solver is None or self.game is None or self.puzzleFile is None:
            return
        self.solver.allowGuessing = self.settings.allowGuessing
        parser, path = self.puzzleType.parser, self.puzzleFile
        worker = SolveWorker(
            lambda: parser(path), self.game.puzzle.saveState(), self.settings.allowGuessing
        )
        worker.finished.connect(self.solveFinished)
        worker.failed.connect(self.solveFailed)
        worker.cancelled.connect(self.solveCancelled)
        job = SolveJob(worker, self)
        job.done.connect(self.solveJobDone)
        self.solveJob = job
        self.setSolving(True)
        job.start()

    def setSolving(self, solving: bool) -> None:
        self.ui.solvePushButton.setText("Cancel" if solving else "Solve")
        self.ui.solvePushButton.setEnabled(True)
        self.ui.solveStepPushButton.setEnabled(not solving)
        self.ui.hintPushButton.setEnabled(not solving)
        self.updateUndoActions()

    def solveFinished(self, state: PuzzleState, solved: bool) -> None:
        if self.game is None:
            return
        self.game.applySolution(state)
        self.inputMessage = None
        self.stepMessage = None if solved else "The solver got stuck; try Allow guessing."
        # cells may have been solved: refresh their colours and the description
        self.puzzleChanged()

    def solveFailed(self, message: str) -> None:
        QtWidgets.QMessageBox.warning(
            self,
            "Puzzle cannot be solved",
            "The solver ran into a contradiction:\n\n" + message,
        )

    def solveCancelled(self) -> None:
        self.stepMessage = "Solving was cancelled."
        self.updateSelectionInfo()

    def solveJobDone(self) -> None:
        job = self.solveJob
        self.solveJob = None
        if job is not None:
            job.deleteLater()
        self.setSolving(False)

    def stopSolving(self) -> None:
        """Cancel a running solve and wait until its thread has stopped."""
        job = self.solveJob
        if job is None:
            return
        job.cancel()
        job.wait()
        # deliver the worker's queued signals, which clears self.solveJob
        self.waitForSolve()

    def waitForSolve(self, timeout: int = 30000) -> bool:
        """Process events until a running solve has finished (e.g. in tests). Returns whether
        it finished within `timeout` milliseconds."""
        timer = QtCore.QElapsedTimer()
        timer.start()
        while self.solveJob is not None:
            if timer.elapsed() > timeout:
                return False
            QtCore.QCoreApplication.processEvents(QtCore.QEventLoop.ProcessEventsFlag.AllEvents, 50)
        return True

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        self.stopSolving()
        super().closeEvent(event)

    def hintButtonClicked(self) -> None:
        """Reveal a value that follows from the constraints, a bit more on every click: first
        where to look, then the cell, then the value and why. Nothing is filled in."""
        if self.solver is None or self.game is None or self.solveJob is not None:
            return
        session = self.hintSession
        try:
            hint = session.advance(self.solver)
        except ContradictionError as e:
            QtWidgets.QMessageBox.warning(
                self,
                "Puzzle cannot be solved",
                "The solver ran into a contradiction:\n\n" + str(e),
            )
            return
        if hint is None:
            QtWidgets.QMessageBox.information(
                self,
                "No hint",
                "No value follows from a single round of the rules. Use Solve single step to"
                " narrow down the candidates, or Solve.",
            )
            self.resetGuidance()
            self.updateHighlight()
            return
        if session.level == REGION:
            # show the area without giving away the cell
            self.selectCell(None)
            self.hintRegion = session.regionCells()
        else:
            self.hintRegion = set()
            self.selectCell(hint.cell)
        # after selectCell, which clears the message of the previous selection
        self.stepMessage = "Hint: " + session.message()
        nextText = {REGION: "Hint: which cell?", CELL: "Hint: show value", VALUE: "Hint"}
        self.ui.hintPushButton.setText(nextText[session.level])
        self.updateHighlight()
        self.updateSelectionInfo()

    def solveStepButtonClicked(self) -> None:
        """Fill in one deducible cell, so the solver can be followed step by step."""
        if self.solver is None or self.game is None or self.game.puzzle.isSolved():
            return
        try:
            # fill in the cell of the hint being shown, if any
            changed = self.game.solveStep(self.solver, self.hintSession.deduction)
        except ContradictionError as e:
            QtWidgets.QMessageBox.warning(
                self,
                "Puzzle cannot be solved",
                "The solver ran into a contradiction:\n\n" + str(e),
            )
            return
        # a cell may have been solved: refresh its colour and the description
        self.puzzleChanged()
        step = self.solver.lastStep
        if step is not None:
            # select the filled cell and explain why it has this value
            self.selectCell(step.cell)
            self.stepMessage = "Solver step: " + step.describe()
            self.updateSelectionInfo()
        if not changed:
            QtWidgets.QMessageBox.information(
                self,
                "No progress",
                "A deduction step does not change the puzzle any further."
                + (
                    " Use Solve to continue by guessing."
                    if self.settings.allowGuessing
                    else " Enable Solver > Allow guessing and use Solve to continue."
                ),
            )

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
