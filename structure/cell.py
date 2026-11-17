from __future__ import annotations

from collections.abc import Iterable
from enum import Enum
from typing import TYPE_CHECKING

from structure.errors import ContradictionError
from structure.signal import Signal

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.deduction import DeductionLog
    from structure.grid import Grid
    from structure.position import Position
    from structure.types import Value


class ValueSource(Enum):
    """Where the value of a cell came from."""

    GIVEN = "given"  # part of the puzzle as it was loaded
    ENTERED = "entered"  # typed in by the user
    DEDUCED = "deduced"  # deduced by the solver from the rules
    GUESSED = "guessed"  # tried by the solver while backtracking


class Cell:
    def __init__(self, initialValues: Iterable[Value], grid: Grid) -> None:
        super().__init__()
        # emitted with the cell when it gets a value
        self.valueChanged = Signal()
        # emitted with the cell when candidates are removed (or a snapshot is restored)
        self.possibleValuesChanged = Signal()
        self.initialValues: set[Value] = set(initialValues)
        # the constraint groups this cell is in (filled by ConstraintGroup.addCell)
        self.constraintGroups: list[ConstraintGroup] = []
        self.reset()
        self.grid = grid

    def reset(self) -> None:
        self.values: set[Value] = set(self.initialValues)
        self.value: Value | None = None
        # where the value came from; None while the cell has no value
        self.source: ValueSource | None = None

    def getValue(self) -> Value | None:
        return self.value

    def hasValue(self) -> bool:
        return self.getValue() is not None

    def inferValue(self, value: Value) -> None:
        """Set a value the solver deduced."""
        self.setValue(value, ValueSource.DEDUCED)

    def guessValue(self, value: Value) -> None:
        """Set a value the solver tries while backtracking."""
        self.setValue(value, ValueSource.GUESSED)

    def setValue(self, value: Value, source: ValueSource = ValueSource.GIVEN) -> None:
        if value not in self.values:
            raise ContradictionError(
                "value " + str(value) + " not in my values: " + str(self.values)
            )

        self.source = source

        self.value = value
        self.values = {value}
        log = self._deductionLog()
        if log is not None:
            log.recordValue(self, value, source)

        self.valueChanged.emit(self)

    def getPossibleValues(self) -> set[Value]:
        return set(self.values)

    def remove(self, value: Value) -> None:
        # make sure the set value is not the value that needs to be removed
        if self.value == value:
            raise ContradictionError("value removed that's already set..." + str(self))

        if value not in self.values:
            return  # redundant remove

        self.values.remove(value)
        log = self._deductionLog()
        if log is not None:
            log.recordRemoval(self, value)
        if len(self.values) == 0:
            # the puzzle state is contradictory: no value is left for this cell
            raise ContradictionError(
                "No more options for cell, removed last value:" + str(value) + ", " + str(self)
            )
        self.possibleValuesChanged.emit(self)

    def addConstraintGroup(self, group: ConstraintGroup) -> None:
        group.addCell(self)

    def getConstraintGroups(self) -> list[ConstraintGroup]:
        """The constraint groups this cell is in."""
        return list(self.constraintGroups)

    def __str__(self) -> str:
        val = self.getValue()
        valStr = ""
        if val is not None:
            valStr = ": " + str(val)

        return "[" + ",".join([str(v) for v in self.values]) + valStr + "]"

    def isFixed(self) -> bool:
        return self.value is not None

    def getSource(self) -> ValueSource | None:
        """Where the value came from (a ValueSource), or None without a value."""
        return self.source

    def isInferred(self) -> bool:
        """The value was filled in by the solver (deduced or guessed)."""
        return self.source in (ValueSource.DEDUCED, ValueSource.GUESSED)

    def isGuessed(self) -> bool:
        """The value was tried by the solver while backtracking."""
        return self.source is ValueSource.GUESSED

    def isEntered(self) -> bool:
        """The value was typed in by the user."""
        return self.source is ValueSource.ENTERED

    def isGiven(self) -> bool:
        """The value is part of the puzzle as it was loaded."""
        return self.source is ValueSource.GIVEN

    def getGrid(self) -> Grid:
        return self.grid

    def _deductionLog(self) -> DeductionLog | None:
        """The log that records changes to this cell, if the puzzle is recording."""
        puzzle = self.grid.getPuzzle() if self.grid is not None else None
        return getattr(puzzle, "deductionLog", None)

    def getName(self) -> str:
        return "cell " + str(self.grid.cells.index(self) + 1)

    def checkForSinglePossibility(self) -> None:
        if self.value is None and len(self.values) == 1:
            self.inferValue(next(iter(self.values)))


class PositionedCell(Cell):
    def __init__(self, initialValues: Iterable[Value], grid: Grid, position: Position) -> None:
        super().__init__(initialValues, grid)

        self.position = position

    def getPosition(self) -> Position:
        return self.position

    def setPosition(self, position: Position) -> None:
        self.position = position

    def getName(self) -> str:
        return str(self.position.x()) + ", " + str(self.position.y())

    def __str__(self) -> str:
        val = self.getValue()
        valStr = ""
        if val is not None:
            valStr = ": " + str(val)

        return (
            "[pos:"
            + str(self.position)
            + ";"
            + ",".join([str(v) for v in self.values])
            + valStr
            + "]"
        )
