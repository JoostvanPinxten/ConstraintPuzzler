'''
Created on 28 dec. 2012

@author: Juice
'''
from structure.errors import ContradictionError

class ConstraintGroup(object):
    def __init__(self, grid, name="Untitled"):
        self.constraints = []
        self.cells = []
        self.grid = grid
        self.name = name

    def addConstraint(self, constraintType):
        constraint = constraintType(self, self.grid.values)
        self.constraints.append(constraint)
        return constraint
    
    def addCell(self, cell):
        self.cells.append(cell)
        
        cell.valueChanged.connect(self.notify)
        #cell.addConstraintGroup(self)
        
    def notify(self, cell):
        for c in self.constraints:
            if(c is not cell):
                c.notify(cell)
            
    def removeValue(self, cell, value):
        self.removeValueExceptForList([cell], value) 
        #cell.remove(value)
        
    def removeValueExceptForList(self, cells, value):
        for c in self.cells:
            if c not in cells:
                if c.hasValue():
                    if(c.getValue() == value):
                        raise ContradictionError("Trying to remove a value from a cell, but that value was already set")
                else:
                    c.remove(value)

    def applyConstraints(self):

        for constraint in self.constraints:
            constraint.applyConstraint()

            # check if it is the only cell that contains this value
            # TODO: refactor to different kind of constraint (or make UVC configurable)
            
        #self.searchForNakedSet() # might actually need to refactor this to a new type of constraint (exactCover) i.s.o. using it here...


    def getName(self):
        return self.name
    
    def getType(self):
        return "Abstract Constraint"
    
    def getCells(self):
        return self.cells
    
    def getConstraints(self):
        return self.constraints
    
    
    def valuesAllowedByGroup(self, usedValues):
        allowedValues = self.grid.getValues()
        for c in self.constraints:
            #print allowedValues
            allowedValues = c.getAllowedValuesForValueList(allowedValues, usedValues)
            
        return allowedValues
    