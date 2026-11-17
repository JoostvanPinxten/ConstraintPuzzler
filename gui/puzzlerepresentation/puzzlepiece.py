from PySide6 import QtCore, QtGui, QtWidgets


# cannot animate the qgraphicsitem directly, so introduce another proxy,
# as multiple inheritance does not work properly for QObject and QGraphicsItem
class PuzzlePieceProxy(QtCore.QObject):
    def __init__(
        self,
        puzzlePiece: QtWidgets.QAbstractGraphicsShapeItem,
        parent: QtCore.QObject | None = None,
    ) -> None:
        super().__init__(parent)
        self.puzzlePiece = puzzlePiece

    def set_pos(self, pos: QtCore.QPointF) -> None:
        self.puzzlePiece.setPos(pos)

    def get_pos(self) -> QtCore.QPointF:
        return self.puzzlePiece.pos()

    pos = QtCore.Property(QtCore.QPointF, get_pos, set_pos)

    def set_color(self, color: QtGui.QColor) -> None:
        self.puzzlePiece.setBrush(QtGui.QBrush(color))

    def get_color(self) -> QtGui.QColor:
        brush = self.puzzlePiece.brush()
        if brush.style() == QtCore.Qt.BrushStyle.NoBrush:
            # not highlighted yet: the colour of an empty brush is black, fade from transparent
            return QtGui.QColor(QtCore.Qt.GlobalColor.transparent)
        return brush.color()

    backgroundColor = QtCore.Property(QtGui.QColor, get_color, set_color)

    def getPuzzlePiece(self) -> QtWidgets.QAbstractGraphicsShapeItem:
        return self.puzzlePiece
