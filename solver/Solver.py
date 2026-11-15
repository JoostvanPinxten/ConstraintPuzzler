'''
Created on 28 dec. 2012

@author: Juice
'''
from structure.errors import ContradictionError

class Solver():
    def __init__(self, puzzle, allowGuessing=False):
        self.puzzle = puzzle
        # when deduction gets stuck, try values (depth-first, with backtracking)
        self.allowGuessing = allowGuessing

    def step(self):
        """ A single deduction pass over all cells and constraint groups """
        for cell in self.puzzle.getGrid().getCells():
            cell.checkForSinglePossibility()
        for cg in self.puzzle.getConstraintGroups():
            cg.applyConstraints()

    def propagate(self):
        """ Repeat deduction passes until a pass no longer changes anything """
        state = self.puzzle.saveState()
        while True:
            self.step()
            newState = self.puzzle.saveState()
            if newState == state:
                return
            state = newState

    def solve(self):
        """ Deduce as much as possible; if allowed, guess when deduction gets stuck.
        Returns whether the puzzle is solved. Raises ContradictionError if the
        puzzle has no solution. """
        self.propagate()
        if self.allowGuessing and not self.puzzle.isSolved():
            if not self._search():
                raise ContradictionError("No solution found, all guesses lead to a contradiction")
        return self.puzzle.isSolved()

    def _search(self):
        openCells = [c for c in self.puzzle.getGrid().getCells() if not c.hasValue()]
        if not openCells:
            return True

        # guess on the most constrained cell first
        cell = min(openCells, key=lambda c: len(c.getPossibleValues()))
        for value in sorted(cell.getPossibleValues()):
            state = self.puzzle.saveState()
            try:
                cell.inferValue(value)
                self.propagate()
                if self._search():
                    return True
            except ContradictionError:
                pass
            self.puzzle.restoreState(state)
        return False

    def __str__(self):
        s = str(self.puzzle)
        return s
