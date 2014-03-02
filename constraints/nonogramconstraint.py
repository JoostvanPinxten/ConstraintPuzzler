'''
Created on 19 okt. 2013

@author: Juice
'''
from constraints.constraint import Constraint

class NonogramConstraint(Constraint):
    def __init__(self, group, initialValues):
        super(NonogramConstraint, self).__init__(group, initialValues)
        
#    def notify(self, cell):
#        pass
    
    def setAdjacencies(self, adjacencies):
        # a list of adjacencies
        self.adjacencies = list(adjacencies)
    
    def applyConstraint(self):
        # for now, assume only one color
        cells = self.group.getCells()
        if len(cells) == sum(self.adjacencies) + len(self.adjacencies)-1:
            print "test", self
            index = 0
            for adjacency in self.adjacencies:
                for i in range(adjacency):
                    cell = cells[index + i]
                    cell.setValue(1)
                
                index += i + 1

                if index < len(cells):
                    cell = cells[index]
                    cell.setValue(0)
        pass

    def notify(self, cell):
        pass
    
    def searchForNakedSet(self):
        pass
    
    def getType(self):
        return "Nonogram constraint"
    
#    def getAllowedValuesForValueList(self, allowedValues, usedValues):
#        return allowedValues
    
    def __str__(self):
        return "nono["+",".join([str(x) for x in self.adjacencies]) + "]"