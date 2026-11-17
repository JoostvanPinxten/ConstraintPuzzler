from __future__ import annotations

from collections.abc import Iterable
from math import ceil, sqrt
from typing import TYPE_CHECKING, overload

from structure.cell import Cell, PositionedCell

if TYPE_CHECKING:
    from structure.position import Position
    from structure.puzzle import Puzzle
    from structure.types import Value


class Grid:
    def __init__(self, values: Iterable[Value], parent: Puzzle) -> None:
        self.values: list[Value] = list(values)
        self.cells: list[Cell] = []
        self.parent = parent

    @overload
    def addCell(self, position: Position) -> PositionedCell: ...

    @overload
    def addCell(self, position: None = None) -> Cell: ...

    def addCell(self, position: Position | None = None) -> Cell:
        if position is not None:
            c: Cell = PositionedCell(self.values, self, position)
        else:
            c = Cell(self.values, self)
        self.cells.append(c)
        return c

    def getCells(self) -> list[Cell]:
        return self.cells

    def getPositionedCells(self) -> list[PositionedCell]:
        """The cells that have a position (in the puzzle types here, every cell)."""
        return [c for c in self.cells if isinstance(c, PositionedCell)]

    def __str__(self) -> str:
        s = (
            "cells("
            + str(len(self.cells))
            + ") : [\n   "
            + ",\n   ".join([str(c) for c in self.cells])
            + "\n]"
        )

        return s

    def getCellFromSquareGrid(self, x: int, y: int) -> Cell:
        """Get the cell at (x, y), assuming all cells are laid out in a square grid."""
        index = x + int(ceil(sqrt(len(self.cells)) * y))
        return self.cells[index]

    def searchCellWithPosition(self, pos: Position) -> PositionedCell:
        for c in self.getPositionedCells():
            if c.position == pos:
                return c

        raise Exception("Not found" + str(pos))

    def setConstraintGridValue(self, x: int, y: int, value: Value) -> None:
        cell = self.getCellFromSquareGrid(x, y)
        cell.setValue(value)

    def getPuzzle(self) -> Puzzle:
        return self.parent
