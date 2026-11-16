"""The puzzle window layer for playing: clicking a cell selects it, typing a number enters it,
and cells whose value breaks a rule are drawn in red."""

from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6 import QtCore, QtGui

from gui.windows.selectionwindow import SelectionWindow
from structure.entries import EntryError

if TYPE_CHECKING:
    from structure.cell import Cell


class CellInputWindow(SelectionWindow):
    def createCellInput(self) -> None:
        """Clicking a cell selects it; typing a number enters it in the selected cell."""
        self.game = None
        self.inputMessage = None
        # explains the value the last solver step filled in (shown until the selection changes)
        self.stepMessage = None
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

    def handleCellKey(self, event: QtGui.QKeyEvent) -> bool:
        """Enter (a number) or clear (Delete, Backspace) the value of the selected cell."""
        cell = self.selectedCell()
        game = self.game
        if cell is None or game is None:
            return False
        text = event.text()
        clearKeys = (QtCore.Qt.Key.Key_Delete, QtCore.Qt.Key.Key_Backspace)
        if self.solveJob is not None and (event.key() in clearKeys or text.isdigit()):
            self.inputMessage = "The solver is busy; wait for it or cancel it first."
            self.updateSelectionInfo()
            return True
        try:
            if event.key() in clearKeys or (text == "0" and 0 not in game.puzzle.getValues()):
                game.clear(cell)
            elif len(text) == 1 and text.isdigit():
                game.enter(cell, int(text))
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

    def refreshPiece(self, cell: Cell) -> None:
        """Redraw a cell, showing a mistake typed in it and drawing broken rules in red."""
        piece = self.puzzlePieces[cell]
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

    def puzzleChanged(self) -> None:
        """Redraw after values changed: cell colours, highlight, description and undo state."""
        self.refreshCellStyles()
        self.updateHighlight()
        self.updateSelectionInfo()
        self.updateUndoActions()
