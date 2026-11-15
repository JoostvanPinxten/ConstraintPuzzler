"""A black hexagon around a Sumbrero grid, optionally holding line sums.

Like a Kakuro clue square, the hexagon is cut into parts by white lines: a long diagonal from
the top-right to the bottom-left corner, with the left part left plain, and the right part split
into three wedges. A line that starts next to the hexagon has its sum in the wedge that faces
along the line: S for a column, SE for a row running down-right, NE for a row running up-right.
"""

from math import sqrt

from PySide6 import QtCore, QtGui, QtWidgets

CLUE_DIRECTIONS = ("NE", "SE", "S")


class ClueHexagon(QtWidgets.QGraphicsPolygonItem):
    def __init__(self, size, position, clues=None, parent=None):
        """size: width of the (flat-topped) hexagon; position: its top-left corner in the
        scene; clues: {direction: constraint} with direction in CLUE_DIRECTIONS."""
        self.size = size
        height = size * sqrt(3) / 2
        x, y = position.x(), position.y()
        self.corners = {
            "right": QtCore.QPointF(x + size, y + height / 2),
            "bottomRight": QtCore.QPointF(x + 0.75 * size, y + height),
            "bottomLeft": QtCore.QPointF(x + 0.25 * size, y + height),
            "left": QtCore.QPointF(x, y + height / 2),
            "topLeft": QtCore.QPointF(x + 0.25 * size, y),
            "topRight": QtCore.QPointF(x + 0.75 * size, y),
        }
        self.center = QtCore.QPointF(x + size / 2, y + height / 2)
        super().__init__(QtGui.QPolygonF(list(self.corners.values())), parent)

        self.setBrush(QtGui.QColorConstants.Black)
        self.setPen(self.whitePen())
        self.setCacheMode(QtWidgets.QGraphicsItem.CacheMode.DeviceCoordinateCache)

        corners = self.corners
        for start, end in (
            (corners["topRight"], corners["bottomLeft"]),  # through the center
            (self.center, corners["right"]),
            (self.center, corners["bottomRight"]),
        ):
            line = QtWidgets.QGraphicsLineItem(QtCore.QLineF(start, end), self)
            line.setPen(self.whitePen())

        self.clues = dict(clues or {})
        self.textItems = {}
        for direction, constraint in self.clues.items():
            self.textItems[direction] = self.addClueText(direction, constraint.getTotalValue())

    def whitePen(self):
        pen = QtGui.QPen(QtGui.QColorConstants.White)
        pen.setWidthF(max(1.0, self.size / 50))
        return pen

    def wedgeCorners(self, direction):
        """The corners of the triangle that holds the sum of a line running in direction."""
        corners = self.corners
        outer = {
            "NE": (corners["topRight"], corners["right"]),
            "SE": (corners["right"], corners["bottomRight"]),
            "S": (corners["bottomRight"], corners["bottomLeft"]),
        }[direction]
        return [self.center, *outer]

    def wedge(self, direction):
        """The triangle that holds the sum of a line running in direction."""
        return QtGui.QPolygonF(self.wedgeCorners(direction))

    def addClueText(self, direction, value):
        text = QtWidgets.QGraphicsSimpleTextItem(str(value), self)
        font = QtGui.QFont("Sans serif")
        font.setBold(True)
        # the wedges are equilateral triangles with sides of size / 2
        font.setPixelSize(round(self.size * 0.16))
        text.setFont(font)
        text.setBrush(QtGui.QColorConstants.White)

        centroid = sum(self.wedgeCorners(direction), QtCore.QPointF()) / 3
        text.setPos(centroid - text.boundingRect().center())
        return text

    def updateRepresentation(self):
        """Clue sums do not change while solving."""
