"""The '<' / '>' sign between two Futoshiki cells: a chevron pointing to the lesser cell."""

from math import hypot

from PySide6 import QtCore, QtGui, QtWidgets


class InequalitySign(QtWidgets.QGraphicsPathItem):
    """A chevron centred between two cell centres, its open side facing the greater cell and
    its point facing the lesser cell (so it reads as 'greater > lesser')."""

    def __init__(self, greaterCenter, lesserCenter, depth, width, parent=None):
        super().__init__(parent)
        self.greaterCenter = QtCore.QPointF(greaterCenter)
        self.lesserCenter = QtCore.QPointF(lesserCenter)

        delta = self.lesserCenter - self.greaterCenter
        length = hypot(delta.x(), delta.y())
        if length == 0:
            raise ValueError("an inequality needs two distinct cells")
        direction = delta / length
        normal = QtCore.QPointF(-direction.y(), direction.x())
        middle = (self.greaterCenter + self.lesserCenter) / 2

        self.tip = middle + direction * (depth / 2)
        back = middle - direction * (depth / 2)
        path = QtGui.QPainterPath(back + normal * (width / 2))
        path.lineTo(self.tip)
        path.lineTo(back - normal * (width / 2))
        self.setPath(path)

        pen = QtGui.QPen(QtGui.QColorConstants.Black, max(1.5, depth / 6))
        pen.setCapStyle(QtCore.Qt.PenCapStyle.RoundCap)
        pen.setJoinStyle(QtCore.Qt.PenJoinStyle.RoundJoin)
        self.setPen(pen)
