'''
Created on 26 jan. 2013

@author: Juice
'''

from uniquevalueconstraint import UniqueValueConstraint


class ExactCoverConstraint(UniqueValueConstraint):
    def __init__(self, group, initialValues):
        super(ExactCoverConstraint, self).__init__(group, initialValues)
        
#    def notify(self, cell):
#        pass
    
    def applyConstraint(self):
        values = set()
        for c in self.group.getCells():
            values |= set(c.getPossibleValues())        
        newValues = self.checkForSinglePosition(values)
            
        for cell in newValues.keys():
            value = newValues[cell]
            if(value <> None):
                cell.inferValue(value)
        
        self.searchForNakedSet()
    
    # TODO: make this more generic, iso just for a single pair, use multiple levels
    # TODO: this only applies for combination of constraint groups that have the exactlyOnce/UVC constraint
    # TODO: can be refactored into a new type of constraint (and extract the old exactlyonce contraint)
    def searchForNakedSet(self):
        
        # iterate over all the cells and check if any one of the initial value can still be entered
        cells = {}
        for value in self.group.grid.getValues():
            cells[value] = set()
            
        #print "searching!", values
        for c in self.group.getCells():
            for val in c.getPossibleValues():
                cells[val].add(c)
                
        for value in self.group.grid.getValues():
            
            # at least values for two cells must be eliminated to be able to qualify for a naked set:
            if len(cells[value]) > len(self.group.getCells()) - 2 :
                continue
            
            # naked pair
            if len(cells[value]) == 2 :
                relatedValues = set()
                for cell in cells[value]:
                    relatedValues |= cell.getPossibleValues()
                
                relatedValues -= set([value])
                
                for otherValue in relatedValues:
                    #print cells[otherValue] ==  cells[value]
                    if(cells[otherValue] == cells[value]):
                        #print relatedValues, otherValue
                        for nakedCell in cells[otherValue]:
                            for removeValue in set(self.group.grid.getValues()) - set([value, otherValue]):
                                nakedCell.remove(removeValue)
            
            #self.removeValueExceptForList([c], overlappingValues)
                
        pass    
    
    def getType(self):
        return "Exact cover constraint"
    
#    def getAllowedValuesForValueList(self, allowedValues, usedValues):
#        return allowedValues
    
    def __str__(self):
        return "ecc["+",".join([str(x) for x in self.values]) + "]"