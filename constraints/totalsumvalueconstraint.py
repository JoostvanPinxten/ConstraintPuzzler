'''
Created on 28 dec. 2012

@author: Juice
'''
from constraints import Constraint

class TotalSumValueConstraint(Constraint):
    def __init__(self, group, initialValues):
        super(TotalSumValueConstraint, self).__init__(group, initialValues)
        
    
    def notify(self, cell):
        pass
    
    def applyConstraint(self):
        # look at what cells 
        
        openCells = list(self.group.getCells())
        filledCells = []
        valuesUsed = []
        total = self.totalValue
        for c in self.group.cells:
            if c.hasValue():
                filledCells.append(c)

                openCells.remove(c)
                val = c.getValue()
                total -= val
                
                valuesUsed.append(c.getValue())
        
        allowedSet = self.applyConstraintRecursively(total, len(openCells), valuesUsed)
        
        for value in self.values:
            #print "totalvalue", self.totalValue
            if(not value in allowedSet):
                #self.values.remove(value)
                #print value
                self.values.remove(value)
                self.group.removeValueExceptForList(filledCells, value)    

    def applyConstraintRecursively(self, leftOverSum, leftOverCellCount, valuesUsed=[]):
        """Compute the set of allowed values recursively"""
        
        # if there is no leftOver from the sum, but we arrived here anyway, then return nothing
        if(leftOverCellCount == 0 or leftOverSum <= 0):
            return set([])
        
        allowedSet = set()
        for value in self.group.valuesAllowedByGroup(valuesUsed):
            # print valuesUsed, value
            valuesUsedNow = list(valuesUsed)
            valuesUsedNow.append(value)
            
            if(leftOverSum == value and leftOverCellCount == 1):
                return set([value])
            
            stillAllowed = self.applyConstraintRecursively(leftOverSum - value, leftOverCellCount-1, valuesUsedNow)
            if stillAllowed <> None:
                allowedSet |= stillAllowed

        return allowedSet
    
    def getType(self):
        return "Total Sum Value Constraint"
    
    def setTotalValue(self, value):
        self.totalValue = value
    
    def getTotalValue(self):
        return self.totalValue
    
    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        return allowedValues
    
    def __str__(self):
        return "tsvc["+",".join([str(x) for x in self.values]) + "]"