"""
Created on 26 jan. 2013

@author: Juice
"""

from PySide6 import QtGui, QtCore, QtWidgets, QtStateMachine

from gui.ui import mainWindowUi
import gui.icons.icons_rc  # noqa: F401 -- registers the :/icons/* resources
from gui.puzzlemodel.puzzletreemodel import *
from structure.errors import ContradictionError


class BasicMainWindow(QtWidgets.QMainWindow):
    #    MaxRecentFiles = 5
    #    windowList = []

    acceptedFileExtensios = [(".puzzle", "Generic constraint puzzle format")]

    showNextSelectionState = QtCore.Signal()

    def __init__(self):
        super(BasicMainWindow, self).__init__()
        self.ui = mainWindowUi.Ui_MainWindow()
        self.ui.setupUi(self)

        self.setWindowTitle("ConstraintPuzzler beta v0.1")

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
        self.createStatusBar()

    #
    #        self.setWindowTitle("Constraints solver")
    #        self.resize(800, 600)

    def loadPuzzle(self, filename):
        self.puzzle, self.solver = self.parsePuzzle(filename)

        # create a new PuzzleModel, presenting the puzzle in the tree view
        self.constraintModel = ConstraintPuzzleModel()
        buildPuzzleTree(self.puzzle, self.constraintModel.getItem(QtCore.QModelIndex()))
        self.ui.puzzleTreeView.setModel(self.constraintModel)

        m = self.ui.puzzleTreeView.selectionModel()
        m.selectionChanged.connect(self.showSelectionInPuzzleView)

        # one animation proxy per cell of the current puzzle
        self.puzzlePieceProxies = {}
        self.initializePuzzleRepresentation()
        self.ui.puzzleGraphicsView.setScene(self.scene)

    def parsePuzzle(self, filename):
        raise NotImplementedError(
            "This should be implemented to enable loading of puzzles through the main menu"
        )

    def createActions(self):
        pass

    def createMenus(self):
        pass

    def createSolverMenu(self):
        solverMenu = self.menuBar().addMenu("Solver")
        self.allowGuessingAction = solverMenu.addAction("Allow guessing (backtracking)")
        self.allowGuessingAction.setCheckable(True)

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
                    it, QtCore.QByteArray("backgroundColor".encode()), self
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
            self.solver.allowGuessing = self.allowGuessingAction.isChecked()
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
