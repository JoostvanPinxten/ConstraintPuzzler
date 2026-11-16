"""The puzzle window layer for the solver buttons: Solve (in a background thread, cancellable),
Hint and Solve single step."""

from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6 import QtCore, QtGui, QtWidgets

from gui.solverworker import SolveJob, SolveWorker
from gui.windows.cellinputwindow import CellInputWindow
from structure.errors import ContradictionError

if TYPE_CHECKING:
    from structure.types import PuzzleState


class SolvingWindow(CellInputWindow):
    def solveButtonClicked(self) -> None:
        """Solve in a background thread; while it runs, the button cancels it."""
        if self.solveJob is not None:
            self.solveJob.cancel()
            self.ui.solvePushButton.setEnabled(False)  # until the solver has stopped
            return
        if self.solver is None or self.game is None or self.puzzleFile is None:
            return
        self.solver.allowGuessing = self.settings.allowGuessing
        parser, path = self.puzzleType.parser, self.puzzleFile
        worker = SolveWorker(
            lambda: parser(path), self.game.puzzle.saveState(), self.settings.allowGuessing
        )
        worker.finished.connect(self.solveFinished)
        worker.failed.connect(self.solveFailed)
        worker.cancelled.connect(self.solveCancelled)
        job = SolveJob(worker, self)
        job.done.connect(self.solveJobDone)
        self.solveJob = job
        self.setSolving(True)
        job.start()

    def setSolving(self, solving: bool) -> None:
        self.ui.solvePushButton.setText("Cancel" if solving else "Solve")
        self.ui.solvePushButton.setEnabled(True)
        self.ui.solveStepPushButton.setEnabled(not solving)
        self.ui.hintPushButton.setEnabled(not solving)
        self.updateUndoActions()

    def solveFinished(self, state: PuzzleState, solved: bool) -> None:
        if self.game is None:
            return
        self.game.applySolution(state)
        self.inputMessage = None
        self.stepMessage = None if solved else "The solver got stuck; try Allow guessing."
        # cells may have been solved: refresh their colours and the description
        self.puzzleChanged()

    def solveFailed(self, message: str) -> None:
        QtWidgets.QMessageBox.warning(
            self,
            "Puzzle cannot be solved",
            "The solver ran into a contradiction:\n\n" + message,
        )

    def solveCancelled(self) -> None:
        self.stepMessage = "Solving was cancelled."
        self.updateSelectionInfo()

    def solveJobDone(self) -> None:
        job = self.solveJob
        self.solveJob = None
        if job is not None:
            job.deleteLater()
        self.setSolving(False)

    def stopSolving(self) -> None:
        """Cancel a running solve and wait until its thread has stopped."""
        job = self.solveJob
        if job is None:
            return
        job.cancel()
        job.wait()
        # deliver the worker's queued signals, which clears self.solveJob
        self.waitForSolve()

    def waitForSolve(self, timeout: int = 30000) -> bool:
        """Process events until a running solve has finished (e.g. in tests). Returns whether
        it finished within `timeout` milliseconds."""
        timer = QtCore.QElapsedTimer()
        timer.start()
        while self.solveJob is not None:
            if timer.elapsed() > timeout:
                return False
            QtCore.QCoreApplication.processEvents(QtCore.QEventLoop.ProcessEventsFlag.AllEvents, 50)
        return True

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        self.stopSolving()
        super().closeEvent(event)

    def hintButtonClicked(self) -> None:
        """Show a cell whose value follows from the constraints, and why, without filling it."""
        if self.solver is None or self.game is None or self.solveJob is not None:
            return
        try:
            hint = self.solver.hint()
        except ContradictionError as e:
            QtWidgets.QMessageBox.warning(
                self,
                "Puzzle cannot be solved",
                "The solver ran into a contradiction:\n\n" + str(e),
            )
            return
        if hint is None:
            QtWidgets.QMessageBox.information(
                self,
                "No hint",
                "No value follows from a single round of the rules. Use Solve single step to"
                " narrow down the candidates, or Solve.",
            )
            return
        self.selectCell(hint.cell)
        self.stepMessage = "Hint: " + hint.describe()
        self.updateSelectionInfo()

    def solveStepButtonClicked(self) -> None:
        """Fill in one deducible cell, so the solver can be followed step by step."""
        if self.solver is None or self.game is None or self.game.puzzle.isSolved():
            return
        try:
            changed = self.game.solveStep(self.solver)
        except ContradictionError as e:
            QtWidgets.QMessageBox.warning(
                self,
                "Puzzle cannot be solved",
                "The solver ran into a contradiction:\n\n" + str(e),
            )
            return
        # a cell may have been solved: refresh its colour and the description
        self.puzzleChanged()
        step = self.solver.lastStep
        if step is not None:
            # select the filled cell and explain why it has this value
            self.selectCell(step.cell)
            self.stepMessage = "Solver step: " + step.describe()
            self.updateSelectionInfo()
        if not changed:
            QtWidgets.QMessageBox.information(
                self,
                "No progress",
                "A deduction step does not change the puzzle any further."
                + (
                    " Use Solve to continue by guessing."
                    if self.settings.allowGuessing
                    else " Enable Solver > Allow guessing and use Solve to continue."
                ),
            )
