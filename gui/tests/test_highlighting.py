"""The highlight role of each cell for an item selected in the puzzle tree."""

import unittest

from PySide6 import QtCore

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from gui.highlighting import (
    HighlightRole,
    combinedHighlightRoles,
    highlightRoles,
    legendHtml,
    onWhite,
    roleColor,
)
from gui.puzzlemodel.puzzletreemodel import (
    CellProxyItem,
    ConstraintGroupProxyItem,
    ConstraintProxyItem,
    ConstraintPuzzleModel,
    buildPuzzleTree,
)
from structure.position import Position
from utility.puzzlefactory import PuzzleFactory


def treeItems(puzzle):
    """The tree model of a puzzle and its puzzle item."""
    model = ConstraintPuzzleModel()
    puzzleItem = buildPuzzleTree(puzzle, model.getItem(QtCore.QModelIndex()))
    return model, puzzleItem


class HighlightTest(unittest.TestCase):
    def setUp(self):
        self.puzzle = PuzzleFactory.createFutoshikiPuzzle(3)
        grid = self.puzzle.grid
        self.lesser = grid.searchCellWithPosition(Position(1, 1))
        self.greater = grid.searchCellWithPosition(Position(2, 1))
        group = self.puzzle.addConstraintGroup("Relativity")
        constraint = group.addConstraint(CellGreaterThanCellConstraint)
        group.addCell(self.greater)
        group.addCell(self.lesser)
        constraint.setGreaterCell(self.greater)
        constraint.setLesserCell(self.lesser)
        self.model, self.puzzleItem = treeItems(self.puzzle)

    def groupItem(self, name):
        for child in self.puzzleItem.children():
            if isinstance(child, ConstraintGroupProxyItem) and child.getName() == name:
                return child
        raise LookupError(name)

    def cellItem(self, cell):
        gridItem = self.puzzleItem.children()[0]
        return next(c for c in gridItem.children() if c.cell is cell)

    def testGreaterThanColoursTheSmallerAndTheLargerCell(self):
        constraintItem = self.groupItem("Relativity").children()[0]
        self.assertIsInstance(constraintItem, ConstraintProxyItem)
        self.assertEqual(
            highlightRoles(constraintItem),
            {self.lesser: HighlightRole.LESSER, self.greater: HighlightRole.GREATER},
        )
        self.assertEqual(constraintItem.getName(), "(1, 1) < (2, 1)")

    def testGroupSeparatesOpenAndSolvedCells(self):
        row = self.groupItem("Row 0")
        cells = row.constraintGroup.getCells()
        cells[0].setValue(2)
        roles = highlightRoles(row)
        self.assertEqual(roles[cells[0]], HighlightRole.SOLVED)
        self.assertEqual({roles[c] for c in cells[1:]}, {HighlightRole.OPEN})
        self.assertIn("1 filled, 2 open", row.describe())
        self.assertIn("still missing: 1, 3", row.describe())

    def testCellShowsItsPeers(self):
        cellItem = self.cellItem(self.lesser)
        self.assertIsInstance(cellItem, CellProxyItem)
        roles = highlightRoles(cellItem)
        self.assertEqual(roles[self.lesser], HighlightRole.SELECTED)
        # its row and column (2 other cells each) and the greater-than partner, which is in row 0
        peers = {c for c, r in roles.items() if r == HighlightRole.PEER}
        self.assertEqual(len(peers), 4)
        self.assertIn(self.greater, peers)
        self.assertIn("In groups: Row 0, Column 0, Relativity", cellItem.describe())

    def testStrongestRoleWinsForSharedCells(self):
        cellItem = self.cellItem(self.lesser)
        roles = combinedHighlightRoles([cellItem, self.groupItem("Relativity").children()[0]])
        self.assertEqual(roles[self.lesser], HighlightRole.SELECTED)
        self.assertEqual(roles[self.greater], HighlightRole.GREATER)

    def testLegendListsTheRolesInUse(self):
        legend = legendHtml([HighlightRole.LESSER, HighlightRole.GREATER, HighlightRole.NONE])
        self.assertLess(legend.index("larger cell"), legend.index("smaller cell"))
        self.assertNotIn("open cell", legend)
        # the legend shows the colour as it appears on the white puzzle background
        self.assertIn(onWhite(roleColor(HighlightRole.LESSER)).name(), legend)
        self.assertEqual(onWhite(roleColor(HighlightRole.NONE)).name(), "#ffffff")

    def testTooltipIsTheDescription(self):
        puzzleIndex = self.model.index(0, 0, QtCore.QModelIndex())
        gridIndex = self.model.index(0, 0, puzzleIndex)
        tooltip = self.model.data(gridIndex, QtCore.Qt.ItemDataRole.ToolTipRole)
        self.assertEqual(tooltip, "<b>Grid</b><br>9 cells: 0 filled, 9 open")


if __name__ == "__main__":
    unittest.main()
