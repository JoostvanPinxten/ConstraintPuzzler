'''
Created on 7 jan. 2013

@author: Juice
'''

from constraints import Constraint

class CellGreaterThanCellConstraint(Constraint):
    def __init__(self, group, initialValues):
        super(CellGreaterThanCellConstraint, self).__init__(group, initialValues)
        
        self.lesserCell = None
        self.greaterCell = None
    
    def notify(self, cell):
        pass
    
    
    def setLesserCell(self, cell):
        self.lesserCell = cell
        
    def setGreaterCell(self, cell):
        self.greaterCell = cell
        
    def applyConstraint(self):
        smallerPossibilities = set(self.lesserCell.getPossibleValues())
        largerPossibilities = set(self.greaterCell.getPossibleValues())
        
        minimumValue = min(largerPossibilities) 
        maximumValue = max(smallerPossibilities)
        
        # print minimumValue, maximumValue
        
        allowedRange = range(minimumValue+1, maximumValue+1)
        #print "s", smallerPossibilities, allowedRange
        for val in smallerPossibilities:
            if(val not in allowedRange):
                self.lesserCell.remove(val)
        
        allowedRange = range(minimumValue, maximumValue)
        #print "l", largerPossibilities, allowedRange
        for val in largerPossibilities:
            if(val not in allowedRange):
                self.greaterCell.remove(val)
        
            
    def getType(self):
        return "Total Sum Value Constraint"
    
    def setTotalValue(self, value):
        self.totalValue = value
    
    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        return allowedValues
