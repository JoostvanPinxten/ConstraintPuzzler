"""The state of playing one puzzle: the puzzle, the user's entries and an undo history.

The puzzle (its cells, groups and given values) is the definition. On top of it, a Game keeps
what happened while playing: values the user entered (including mistakes, see UserEntries)
and values the solver filled in, each cell remembering where its value came from
(structure.cell.ValueSource).

Every change goes through a Game action (enter, clear, solve, solveStep). Before an action the
game takes a snapshot of the puzzle and the entries; when the action changed anything, that
snapshot goes on the undo stack. undo() and redo() restore snapshots.

The solver is passed in, so this module does not depend on the solver package.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING

from structure.entries import UserEntries

if TYPE_CHECKING:
    # for the annotations only: at run time, this module does not import the solver
    from solver.Solver import Solver
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.puzzle import Puzzle
    from structure.types import PuzzleState, Value

# what undo() goes back to: the puzzle, and the entries and mistakes
type Snapshot = tuple[PuzzleState, dict[Cell, Value], dict[Cell, Value]]


class Game:
    def __init__(self, puzzle: Puzzle, maxHistory: int = 1000) -> None:
        self.puzzle = puzzle
        self.entries = UserEntries(puzzle)
        self.undoStack: list[Snapshot] = []
        self.redoStack: list[Snapshot] = []
        self.maxHistory = maxHistory

    # --- history --------------------------------------------------------------------------

    def _snapshot(self) -> Snapshot:
        return (self.puzzle.saveState(), dict(self.entries.entries), dict(self.entries.mistakes))

    def _restore(self, snapshot: Snapshot) -> None:
        state, entries, mistakes = snapshot
        self.puzzle.restoreState(state)
        self.entries.entries = dict(entries)
        self.entries.mistakes = dict(mistakes)

    def perform[T](self, action: Callable[[], T]) -> T:
        """Run action() as one undoable step and return its result.

        If the action raises, nothing is recorded; the action must leave the puzzle unchanged
        in that case (UserEntries and the Solver do)."""
        before = self._snapshot()
        result = action()
        if self._snapshot() != before:
            self.undoStack.append(before)
            del self.undoStack[: -self.maxHistory]
            self.redoStack.clear()
        return result

    def canUndo(self) -> bool:
        return bool(self.undoStack)

    def canRedo(self) -> bool:
        return bool(self.redoStack)

    def undo(self) -> bool:
        """Go back to the state before the last action. Returns whether there was one."""
        if not self.undoStack:
            return False
        self.redoStack.append(self._snapshot())
        self._restore(self.undoStack.pop())
        return True

    def redo(self) -> bool:
        """Redo the last undone action. Returns whether there was one."""
        if not self.redoStack:
            return False
        self.undoStack.append(self._snapshot())
        self._restore(self.redoStack.pop())
        return True

    # --- actions --------------------------------------------------------------------------

    def enter(self, cell: Cell, value: Value) -> None:
        """Enter a value in a cell (see UserEntries.enter)."""
        self.perform(lambda: self.entries.enter(cell, value))

    def clear(self, cell: Cell) -> None:
        """Clear the value of a cell (see UserEntries.clear)."""
        self.perform(lambda: self.entries.clear(cell))

    def solve(self, solver: Solver) -> bool:
        """Let the solver fill in the puzzle. Mistakes in cells the solver filled in are
        dropped, so the solution is shown. Returns whether the puzzle is solved."""

        def action() -> bool:
            solved = solver.solve()
            self.entries.dropMistakes(c for c in self.puzzle.getGrid().getCells() if c.hasValue())
            return solved

        return self.perform(action)

    def applySolution(self, state: PuzzleState) -> None:
        """Set the puzzle to a state the solver found elsewhere (e.g. on a copy of the puzzle,
        in another thread), as one undoable step. Mistakes in the cells it fills are dropped,
        as with solve()."""

        def action() -> None:
            self.puzzle.restoreState(state)
            self.entries.dropMistakes(c for c in self.puzzle.getGrid().getCells() if c.hasValue())

        self.perform(action)

    def solveStep(self, solver: Solver, preferred: Deduction | None = None) -> bool:
        """Let the solver fill in a single cell (the one of `preferred`, e.g. the hint shown
        last, when it can). Returns whether the puzzle changed."""
        return self.perform(lambda: solver.solveStep(preferred))

    # --- queries --------------------------------------------------------------------------

    def valueOf(self, cell: Cell) -> Value | None:
        return self.entries.valueOf(cell)

    def isMistake(self, cell: Cell) -> bool:
        return self.entries.isMistake(cell)

    def violations(self) -> set[Cell]:
        """The cells whose shown value breaks a rule, including every mistake."""
        return self.entries.violations()

    def isSolved(self, violations: set[Cell] | None = None) -> bool:
        """Every cell has a value and no shown value breaks a rule."""
        if violations is None:
            violations = self.violations()
        return self.puzzle.isSolved() and not violations

    def violationNote(self, cell: Cell, violations: set[Cell] | None = None) -> str | None:
        """Explain why the value of a cell breaks a rule (None when it does not)."""
        if violations is None:
            violations = self.violations()
        if cell not in violations:
            return None
        value = self.valueOf(cell)
        clashes = set()
        for group in cell.getConstraintGroups():
            clashes |= violations & set(group.getCells())
        clashes.discard(cell)
        if clashes:
            names = ", ".join(sorted(c.getName() for c in clashes))
            return f"{value} breaks a rule together with cell(s) {names}."
        return f"{value} does not fit: it leaves no possible value for another cell."
