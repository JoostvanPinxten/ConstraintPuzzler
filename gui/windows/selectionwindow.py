"""The puzzle window layer that follows the tree selection: it highlights the selected cells
and explains the selection in a label below the tree."""

from __future__ import annotations

import html
from collections.abc import Iterable
from typing import TYPE_CHECKING

from PySide6 import QtCore, QtWidgets

from gui.highlighting import HighlightRole, combinedHighlightRoles, legendHtml, roleColor
from gui.puzzlemodel.puzzletreemodel import (
    CellProxyItem,
    ConstraintGroupProxyItem,
    ConstraintProxyItem,
    GridProxyItem,
    ReferencedCellProxyItem,
)
from gui.windows.windowbase import PuzzleWindowBase

if TYPE_CHECKING:
    from structure.cell import Cell


class SelectionWindow(PuzzleWindowBase):
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
            self.selectionInfoLabel.setText(
                "Click a cell in the puzzle, or select a cell, group or constraint in the tree"
                " to see its cells and rules."
            )
            return
        showHints = self.settings.showHints
        parts = [self.constraintModel.getItem(index).describe(showHints) for index in rows]
        cell = self.selectedCell()
        if cell is not None and not cell.isGiven():
            parts.append("<i>Type a number to enter it; Delete clears the cell.</i>")
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

    def violationNote(self, cell: Cell) -> str | None:
        """Explain why the value of a cell is drawn in red (None when it is not)."""
        if self.game is None:
            return None
        return self.game.violationNote(cell, self.violations)
