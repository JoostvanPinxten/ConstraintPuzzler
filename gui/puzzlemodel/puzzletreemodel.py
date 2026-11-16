"""
Created on 28 dec. 2012

@author: Juice
"""

from __future__ import annotations

import html
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

from PySide6 import QtCore, QtGui
from PySide6.QtCore import Qt

if TYPE_CHECKING:
    from constraints.constraint import Constraint
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.grid import Grid
    from structure.puzzle import Puzzle

# the index types Qt passes to a model's methods
type ModelIndex = QtCore.QModelIndex | QtCore.QPersistentModelIndex


def _cellCounts(cells: Iterable[Cell]) -> str:
    """E.g. "9 cells: 4 filled, 5 open"."""
    cells = list(cells)
    filled = sum(1 for c in cells if c.hasValue())
    return f"{len(cells)} cells: {filled} filled, {len(cells) - filled} open"


def describeCell(cell: Cell, showHints: bool = True) -> str:
    """Rich text describing the value or the candidates of a cell and its groups.

    With showHints False, the candidates of an open cell are not listed."""
    if cell.hasValue():
        source = cell.getSource()
        how = source.value if source is not None else "given"
        state = f"Value: {cell.getValue()} ({how})"
    elif not showHints:
        state = "Open"
    else:
        candidates = ", ".join(str(v) for v in sorted(cell.getPossibleValues()))
        state = f"Candidates: {candidates}"
    groups = [g.getName() for g in cell.getConstraintGroups()]
    text = f"<b>Cell {html.escape(cell.getName())}</b><br>{state}"
    if groups:
        text += "<br>In groups: " + html.escape(", ".join(groups))
    return text


class ConstraintPuzzleModel(QtCore.QAbstractItemModel):
    def __init__(self, parent: QtCore.QObject | None = None) -> None:
        super().__init__(parent)
        self.root = ConstraintPuzzleRootItem()
        # whether the tooltips mention the candidate values of open cells
        self.showHints = True

    def rowCount(self, parent: ModelIndex = QtCore.QModelIndex()) -> int:
        parentItem = self.getItem(parent)

        return parentItem.childCount()

    def getItem(self, index: ModelIndex) -> ProxyItem:
        if index.isValid():
            item = index.internalPointer()
            if item:
                return item

        return self.root

    def columnCount(self, parent: ModelIndex = QtCore.QModelIndex()) -> int:
        return 2

    def index(
        self,
        row: int,
        column: int,
        parent: ModelIndex = QtCore.QModelIndex(),
    ) -> QtCore.QModelIndex:
        if parent.isValid() and parent.column() != 0:
            return QtCore.QModelIndex()

        parentItem = self.getItem(parent)
        childItem = parentItem.child(row)
        if childItem:
            return self.createIndex(row, column, childItem)
        else:
            return QtCore.QModelIndex()

    def parent(self, index: ModelIndex) -> QtCore.QModelIndex:
        # the index must be valid
        if not index.isValid():
            return QtCore.QModelIndex()

        childItem = self.getItem(index)
        parentItem = childItem.parent()

        if parentItem is None or parentItem == self.root:
            return QtCore.QModelIndex()

        return self.createIndex(parentItem.childNumber(), 0, parentItem)

    def data(
        self,
        index: ModelIndex,
        role: int = Qt.ItemDataRole.DisplayRole,
    ) -> Any:
        if not index.isValid():
            return None

        if role == Qt.ItemDataRole.DisplayRole:
            item = self.getItem(index)
            if not item:
                return self.tr("not set")
            else:
                return item.data(index.column())
        elif role == Qt.ItemDataRole.DecorationRole:
            if index.column() != 0:
                return None
            item = self.getItem(index)
            if not item:
                return None
            else:
                return item.getIcon()
        elif role == Qt.ItemDataRole.ToolTipRole:
            return self.getItem(index).describe(self.showHints)
        else:
            return None

    def headerData(
        self,
        section: int,
        orientation: QtCore.Qt.Orientation,
        role: int = QtCore.Qt.ItemDataRole.DisplayRole,
    ) -> Any:
        sections = [self.tr("Name"), self.tr("Type")]

        if role == QtCore.Qt.ItemDataRole.DisplayRole:
            return sections[section]
        else:
            return QtCore.QAbstractItemModel.headerData(self, section, orientation, role)


