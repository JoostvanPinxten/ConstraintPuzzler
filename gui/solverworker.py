"""Solving in a background thread, so the window stays responsive and can cancel.

The puzzle shown in a window cannot be solved in another thread: its cells notify the window's
graphics items directly, and Qt widgets may only be used from the GUI thread. So the worker
solves a detached copy of the puzzle (built by the puzzle type's parser, then set to the current
state) and reports the resulting state; the window applies that state on the GUI thread.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from typing import TYPE_CHECKING

from PySide6 import QtCore

from solver.solver import SolveCancelled, Solver
from structure.errors import ContradictionError

if TYPE_CHECKING:
    from structure.puzzle import Puzzle
    from structure.types import PuzzleState


class SolveWorker(QtCore.QObject):
    # the solved (or as far as possible deduced) state, and whether the puzzle is solved
    finished = QtCore.Signal(object, bool)
    # the puzzle cannot be solved: the reason
    failed = QtCore.Signal(str)
    cancelled = QtCore.Signal()

    def __init__(
        self, makePuzzle: Callable[[], Puzzle], state: PuzzleState, allowGuessing: bool
    ) -> None:
        """makePuzzle(): a new, independent puzzle with the same structure as the shown one;
        state: the shown puzzle's saveState()."""
        super().__init__()
        self.makePuzzle = makePuzzle
        self.state = state
        self.allowGuessing = allowGuessing
        self._stop = threading.Event()

    def cancel(self) -> None:
        """Ask the solver to stop; it does so between passes and guesses."""
        self._stop.set()

    @QtCore.Slot()
    def run(self) -> None:
        try:
            puzzle = self.makePuzzle()
            puzzle.restoreState(self.state)
            solver = Solver(puzzle, allowGuessing=self.allowGuessing)
            solved = solver.solve(shouldStop=self._stop.is_set)
        except SolveCancelled:
            self.cancelled.emit()
        except ContradictionError as e:
            self.failed.emit(str(e))
        except Exception as e:  # report anything else instead of losing it in the thread
            self.failed.emit(f"{type(e).__name__}: {e}")
        else:
            self.finished.emit(puzzle.saveState(), solved)


class SolveJob(QtCore.QObject):
    """Runs a SolveWorker in its own QThread and cleans both up when it is done."""

    done = QtCore.Signal()

    def __init__(self, worker: SolveWorker, parent: QtCore.QObject | None = None) -> None:
        super().__init__(parent)
        self.worker = worker
        self.workerThread = QtCore.QThread()
        worker.moveToThread(self.workerThread)
        self.workerThread.started.connect(worker.run)
        # Stop the thread's event loop from the worker thread itself (QThread.quit is
        # thread-safe). A queued call would need the GUI thread's event loop, so wait() on the
        # GUI thread (e.g. when the window closes) would never return.
        for signal in (worker.finished, worker.failed, worker.cancelled):
            signal.connect(self.workerThread.quit, QtCore.Qt.ConnectionType.DirectConnection)
        self.workerThread.finished.connect(self.done)

    def start(self) -> None:
        self.workerThread.start()

    def cancel(self) -> None:
        self.worker.cancel()

    def isRunning(self) -> bool:
        return self.workerThread.isRunning()

    def wait(self, milliseconds: int = -1) -> bool:
        """Block until the thread has finished (call cancel first to make that quick)."""
        if milliseconds < 0:
            return self.workerThread.wait()
        return self.workerThread.wait(milliseconds)
