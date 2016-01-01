'''
Created on 26 jan. 2013

@author: Juice
'''

from PySide import QtGui, QtCore

# from constraints import *
# from structure import *

# from time import *
# from math import *

from gui.ui import mainWindowUi
from gui.puzzlemodel.puzzletreemodel import *

class BasicMainWindow(QtGui.QMainWindow):
#    MaxRecentFiles = 5
#    windowList = []
    
    acceptedFileExtensios = [(".puzzle", "Generic constraint puzzle format")]
    
    showNextSelectionState =  QtCore.Signal()
    puzzlePieceProxies = {}

    def __init__(self):
        super(BasicMainWindow, self).__init__()
        self.ui=mainWindowUi.Ui_MainWindow()
        self.ui.setupUi(self)

        self.setWindowTitle("ConstraintPuzzler beta v0.1")
        
#        self.recentFileActs = []
#
#        self.setAttribute(QtCore.Qt.WA_DeleteOnClose)
#
#        self.view = QtGui.QGraphicsView(self)
#        self.setCentralWidget(self.view)
#       
                
        self.selectionState = QtCore.QState()
        self.currentSelectionState = QtCore.QState(self.selectionState)
        self.previousSelectionState = QtCore.QState(self.selectionState)
        
        self.selectionStatemachine = QtCore.QStateMachine()
        self.selectionStatemachine.addState(self.selectionState)
        self.selectionStatemachine.setInitialState(self.selectionState)
        self.selectionState.setInitialState(self.currentSelectionState)
                
        self.ui.solvePushButton.clicked.connect(self.solveButtonClicked)

        self.selectionStatemachine.addTransition(self.showNextSelectionState, self.currentSelectionState)
        self.showNextSelectionState.emit()
        self.trans1 = self.currentSelectionState.addTransition(self.showNextSelectionState, self.previousSelectionState)
        self.trans2 = self.previousSelectionState.addTransition(self.showNextSelectionState, self.currentSelectionState)
        
        self.selectionStatemachine.start()        
        self.createActions()
        self.createMenus()
        self.createStatusBar()
#
#        self.setWindowTitle("Constraints solver")
#        self.resize(800, 600)

    def loadPuzzle(self, filename):
        self.puzzle, self.solver = self.parsePuzzle(filename)
        
        # create a new PuzzleModel
        self.constraintModel = ConstraintPuzzleModel()
        self.ui.puzzleTreeView.setModel(self.constraintModel)

        m = self.ui.puzzleTreeView.selectionModel()
        m.selectionChanged.connect(self.showSelectionInPuzzleView)

        
        # set the root as the parent for the puzzle
        self.puzzle.setParentItem(self.constraintModel.getItem(QtCore.QModelIndex()))
        self.initializePuzzleRepresentation()
        self.ui.puzzleGraphicsView.setScene(self.scene)
    
    def parsePuzzle(self, filename):
        raise NotImplementedError("This should be implemented to enable loading of puzzles through the main menu")

    def createActions(self):
        pass
    
    def createMenus(self):
        pass
    
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
                if(index == QtCore.QModelIndex()):
                    break
                if(not index.isValid()):
                    break

                item = self.constraintModel.getItem(index)
                if(isinstance(item, (ConstraintProxyItem, CellProxyItem, ReferencedCellProxyItem, GridProxyItem, ConstraintGroupProxyItem))):
                    #self.selectedCells |= item.getCells()
                    selectionChanged = True
                    self.selectedItems.add(item)

                # check whether or not to calculate the next index  
                if(index.row()+1 < itemRange.bottomRight().row()):
                    index = index.sibling(index.row() + 1, 0) 
                else:
                    break

        # remove the de-selected cells:
        for itemRange in deselectedItems:
            index = itemRange.topLeft()
            index = index.sibling(index.row(), 0)
            # iterate the ranges in this row
            while True:
                if(index == QtCore.QModelIndex()):
                    break
                if(not index.isValid()):
                    break

                item = self.constraintModel.getItem(index)
                if(item in self.selectedItems):
                    self.selectedItems.remove(item)
                    selectionChanged = True
                # check whether or not to calculate the next index  
                if(index.row()+1 < itemRange.bottomRight().row()):
                    index = index.sibling(index.row() + 1, 0) 
                else:
                    break
        
        if(selectionChanged):
            # first copy the reference to the current state to the previous state
            
            self.trans1, self.trans2 = self.trans2, self.trans1

            self.previousSelectionState, self.currentSelectionState = self.currentSelectionState, self.previousSelectionState            
            
            selectedCells = set()
            
            for item in self.selectedItems:
                selectedCells |= item.getCells()
            
            group = QtCore.QParallelAnimationGroup()

            for cell in self.puzzlePieceProxies:
                #it = self.puzzlePieces[cell]
                it = self.puzzlePieceProxies[cell]
                
                
                animation = QtCore.QPropertyAnimation(it, "backgroundColor")
                
                animation.setDuration(200)
                animation.setEasingCurve(QtCore.QEasingCurve.InOutQuad)
                
                group.addAnimation(animation)
                
                if cell in selectedCells:
                    self.currentSelectionState.assignProperty(it, "backgroundColor", QtGui.QColor(255,0,0,100))
                else:
                    self.currentSelectionState.assignProperty(it, "backgroundColor", QtGui.QColor(255,0,0,0))
            
            for anim in self.trans1.animations():
                self.trans1.removeAnimation(anim)
            
            self.trans1.addAnimation(group)
            
            self.showNextSelectionState.emit()
            
    def solveButtonClicked(self):
        if(self.solver != None):
            self.solver.solve()

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