class ProxyItem(QtCore.QObject):
    """An item of the puzzle tree. It derives from QObject only for tr(); its tree parent
    and children are its own (parentItem, childItems), not the QObject ones."""

    def __init__(self, parent: ProxyItem | None = None) -> None:
        super().__init__()
        self.parentItem = parent
        self.childItems: list[ProxyItem] = []

        if parent is not None:
            parent.addChild(self)

    def parent(self) -> ProxyItem | None:
        return self.parentItem

    def childCount(self) -> int:
        return len(self.childItems)

    def children(self) -> list[ProxyItem]:
        return list(self.childItems)

    def child(self, row: int) -> ProxyItem | None:
        try:
            return self.childItems[row]
        except IndexError:
            return None

    def childNumber(self) -> int:
        if self.parentItem is not None:
            return self.parentItem.childItems.index(self)
        return 0

    def addChild(self, child: ProxyItem) -> None:
        self.childItems.append(child)

    def data(self, column: int) -> str | None:
        if column == 0:
            return self.getName()
        elif column == 1:
            return self.getType()
        return None

    def getName(self) -> str:
        raise NotImplementedError

    def getType(self) -> str:
        raise NotImplementedError

    def getIcon(self) -> QtGui.QIcon | QtGui.QColor:
        return QtGui.QColor(255, 255, 255)

    def getCells(self) -> set[Cell]:
        """The cells this item is about (none for the root and the puzzle)."""
        return set()

    def describe(self, showHints: bool = True) -> str:
        """Rich text that explains the item (shown as tooltip and below the tree).

        With showHints False, the text leaves out the candidate values of open cells."""
        return f"<b>{html.escape(str(self.getName()))}</b> ({html.escape(str(self.getType()))})"

    def setParent(self, parent: ProxyItem) -> None:
        parent.addChild(self)
        self.parentItem = parent

    def getItem(self) -> Any:
        raise NotImplementedError


class ConstraintPuzzleRootItem(ProxyItem):
    def __init__(self) -> None:
        super().__init__()

    def getName(self) -> str:
        return self.tr("Root")

    def getType(self) -> str:
        return self.tr("Root")


class PuzzleProxyItem(ProxyItem):
    def __init__(self, puzzle: Puzzle, parent: ProxyItem | None = None) -> None:
        super().__init__(parent)
        self.puzzle = puzzle

    def getName(self) -> str:
        return self.puzzle.name

    def setName(self, name: str) -> None:
        self.puzzle.name = name

    def getType(self) -> str:
        return self.tr("Puzzle")

    def describe(self, showHints: bool = True) -> str:
        cells = self.puzzle.getGrid().getCells()
        groups = len(self.puzzle.getConstraintGroups())
        return (
            f"<b>{html.escape(str(self.getName()))}</b><br>{_cellCounts(cells)}<br>"
            f"{groups} constraint groups"
        )


class GridProxyItem(ProxyItem):
    def __init__(self, grid: Grid, parent: ProxyItem) -> None:
        super().__init__(parent)

        self.grid = grid

    def getName(self) -> str:
        return self.tr("Grid")

    def getType(self) -> str:
        return self.tr("Grid")

    def getIcon(self) -> QtGui.QIcon:
        return QtGui.QIcon(":/icons/gridIcon")

    def getCells(self) -> set[Cell]:
        return set(self.grid.getCells())

    def getPuzzle(self) -> ProxyItem | None:
        return self.parent()

    def describe(self, showHints: bool = True) -> str:
        return f"<b>Grid</b><br>{_cellCounts(self.grid.getCells())}"

    def getItem(self) -> Grid:
        return self.grid


