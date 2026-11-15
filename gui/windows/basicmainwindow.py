"""
Created on 26 jan. 2013

@author: Juice
"""

import html
import os
import platform
from collections.abc import Callable

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
    ReferencedCellProxyItem,
    buildPuzzleTree,
)
from gui.settings import PuzzleSettings
from gui.ui import mainWindowUi
from solver.Solver import Solver
from structure.entries import EntryError, UserEntries
from structure.errors import ContradictionError
from structure.puzzle import Puzzle
from utility.resources import resourcePath
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
    # Set by subclasses: the bundled example puzzles (label -> file name, in menu order) and
    # the label of the example that is opened when no file is given.
    examples: dict[str, str] = {}
    defaultExample: str | None = None

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
        # the running fade of the cell highlight, if any (kept so it is not garbage collected)
        self.highlightAnimation: QtCore.QParallelAnimationGroup | None = None

        self.puzzle = None
        self.solver = None

        self.createActions()
        self.createMenus()
        self.createSolverMenu()
        self.createHelpMenu()
        self.createStatusBar()
        self.createSelectionInfo()
        self.createCellInput()

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

    def loadExample(self, label: str | None = None):
        """Load a bundled example puzzle (``defaultExample`` when no label is given)."""
        if label is None:
            label = self.defaultExample
        if label is None or label not in self.examples:
            raise ValueError(f"{self.puzzleTypeName} has no example {label!r}")
        self.loadPuzzle(
            resourcePath(self.examples[label]), title=f"{self.puzzleTypeName} example: {label}"
        )

    def loadPuzzle(self, filename, title: str | None = None):
        """Load a puzzle file. ``title`` describes it (default: puzzle type and file name)."""
        self.puzzle, self.solver = self.parsePuzzle(filename)
        self.puzzleFile = filename
        if title is None:
            title = f"{self.puzzleTypeName} - {os.path.basename(filename)}"
        self.puzzleTitle = title
        self.setWindowTitle(f"{APP_NAME} {getVersion()} - {title}")

        # create a new PuzzleModel, presenting the puzzle in the tree view
        self.constraintModel = ConstraintPuzzleModel()
        buildPuzzleTree(self.puzzle, self.constraintModel.getItem(QtCore.QModelIndex()))
        self.ui.puzzleTreeView.setModel(self.constraintModel)
        self.fitTreeNameColumn()

        m = self.ui.puzzleTreeView.selectionModel()
        m.selectionChanged.connect(self.showSelectionInPuzzleView)

        # one animation proxy per cell of the current puzzle
        self.stopHighlightAnimation()
        self.puzzlePieceProxies = {}
        self.initializePuzzleRepresentation()
        self.highlightRoles = {}
        self.userEntries = UserEntries(self.puzzle)
        self.inputMessage = None
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
        # The puzzle is drawn in black on a transparent background, so with a dark palette it
        # would be black on black. Give the puzzle a fixed white background regardless of theme.
        self.scene.setBackgroundBrush(QtGui.QBrush(QtGui.QColorConstants.White))
        self.ui.puzzleGraphicsView.setScene(self.scene)

    def fitTreeNameColumn(self):
        """Widen the tree's Name column to fit its visible rows.

        With the default fixed width, deeply indented rows push their icon past the column
        edge, where it is drawn over the Type text. The column stays resizable by the user.
        """
        self.ui.puzzleTreeView.resizeColumnToContents(0)

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
        openAction.setShortcut(QtGui.QKeySequence.StandardKey.Open)
        openAction.triggered.connect(self.openPuzzleDialog)
        if self.examples:
            examplesMenu = fileMenu.addMenu("Examples")
            for label in self.examples:
                action = examplesMenu.addAction(label)
                action.triggered.connect(lambda _checked=False, lbl=label: self.loadExample(lbl))

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
        # a message about entering a value belongs to the previous selection
        self.inputMessage = None

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

    def updateHighlight(self):
        """Colour the cells of the selected tree items by the role they play in them."""
        roles = combinedHighlightRoles(self.selectedItems)
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

    def stopHighlightAnimation(self):
        if self.highlightAnimation is not None:
            self.highlightAnimation.stop()
            self.highlightAnimation.deleteLater()
            self.highlightAnimation = None

    def createSelectionInfo(self):
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

    def updateSelectionInfo(self):
        """Describe the item selected in the tree, with a legend of the highlight colours."""
        selectionModel = self.ui.puzzleTreeView.selectionModel()
        rows = selectionModel.selectedRows(0) if selectionModel is not None else []
        if not rows:
            self.selectionInfoLabel.setText(
                "Click a cell in the puzzle, or select a cell, group or constraint in the tree"
                " to see its cells and rules."
            )
            return
        parts = [self.constraintModel.getItem(index).describe() for index in rows]
        cell = self.selectedCell()
        if cell is not None and not cell.isGiven():
            parts.append("<i>Type a number to enter it; Delete clears the cell.</i>")
        note = self.violationNote(cell) if cell is not None else None
        if note:
            parts.append(f'<span style="color:#c00000">{html.escape(note)}</span>')
        if self.inputMessage:
            parts.append(f'<span style="color:#c00000">{html.escape(self.inputMessage)}</span>')
        legend = legendHtml(self.highlightRoles.values())
        if legend:
            parts.append(legend)
        self.selectionInfoLabel.setText("<br>".join(parts))

    def createCellInput(self):
        """Clicking a cell selects it; typing a number enters it in the selected cell."""
        self.userEntries: UserEntries | None = None
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

    def eventFilter(self, watched, event):
        view = self.ui.puzzleGraphicsView
        if (
            watched is view.viewport()
            and event.type() == QtCore.QEvent.Type.MouseButtonPress
            and event.button() == QtCore.Qt.MouseButton.LeftButton
        ):
            self.selectCell(self.cellAt(view.mapToScene(event.position().toPoint())))
            view.setFocus()
        elif (
            watched in (view, self.ui.puzzleTreeView)
            and event.type() == QtCore.QEvent.Type.KeyPress
            and self.handleCellKey(event)
        ):
            return True
        return super().eventFilter(watched, event)

    def cellAt(self, scenePosition):
        """The cell drawn at a position in the scene (or None)."""
        for item in self.scene.items(scenePosition):
            # the value and hint texts are children of the cell's shape
            while item is not None:
                if item in self.pieceCells:
                    return self.pieceCells[item]
                item = item.parentItem()
        return None

    def selectCell(self, cell):
        """Select a cell in the tree (which highlights it), or clear the selection for None."""
        tree = self.ui.puzzleTreeView
        if cell is None or cell not in self.cellIndexes:
            if tree.selectionModel() is not None:
                tree.selectionModel().clearSelection()
            return
        index = self.cellIndexes[cell]
        tree.setCurrentIndex(index)
        tree.scrollTo(index)

    def selectedCell(self):
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

    def handleCellKey(self, event) -> bool:
        """Enter (a number) or clear (Delete, Backspace) the value of the selected cell."""
        cell = self.selectedCell()
        puzzle = self.puzzle
        if cell is None or self.userEntries is None or puzzle is None:
            return False
        text = event.text()
        clearKeys = (QtCore.Qt.Key.Key_Delete, QtCore.Qt.Key.Key_Backspace)
        try:
            if event.key() in clearKeys or (text == "0" and 0 not in puzzle.getValues()):
                self.userEntries.clear(cell)
            elif len(text) == 1 and text.isdigit():
                self.userEntries.enter(cell, int(text))
            else:
                return False
            self.inputMessage = None
        except EntryError as e:
            self.inputMessage = str(e)
        self.refreshCellStyles()
        if puzzle.isSolved() and not self.violations:
            self.inputMessage = "Solved!"
        self.updateHighlight()
        self.updateSelectionInfo()
        return True

    def violationNote(self, cell):
        """Explain why the value of a cell is drawn in red (None when it is not)."""
        if self.userEntries is None or cell not in self.violations or self.puzzle is None:
            return None
        value = self.userEntries.valueOf(cell)
        clashes = set()
        for group in self.puzzle.getConstraintGroups():
            if cell in group.getCells():
                clashes |= self.violations & set(group.getCells())
        clashes.discard(cell)
        if clashes:
            names = ", ".join(sorted(c.getName() for c in clashes))
            return f"{value} breaks a rule together with cell(s) {names}."
        return f"{value} does not fit: it leaves no possible value for another cell."

    def refreshPiece(self, cell):
        """Redraw a cell, showing a mistake typed in it and drawing broken rules in red."""
        piece = self.puzzlePieces[cell]
        piece.updateRepresentation()
        if self.userEntries is None:
            return
        if self.userEntries.isMistake(cell):
            piece.showMistake(self.userEntries.valueOf(cell))
        elif cell in self.violations and cell.hasValue():
            piece.markViolation()

    def refreshCellStyles(self):
        """Find the cells that break a rule and redraw all cells."""
        if self.userEntries is None:
            return
        self.violations = self.userEntries.violations()
        for cell in self.puzzlePieceProxies:
            self.refreshPiece(cell)

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
            # cells may have been solved: refresh their colours and the description
            self.refreshCellStyles()
            self.updateHighlight()
            self.updateSelectionInfo()

    def solveStepButtonClicked(self):
        """Fill in one deducible cell, so the solver can be followed step by step."""
        if self.solver is None or self.puzzle is None or self.puzzle.isSolved():
            return
        try:
            changed = self.solver.solveStep()
        except ContradictionError as e:
            QtWidgets.QMessageBox.warning(
                self,
                "Puzzle cannot be solved",
                "The solver ran into a contradiction:\n\n" + str(e),
            )
            return
        # a cell may have been solved: refresh its colour and the description
        self.refreshCellStyles()
        self.updateHighlight()
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

    def undo(self):
        pass

    def redo(self):
        pass

    def cellPossibleValuesChanged(self, cell):
        self.refreshPiece(cell)

    def initializePuzzleRepresentation(self):
        raise NotImplementedError

    def updatePuzzleRepresentation(self):
        pass

    def cellHintValuesChanged(self, cell, value):
        pass

    def cellValueChanged(self, cell):
        self.refreshPiece(cell)
