"""
Created on 28 dec. 2012

@author: Juice
"""

import random

from structure.errors import ContradictionError


class Solver:
    def __init__(self, puzzle, allowGuessing=False):
        self.puzzle = puzzle
        # when deduction gets stuck, try values (depth-first, with backtracking)
        self.allowGuessing = allowGuessing
        # picks the cell that solveStep() fills in
        self.random = random.Random()

    def step(self):
        """A single deduction pass over all cells and constraint groups"""
        for cell in self.puzzle.getGrid().getCells():
            cell.checkForSinglePossibility()
        for cg in self.puzzle.getConstraintGroups():
            cg.applyConstraints()

    def solveStep(self):
        """Fill in a single cell, e.g. to follow the solver step by step (no guessing).
        A deduction pass is tried; if it determines the values of one or more cells, the puzzle
        is reset and only one of those cells, chosen at random, gets its value. If the pass only
        narrows down possible values, that narrowing is kept, so the next step can progress.
        Returns whether the puzzle changed. Raises ContradictionError if the pass detects that
        the puzzle has no solution; the puzzle is then restored to the state it had before."""
        state = self.puzzle.saveState()
        openCells = self.puzzle.getOpenCells()
        try:
            self.step()
            solvedCells = [(cell, cell.getValue()) for cell in openCells if cell.hasValue()]
            if solvedCells:
                self.puzzle.restoreState(state)
                cell, value = self.random.choice(solvedCells)
                cell.inferValue(value)
        except ContradictionError:
            self.puzzle.restoreState(state)
            raise
        return self.puzzle.saveState() != state

    def propagate(self, state=None):
        """Repeat deduction passes until a pass no longer changes anything.
        state: the current puzzle state, if the caller already has a snapshot of it"""
        if state is None:
            state = self.puzzle.saveState()
        while True:
            self.step()
            newState = self.puzzle.saveState()
            if newState == state:
                return
            state = newState

    def solve(self):
        """Deduce as much as possible; if allowed, guess when deduction gets stuck.
        Returns whether the puzzle is solved. Raises ContradictionError if the
        puzzle has no solution; the puzzle is then restored to the state it had
        before solve() was called, instead of being left half-updated."""
        initialState = self.puzzle.saveState()
        try:
            self.propagate(initialState)
            if self.allowGuessing and not self.puzzle.isSolved() and not self._search():
                raise ContradictionError("No solution found, all guesses lead to a contradiction")
        except ContradictionError:
            self.puzzle.restoreState(initialState)
            raise
        return self.puzzle.isSolved()

    def _search(self):
        openCells = self.puzzle.getOpenCells()
        if not openCells:
            return True

        # guess on the most constrained cell first
        cell = min(openCells, key=lambda c: len(c.getPossibleValues()))
        for value in sorted(cell.getPossibleValues()):
            state = self.puzzle.saveState()
            try:
                cell.inferValue(value)
                self.propagate()  # the state changed by the guess, so a new snapshot is needed
                if self._search():
                    return True
            except ContradictionError:
                pass
            self.puzzle.restoreState(state)
        return False

    def __str__(self):
        s = str(self.puzzle)
        return s
