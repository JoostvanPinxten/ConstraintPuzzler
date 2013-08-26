'''
Created on 28 dec. 2012

@author: Juice
'''

class Solver():
    def __init__(self, puzzle):
        self.puzzle = puzzle
        #for cg in puzzle.getConstraintGroups():
        #    cg.applyConstraints()
        
    def solve(self):

        # TODO: use different complexity levels (based on expected running time)
        # general flow: easiest first (e.g. cell-move, or group-move), if that 
        # finds anything, then start back from the first complexity, otherwise, 
        # increase complexity
        
        
        for cell in self.puzzle.getGrid().getCells():
            cell.checkForSinglePossibility()
        for cg in self.puzzle.getConstraintGroups():
            cg.applyConstraints()
        
    def __str__(self):
        s = str(self.puzzle)        
        return s
