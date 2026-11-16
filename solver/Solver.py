"""
Created on 28 dec. 2012

@author: Juice
"""

from __future__ import annotations

import random
from collections.abc import Callable, Iterable
from contextlib import AbstractContextManager
from typing import TYPE_CHECKING

from structure.cell import ValueSource
from structure.deduction import DeductionLog
from structure.errors import ContradictionError

if TYPE_CHECKING:
    from constraints.constraintgroup import ConstraintGroup
    from structure.cell import Cell
    from structure.deduction import Deduction
    from structure.puzzle import Puzzle
    from structure.types import PuzzleState


class SolveCancelled(Exception):
    """solve() was stopped by its shouldStop callback; the puzzle is restored."""


class Solver:
    """Solves a puzzle by applying its constraints until nothing changes, and, if allowed,
    by guessing (depth-first, with backtracking) when deduction gets stuck.

    Every change is recorded as a Deduction (structure.deduction) in `log`, with the
    constraint that made it. Propagation only re-applies the constraint groups of the cells
    that changed in the previous pass."""

    def __init__(self, puzzle: Puzzle, allowGuessing: bool = False) -> None:
        self.puzzle = puzzle
        # when deduction gets stuck, try values (depth-first, with backtracking)
        self.allowGuessing = allowGuessing
        # picks the cell that solveStep() fills in
        self.random = random.Random()
        # the changes of the last solve() / propagate() / solveStep()
        self.log = DeductionLog()
        # the value filled in by the last solveStep() (a Deduction), if any
        self.lastStep: Deduction | None = None
        # set during solve(): returns True when the caller wants the solver to stop
        self.shouldStop: Callable[[], bool] | None = None

    def _checkStop(self) -> None:
        if self.shouldStop is not None and self.shouldStop():
            raise SolveCancelled("solving was cancelled")

    def step(
        self,
        groups: Iterable[ConstraintGroup] | None = None,
        cells: Iterable[Cell] | None = None,
    ) -> None:
        """A single deduction pass over the given cells and constraint groups (default: all)."""
        if cells is None:
            cells = self.puzzle.getGrid().getCells()
        if groups is None:
            groups = self.puzzle.getConstraintGroups()
        for cell in cells:
            cell.checkForSinglePossibility()
        for cg in groups:
            cg.applyConstraints()

    def _record(self) -> AbstractContextManager[DeductionLog]:
        """Record the changes made inside the block in the solver's log (a fresh log, unless
        the puzzle is already recording into it)."""
        if self.puzzle.deductionLog is not self.log:
            self.log = DeductionLog()
        return self.puzzle.recording(self.log)

    def _deducedValues(self, start: int = 0) -> list[Deduction]:
        """The values deduced (not guessed) since position `start` of the log."""
        return [
            d for d in self.log.since(start) if d.setsValue() and d.source is ValueSource.DEDUCED
        ]

    def _easiest(self, deductions: list[Deduction]) -> Deduction:
        """One of the easiest deductions (see Deduction.difficulty), chosen at random."""
        lowest = min(d.difficulty() for d in deductions)
        return self.random.choice([d for d in deductions if d.difficulty() == lowest])

    def hint(self) -> Deduction | None:
        """The next value the rules determine (a Deduction with its reason), without changing
        the puzzle; of the values a pass determines, one of the easiest is chosen. None when a
        deduction pass does not determine any value. Raises ContradictionError when the pass
        shows that the puzzle has no solution."""
        state = self.puzzle.saveState()
        try:
            with self._record():
                self.step()
            values = self._deducedValues()
        finally:
            self.puzzle.restoreState(state)
        return self._easiest(values) if values else None

    def solveStep(self, preferred: Deduction | None = None) -> bool:
        """Fill in a single cell, e.g. to follow the solver step by step (no guessing).
        A deduction pass is tried; if it determines the values of one or more cells, the puzzle
        is reset and only one of those cells gets its value (lastStep tells which, and why):
        the cell and value of `preferred` (e.g. the hint shown last) if the pass determines
        it, else one of the easiest deductions. If the pass only narrows down possible values,
        that narrowing is kept, so the next step can progress.
        Returns whether the puzzle changed. Raises ContradictionError if the pass detects that
        the puzzle has no solution; the puzzle is then restored to the state it had before."""
        state = self.puzzle.saveState()
        self.lastStep = None
        try:
            with self._record():
                self.step()
                values = self._deducedValues()
                if values:
                    self.puzzle.restoreState(state)
                    chosen = self._preferredOrEasiest(values, preferred)
                    assert chosen.value is not None  # _deducedValues only lists set values
                    self.log.truncate(0)
                    with self.puzzle.causedBy(chosen.cause):
                        chosen.cell.inferValue(chosen.value)
                    self.lastStep = self.log.deductions[0]
        except ContradictionError:
            self.puzzle.restoreState(state)
            raise
        return self.puzzle.saveState() != state

    def _preferredOrEasiest(
        self, deductions: list[Deduction], preferred: Deduction | None
    ) -> Deduction:
        if preferred is not None:
            for d in deductions:
                if d.cell is preferred.cell and d.value == preferred.value:
                    return d
        return self._easiest(deductions)

    def propagate(self, state: PuzzleState | None = None) -> None:
        """Repeat deduction passes until a pass no longer changes anything.

        The first pass applies every constraint; later passes only the constraint groups of
        the cells that changed. (state is accepted for compatibility and not needed.)"""
        with self._record():
            groups = cells = None  # everything
            while True:
                self._checkStop()
                start = len(self.log)
                self.step(groups, cells)
                cells = self.log.changedCells(start)
                if not cells:
                    return
                groups = {g for cell in cells for g in cell.getConstraintGroups()}
                # keep the puzzle's order, so the passes are deterministic
                groups = [g for g in self.puzzle.getConstraintGroups() if g in groups]

    def solve(self, shouldStop: Callable[[], bool] | None = None) -> bool:
        """Deduce as much as possible; if allowed, guess when deduction gets stuck.
        Returns whether the puzzle is solved. Raises ContradictionError if the
        puzzle has no solution; the puzzle is then restored to the state it had
        before solve() was called, instead of being left half-updated.

        shouldStop: an optional callable, checked between passes and guesses (e.g. from
        another thread); when it returns True, the puzzle is restored and SolveCancelled
        is raised."""
        initialState = self.puzzle.saveState()
        self.shouldStop = shouldStop
        try:
            with self._record():
                self.propagate()
                if self.allowGuessing and not self.puzzle.isSolved() and not self._search():
                    raise ContradictionError(
                        "No solution found, all guesses lead to a contradiction"
                    )
        except (ContradictionError, SolveCancelled):
            self.puzzle.restoreState(initialState)
            raise
        finally:
            self.shouldStop = None
        return self.puzzle.isSolved()

    def countSolutions(self, limit: int = 2) -> int:
        """The number of solutions, counting up to `limit` (with guessing), e.g. to check that
        a puzzle has exactly one. The puzzle is left as it was."""
        initialState = self.puzzle.saveState()
        try:
            with self._record():
                try:
                    self.propagate()
                except ContradictionError:
                    return 0
                return self._count(limit)
        finally:
            self.puzzle.restoreState(initialState)

    def findSolution(
        self, shouldStop: Callable[[], bool] | None = None
    ) -> tuple[PuzzleState, bool]:
        """The solved state of the puzzle (found with guessing, whatever allowGuessing says),
        and whether it is the only solution, e.g. to check a user's entries against. The puzzle
        is left as it was. Raises ContradictionError when there is no solution, and
        SolveCancelled when shouldStop() returns True."""
        initialState = self.puzzle.saveState()
        allowGuessing = self.allowGuessing
        try:
            self.shouldStop = shouldStop
            count = self.countSolutions(limit=2)
            if count == 0:
                raise ContradictionError("The puzzle has no solution")
            self.allowGuessing = True
            self.solve(shouldStop)
            return self.puzzle.saveState(), count == 1
        finally:
            self.allowGuessing = allowGuessing
            self.shouldStop = None
            self.puzzle.restoreState(initialState)

    def _count(self, limit: int) -> int:
        openCells = self.puzzle.getOpenCells()
        if not openCells:
            return 1
        cell = min(openCells, key=lambda c: len(c.getPossibleValues()))
        found = 0
        for value in sorted(cell.getPossibleValues()):
            self._checkStop()
            state = self.puzzle.saveState()
            mark = len(self.log)
            try:
                cell.guessValue(value)
                self.propagate()
                found += self._count(limit - found)
            except ContradictionError:
                pass
            self.puzzle.restoreState(state)
            self.log.truncate(mark)
            if found >= limit:
                break
        return found

    def _search(self) -> bool:
        openCells = self.puzzle.getOpenCells()
        if not openCells:
            return True

        # guess on the most constrained cell first
        cell = min(openCells, key=lambda c: len(c.getPossibleValues()))
        for value in sorted(cell.getPossibleValues()):
            self._checkStop()
            state = self.puzzle.saveState()
            mark = len(self.log)
            try:
                cell.guessValue(value)
                self.propagate()
                if self._search():
                    return True
            except ContradictionError:
                pass
            self.puzzle.restoreState(state)
            # the deductions after the guess were undone with it
            self.log.truncate(mark)
        return False

    def __str__(self) -> str:
        s = str(self.puzzle)
        return s
