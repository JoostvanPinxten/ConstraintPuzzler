"""Settings shared by every puzzle shown in one application window."""

from PySide6 import QtCore, QtGui, QtWidgets


class PuzzleSettings(QtCore.QObject):
    """Solver and display settings; the launcher shares one instance between all of its
    puzzle tabs."""

    allowGuessingChanged = QtCore.Signal(bool)
    showHintsChanged = QtCore.Signal(bool)

    def __init__(self, parent: QtCore.QObject | None = None):
        super().__init__(parent)
        self._allowGuessing = False
        # off by default: the candidates give away much of the solution
        self._showHints = False

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

    @property
    def showHints(self) -> bool:
        """Show the candidate values of open cells, in the cells and in the explanations."""
        return self._showHints

    @showHints.setter
    def showHints(self, show: bool) -> None:
        if show != self._showHints:
            self._showHints = show
            self.showHintsChanged.emit(show)

    def setShowHints(self, show: bool) -> None:
        self.showHints = show


def addShowHintsAction(
    menu: QtWidgets.QMenu, settings: PuzzleSettings, shortcut: bool = True
) -> QtGui.QAction:
    """Add a checkable "Show hints" action to menu, kept in sync with settings.showHints.

    shortcut: give it Ctrl+H; leave it off when an enclosing window has the shortcut, since
    two actions with the same shortcut in one window make it ambiguous."""
    action = menu.addAction("Show hints")
    action.setCheckable(True)
    action.setChecked(settings.showHints)
    if shortcut:
        action.setShortcut(QtGui.QKeySequence("Ctrl+H"))
    action.setToolTip("Show the candidate values of open cells")
    action.toggled.connect(settings.setShowHints)
    settings.showHintsChanged.connect(action.setChecked)
    return action
