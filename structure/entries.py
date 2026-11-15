"""Values typed in by the user, on top of the puzzle as it was loaded.

Entering a value in an open cell simply sets it, so the constraints propagate it like any
other value. Changing or clearing a value cannot be undone in place (the propagation has
already removed candidates elsewhere), so the puzzle is restored to its loaded state and the
remaining entries are entered again. Values deduced by the solver are lost that way; the
solver can deduce them again.
"""

from structure.errors import ContradictionError


class EntryError(ValueError):
    """The value cannot be entered: e.g. the cell is given, or the value is not possible."""


class UserEntries:
    def __init__(self, puzzle):
        self.puzzle = puzzle
        self.initialState = puzzle.saveState()
        # cell -> value, in the order the values were entered
        self.entries = {}

    def canEdit(self, cell):
        return not cell.isGiven()

    def enter(self, cell, value):
        """Enter a value in a cell, replacing its current value (if any).

        Raises an EntryError (and leaves the puzzle unchanged) when this is not possible."""
        name = cell.getName()
        if cell.isGiven():
            raise EntryError(f"Cell {name} is given; its value cannot be changed.")
        if value not in self.puzzle.getValues():
            raise EntryError(f"{value} is not a value of this puzzle.")
        if cell.getValue() == value:
            return

        entries = dict(self.entries)
        entries.pop(cell, None)
        entries[cell] = value
        if not cell.hasValue():
            if value not in cell.getPossibleValues():
                raise EntryError(f"{value} is not possible in cell {name}.")
            self._apply(lambda: cell.setValue(value, isEntered=True), entries)
        else:
            self._apply(lambda: self._replay(entries), entries)

    def clear(self, cell):
        """Remove the value of a cell that is not given."""
        if cell.isGiven():
            raise EntryError(f"Cell {cell.getName()} is given; its value cannot be cleared.")
        if not cell.hasValue():
            return
        entries = dict(self.entries)
        entries.pop(cell, None)
        self._apply(lambda: self._replay(entries), entries)

    def _apply(self, change, entries):
        """Make a change; on a contradiction, put the puzzle back as it was."""
        state = self.puzzle.saveState()
        try:
            change()
        except ContradictionError as e:
            self.puzzle.restoreState(state)
            raise EntryError(f"That contradicts the puzzle: {e}") from e
        self.entries = entries

    def _replay(self, entries):
        self.puzzle.restoreState(self.initialState)
        for cell, value in entries.items():
            if value not in cell.getPossibleValues():
                raise ContradictionError(f"{value} is no longer possible in cell {cell.getName()}")
            cell.setValue(value, isEntered=True)
