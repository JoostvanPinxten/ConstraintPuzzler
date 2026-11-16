"""Type aliases shared by the puzzle model, the constraints and the solver."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable

    from structure.cell import Cell, ValueSource

# the value of a cell (the puzzles use whole numbers)
type Value = int

# the solving state of one cell in a snapshot: candidates, value, where the value came from
type CellState = tuple[frozenset[Value], Value | None, ValueSource | None]

# a snapshot of a puzzle (Puzzle.saveState): the cell states and each constraint's own values
type PuzzleState = tuple[tuple[CellState, ...], tuple[tuple[Value, ...], ...]]

# the value shown in a cell, or None (Constraint.violations): it may be a mistake the user
# typed in, which is not the cell's value in the model
type ValueOf = Callable[[Cell], Value | None]
