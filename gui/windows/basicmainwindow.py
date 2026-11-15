"""
Created on 26 jan. 2013

@author: Juice
"""

import platform

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
from structure.errors import ContradictionError
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

        self.ui.solvePushButton.clicked.connect(self.solveButtonClicked)
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
        self.stopHighlightAnimation()
        self.puzzlePieceProxies = {}
        self.initializePuzzleRepresentation()
        self.highlightRoles = {}
        self.updateSelectionInfo()
        # The puzzle is drawn in black on a transparent background, so with a dark palette it
        # would be black on black. Give the puzzle a fixed white background regardless of theme.
        self.scene.setBackgroundBrush(QtGui.QBrush(QtGui.QColorConstants.White))
        self.ui.puzzleGraphicsView.setScene(self.scene)

    def parsePuzzle(self, filename):
        raise NotImplementedError(
            "This should be implemented to enable loading of puzzles through the main menu"
        )

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
                "Select a cell, group or constraint in the tree to see its cells and rules."
            )
            return
        parts = [self.constraintModel.getItem(index).describe() for index in rows]
        legend = legendHtml(self.highlightRoles.values())
        if legend:
            parts.append(legend)
        self.selectionInfoLabel.setText("<br>".join(parts))

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
            self.updateHighlight()
            self.updateSelectionInfo()

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
