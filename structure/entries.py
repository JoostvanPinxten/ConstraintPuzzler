"""Values typed in by the user, on top of the puzzle as it was loaded.

Entering a value that fits the puzzle simply sets it, so the constraints propagate it like
any other value. A value that does not fit (it is not a candidate of the cell, or it leads
to a contradiction) is still accepted, as a *mistake*: it is shown, but kept out of the
puzzle model, so the solver never works with an inconsistent puzzle. ``violations()`` tells
which cells clash.

Changing or clearing a value cannot be undone in place (the propagation has already removed
candidates elsewhere), so the puzzle is restored to its loaded state and all entries are
entered again; an earlier mistake may fit after that. Values deduced by the solver are lost
that way; the solver can deduce them again.
"""

from structure.errors import ContradictionError


class EntryError(ValueError):
    """The value cannot be entered: the cell is given, or it is not a value of the puzzle."""


class UserEntries:
    def __init__(self, puzzle):
        self.puzzle = puzzle
        self.initialState = puzzle.saveState()
        # cell -> value, in the order the values were entered
        self.entries = {}
        # the entries that do not fit the puzzle: cell -> value (not set in the model)
        self.mistakes = {}

    def canEdit(self, cell):
        return not cell.isGiven()

    def isMistake(self, cell):
        return cell in self.mistakes

    def valueOf(self, cell):
        """The value shown in a cell: a mistake typed in it, or else its value in the model."""
        return self.mistakes.get(cell, cell.getValue())

    def enter(self, cell, value):
        """Enter a value in a cell, replacing its current value (if any).

        Raises an EntryError (and leaves the puzzle unchanged) for a given cell or a value
        that the puzzle does not use. A value that does not fit becomes a mistake."""
        if cell.isGiven():
            raise EntryError(f"Cell {cell.getName()} is given; its value cannot be changed.")
        if value not in self.puzzle.getValues():
            raise EntryError(f"{value} is not a value of this puzzle.")
        if self.valueOf(cell) == value:
            return

        entries = dict(self.entries)
        entries.pop(cell, None)
        entries[cell] = value
        if cell.hasValue() or cell in self.mistakes:
            self._replay(entries)
        else:
            self.entries = entries
            self._applyEntry(cell, value)

    def clear(self, cell):
        """Remove the value of a cell that is not given."""
        if cell.isGiven():
            raise EntryError(f"Cell {cell.getName()} is given; its value cannot be cleared.")
        if self.valueOf(cell) is None:
            return
        entries = dict(self.entries)
        entries.pop(cell, None)
        self._replay(entries)

    def violations(self):
        """The cells whose shown value breaks a rule, including every mistake."""
        cells = set(self.mistakes)
        for constraint in self.puzzle.getConstraints():
            cells |= constraint.violations(self.valueOf)
        return cells

    def _applyEntry(self, cell, value):
        """Set an entry in the model; if it does not fit, keep it as a mistake instead."""
        state = self.puzzle.saveState()
        try:
            if value not in cell.getPossibleValues():
                raise ContradictionError(f"{value} is not possible in cell {cell.getName()}")
            cell.setValue(value, isEntered=True)
        except ContradictionError:
            self.puzzle.restoreState(state)
            self.mistakes[cell] = value

    def _replay(self, entries):
        self.puzzle.restoreState(self.initialState)
        self.entries = entries
        self.mistakes = {}
        for cell, value in entries.items():
            self._applyEntry(cell, value)
