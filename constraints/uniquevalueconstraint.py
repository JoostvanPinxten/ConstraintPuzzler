'''
Created on 28 dec. 2012

@author: Juice
'''
from constraints import Constraint

class UniqueValueConstraint(Constraint):
    def __init__(self, group, initialValues):
        super(UniqueValueConstraint, self).__init__(group, initialValues)

    def notify(self, cell):
        """ Notifies the constraint that a value has been set for the given cell"""
        value = cell.getValue()
        if(value in self.values):
            self.values.remove(value)
            self.group.removeValue(cell, value)
    
    def applyConstraint(self):
        return 
        
    
    def getType(self):
        return "Unique Value Constraint"
    
    def getAllowedValuesForValueList(self, allowedValues, usedValues):
        #return allowedValues
        #print allowedValues, usedValues, set(usedValues) - set(self.values)
        return set(allowedValues) - set(usedValues)

    def checkForSinglePosition(self, values):
        newValuesMap = {}
        for value in values: 
            continueSearching = True
            firstCell = None
            for c in self.group.getCells():
                setValue = c.getValue()
                if(setValue == value):
                    continueSearching = False                    
                    break
                
                if(c.hasValue()):
                    continue
                
                if(value in c.getPossibleValues()):
                    if(firstCell == None):
                        firstCell = c
                    else:
                        continueSearching = False
                        break
                else:
                    continue
            
            if(continueSearching == True and firstCell <> None):
                newValuesMap[firstCell] = value
        return newValuesMap
    
    def __str__(self):
        return "UVC[" +  ",".join([str(x) for x in self.values]) +  "]"