class CellProxyItem(ProxyItem):
    def __init__(self, cell: Cell, parent: ProxyItem) -> None:
        super().__init__(parent)

        self.cell = cell

    def getName(self) -> str:
        return self.cell.getName()

    def getType(self) -> str:
        return self.tr("Cell")

    def getIcon(self) -> QtGui.QIcon:
        return QtGui.QIcon(":/icons/cellIcon")

    def getCells(self) -> set[Cell]:
        return {self.cell}

    def describe(self, showHints: bool = True) -> str:
        return describeCell(self.cell, showHints)

    def getItem(self) -> Cell:
        return self.cell


class ReferencedCellProxyItem(ProxyItem):
    def __init__(self, cell: Cell, parent: ProxyItem) -> None:
        super().__init__(parent)

        self.cell = cell

    def getName(self) -> str:
        return self.cell.getName()

    def getType(self) -> str:
        return self.tr("Cell")

    def getIcon(self) -> QtGui.QIcon:
        return QtGui.QIcon(":/icons/cellIcon")

    def getCells(self) -> set[Cell]:
        return {self.cell}

    def describe(self, showHints: bool = True) -> str:
        return describeCell(self.cell, showHints)

    def getItem(self) -> Cell:
        return self.cell


class ConstraintGroupProxyItem(ProxyItem):
    def __init__(self, cg: ConstraintGroup, parent: ProxyItem) -> None:
        super().__init__(parent)

        self.constraintGroup = cg

    def getName(self) -> str:
        return self.constraintGroup.getName()

    def getType(self) -> str:
        return self.tr("Constraint Group")

    def describe(self, showHints: bool = True) -> str:
        group = self.constraintGroup
        rules = "".join(
            f"<li>{html.escape(c.describe(showHints))}</li>" for c in group.getConstraints()
        )
        return (
            f"<b>{html.escape(group.getName())}</b> (constraint group)<br>"
            f"{_cellCounts(group.getCells())}<ul>{rules}</ul>"
        )

    def getCells(self) -> set[Cell]:
        return set(self.constraintGroup.getCells())

    def getItem(self) -> ConstraintGroup:
        return self.constraintGroup


class ConstraintProxyItem(ProxyItem):
    def __init__(self, constraint: Constraint, parent: ProxyItem) -> None:
        super().__init__(parent)
        self.constraint = constraint

    def getName(self) -> str:
        return self.constraint.summary()

    def getType(self) -> str:
        return self.tr(self.constraint.getType())

    def getIcon(self) -> QtGui.QIcon:
        return QtGui.QIcon(":/icons/constraintIcon")

    def getCells(self) -> set[Cell]:
        parent = self.parent()
        return parent.getCells() if parent is not None else set()

    def describe(self, showHints: bool = True) -> str:
        group = self.constraint.group
        return (
            f"<b>{html.escape(self.constraint.summary())}</b> "
            f"({html.escape(self.constraint.getType())})<br>"
            f"{html.escape(self.constraint.describe(showHints))}<br>"
            f"Group {html.escape(group.getName())}: {_cellCounts(group.getCells())}"
        )

    def getItem(self) -> Constraint:
        return self.constraint


def buildPuzzleTree(puzzle: Puzzle, root: ProxyItem) -> PuzzleProxyItem:
    """Build the tree of proxy items that presents the puzzle model in a view:
    the puzzle holds the grid (with its cells) and the constraint groups, each
    group holds its constraints and references to its cells."""
    puzzleItem = PuzzleProxyItem(puzzle, root)

    gridItem = GridProxyItem(puzzle.getGrid(), puzzleItem)
    for cell in puzzle.getGrid().getCells():
        CellProxyItem(cell, gridItem)

    for cg in puzzle.getConstraintGroups():
        groupItem = ConstraintGroupProxyItem(cg, puzzleItem)
        for constraint in cg.getConstraints():
            ConstraintProxyItem(constraint, groupItem)
        for cell in cg.getCells():
            ReferencedCellProxyItem(cell, groupItem)

    return puzzleItem
