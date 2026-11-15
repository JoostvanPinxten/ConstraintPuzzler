"""Which cells to highlight for the item selected in the puzzle tree, and in which colour.

Every cell gets a role: e.g. the smaller and the larger cell of a greater-than constraint, or
the open and the solved cells of a constraint group. The role decides the colour of the cell,
so the highlight shows how the cells take part in the selected item, not only which cells.
"""

import html
from enum import IntEnum

from PySide6 import QtGui

from constraints.cellgreaterthancellconstraint import CellGreaterThanCellConstraint
from gui.puzzlemodel.puzzletreemodel import (
    CellProxyItem,
    ConstraintGroupProxyItem,
    ConstraintProxyItem,
    GridProxyItem,
    ReferencedCellProxyItem,
)


class HighlightRole(IntEnum):
    """How a cell takes part in the selection. A higher value wins when roles overlap."""

    NONE = 0
    PEER = 1  # shares a constraint group with the selected cell
    OPEN = 2  # cell of the selection without a value yet
    SOLVED = 3  # cell of the selection that has a value
    LESSER = 4  # the smaller cell of a greater-than constraint
    GREATER = 5  # the larger cell of a greater-than constraint
    SELECTED = 6  # the selected cell itself


ROLE_COLORS = {
    # NONE keeps the hue of OPEN, so fading in and out does not pass through another colour
    HighlightRole.NONE: QtGui.QColor(255, 255, 0, 0),
    HighlightRole.PEER: QtGui.QColor(255, 255, 0, 45),
    HighlightRole.OPEN: QtGui.QColor(255, 255, 0, 110),
    HighlightRole.SOLVED: QtGui.QColor(90, 200, 90, 110),
    HighlightRole.LESSER: QtGui.QColor(70, 140, 255, 130),
    HighlightRole.GREATER: QtGui.QColor(255, 130, 30, 140),
    HighlightRole.SELECTED: QtGui.QColor(255, 190, 0, 190),
}

ROLE_LABELS = {
    HighlightRole.PEER: "shares a group with the cell",
    HighlightRole.OPEN: "open cell",
    HighlightRole.SOLVED: "solved cell",
    HighlightRole.LESSER: "smaller cell",
    HighlightRole.GREATER: "larger cell",
    HighlightRole.SELECTED: "selected cell",
}


def roleColor(role: HighlightRole) -> QtGui.QColor:
    return QtGui.QColor(ROLE_COLORS[role])


def onWhite(color: QtGui.QColor) -> QtGui.QColor:
    """The opaque colour a translucent colour shows on the (white) puzzle background."""
    alpha = color.alphaF()

    def blend(channel):
        return round(channel * alpha + 255 * (1 - alpha))

    return QtGui.QColor(blend(color.red()), blend(color.green()), blend(color.blue()))


def _memberRoles(cells) -> dict:
    return {c: HighlightRole.SOLVED if c.hasValue() else HighlightRole.OPEN for c in cells}


def highlightRoles(item) -> dict:
    """Map the cells involved in a tree item to their HighlightRole."""
    if isinstance(item, (CellProxyItem, ReferencedCellProxyItem)):
        cell = item.cell
        puzzle = cell.getGrid().getPuzzle()
        roles = {}
        for group in puzzle.getConstraintGroups():
            if cell in group.getCells():
                roles.update(dict.fromkeys(group.getCells(), HighlightRole.PEER))
        roles[cell] = HighlightRole.SELECTED
        return roles

    if isinstance(item, ConstraintProxyItem):
        roles = _memberRoles(item.getCells())
        constraint = item.constraint
        if isinstance(constraint, CellGreaterThanCellConstraint):
            if constraint.lesserCell is not None:
                roles[constraint.lesserCell] = HighlightRole.LESSER
            if constraint.greaterCell is not None:
                roles[constraint.greaterCell] = HighlightRole.GREATER
        return roles

    if isinstance(item, (ConstraintGroupProxyItem, GridProxyItem)):
        return _memberRoles(item.getCells())

    return {}


def combinedHighlightRoles(items) -> dict:
    """The roles for several selected items; the strongest role wins for shared cells."""
    roles = {}
    for item in items:
        for cell, role in highlightRoles(item).items():
            roles[cell] = max(role, roles.get(cell, HighlightRole.NONE))
    return roles


def legendHtml(roles) -> str:
    """A legend (as rich text) for the roles that are in use, strongest first."""
    entries = []
    for role in sorted(set(roles), reverse=True):
        if role == HighlightRole.NONE:
            continue
        color = onWhite(roleColor(role))
        entries.append(
            f'<span style="color:{color.name()}">&#9632;</span>&nbsp;'
            f"{html.escape(ROLE_LABELS[role])}"
        )
    return " &nbsp; ".join(entries)
