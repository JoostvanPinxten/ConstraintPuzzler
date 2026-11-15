"""Settings shared by every puzzle shown in one application window."""

from PySide6 import QtCore


class PuzzleSettings(QtCore.QObject):
    """Solver settings; the launcher shares one instance between all of its puzzle tabs."""

    allowGuessingChanged = QtCore.Signal(bool)

    def __init__(self, parent: QtCore.QObject | None = None):
        super().__init__(parent)
        self._allowGuessing = False

    @property
    def allowGuessing(self) -> bool:
        return self._allowGuessing

    @allowGuessing.setter
    def allowGuessing(self, allow: bool) -> None:
        if allow != self._allowGuessing:
            self._allowGuessing = allow
            self.allowGuessingChanged.emit(allow)

    def setAllowGuessing(self, allow: bool) -> None:
        self.allowGuessing = allow
