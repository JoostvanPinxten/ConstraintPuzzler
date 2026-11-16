"""The state shared by the layers of a puzzle window (see BasicMainWindow).

A puzzle window is built up in layers, each a QMainWindow subclass of the previous one:
SelectionWindow (tree selection, highlight and explanation), CellInputWindow (entering values),
SolvingWindow (Solve, Hint, Solve single step) and BasicMainWindow (loading, menus, undo).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from PySide6 import QtCore, QtWidgets

if TYPE_CHECKING:
    from gui.highlighting import HighlightRole
    from gui.puzzlemodel.puzzletreemodel import ConstraintPuzzleModel, ProxyItem
    from gui.puzzlerepresentation.puzzlepiece import PuzzlePieceProxy
    from gui.settings import PuzzleSettings
    from gui.solverworker import SolveJob
    from gui.ui.mainWindowUi import Ui_MainWindow
    from solver.solver import Solver
    from structure.cell import Cell
    from structure.game import Game
    from structure.puzzle import Puzzle
    from utility.puzzletypes import PuzzleType


class PuzzleWindowBase(QtWidgets.QMainWindow):
    # Set by subclasses: the registry entry (utility.puzzletypes) with the type's label,
    # parser, file filter and bundled examples
    puzzleType: PuzzleType

    ui: Ui_MainWindow
    settings: PuzzleSettings
    embedded: bool
    puzzleFile: str | None
    puzzle: Puzzle | None
    solver: Solver | None
    # the play state of the loaded puzzle (None before a puzzle is loaded)
    game: Game | None
    constraintModel: ConstraintPuzzleModel

    # Set by subclasses in initializePuzzleRepresentation() (see newScene/addCellPiece):
    # the graphics item of every cell (a CellPiece) and of the clues (keyed by constraint)
    scene: QtWidgets.QGraphicsScene
    puzzlePieces: dict[Any, Any]
    # one animation proxy per cell, for the highlight fade
    puzzlePieceProxies: dict[Cell, PuzzlePieceProxy]
    # the tree items selected, and the role each highlighted cell plays in them
    selectedItems: set[ProxyItem]
    highlightRoles: dict[Cell, HighlightRole]
    # the running fade of the cell highlight, if any (kept so it is not garbage collected)
    highlightAnimation: QtCore.QParallelAnimationGroup | None
    # a message about entering a value, and one explaining the last solver step or hint
    inputMessage: str | None
    stepMessage: str | None
    # the cells whose shown value breaks a rule (drawn in red)
    violations: set[Cell]
    # to find the cell under the mouse, and the tree row of a cell
    pieceCells: dict[Any, Cell]
    cellIndexes: dict[Cell, QtCore.QModelIndex]
    # the running background solve, if any (see SolvingWindow.solveButtonClicked)
    solveJob: SolveJob | None

    def updateUndoActions(self) -> None:
        """Enable or disable undo and redo (BasicMainWindow has the Edit menu)."""
