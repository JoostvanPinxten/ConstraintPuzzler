'''
Created on 28 dec. 2012

@author: Juice
'''
from gui.puzzlemodel.puzzletreemodel import CellProxyItem
from structure.item import Item
from structure.errors import ContradictionError
from structure.signal import Signal

class Cell(Item):
    def __init__(self, initialValues, grid):
        super(Cell, self).__init__()
        self.valueChanged = Signal()
        self.possibleValuesChanged = Signal()
        self.initialValues = set(initialValues)
        self.reset()
        self.grid = grid
        
        self.cellItem = CellProxyItem(self, grid.getItem())

    def reset(self):
        self.constraintGroups = []
        self.values = set(self.initialValues)
        self.value = None
        self.inferred = False
    
    def getValue(self):
        return self.value
        
    def hasValue(self):
        return self.getValue() is not None
    
    def inferValue(self, value):
        self.setValue(value, True)
    
    def setValue(self, value, isInferred=False):
        if value not in self.values:
            raise ContradictionError("value " + str(value) + " not in my values: " + str(self.values))
        
        self.inferred = isInferred
        
        self.value = value
        self.values = {value}
        
        self.valueChanged.emit(self)
        #for cg in self.constraintGroups:
        #    cg.notify(self, value)
    
    def getPossibleValues(self):
        #if(self.value):
        #    return [self.value]
        
        # start with all the possible values
        values = self.values
        
        # let each constraint group say what values are still allowed?
        return set(values)

    def remove(self, value):
        # make sure the set value is not the value that needs to be removed
        if self.value == value:
            raise ContradictionError("value removed that's already set..." + str(self))

        if value not in self.values:
            return # redundant remove

        self.values.remove(value)
        if(len(self.values) == 0):
            # the puzzle state is contradictory: no value is left for this cell
            raise ContradictionError("No more options for cell, removed last value:" + str(value) + ", " + str(self))
        self.possibleValuesChanged.emit(self)

    def addConstraintGroup(self, group):
        self.constraintGroups.append(group)
        group.addCell(self)
        
    def __str__(self):
        val = self.getValue();
        valStr = "" 
        if(val is not None):
            valStr = ": "+ str(val)
            
        return "[" + ",".join([str(v) for v in self.values]) + valStr +"]"
        
    def isFixed(self):
        return self.value is not None
    
    def isInferred(self):
        return self.inferred
    
    def getGrid(self):
        return self.grid

    def checkForSinglePossibility(self):
        if(self.value == None and len(self.values) == 1):
            #print self.values
            val = next(iter(self.values))
#            #print "single value left: ", val
            self.inferValue(val)

    
class PositionedCell(Cell):
    def __init__(self, initialValues, grid, position):
        super(PositionedCell, self).__init__(initialValues, grid)
        
        self.position = position
        
    def getPosition(self):
        return self.position
    
    def setPosition(self, position):
        self.position = position
        
    def getName(self):
        return str(self.position.x()) + ", " + str(self.position.y())

    def __str__(self):
        val = self.getValue();
        valStr = "" 
        if(val is not None):
            valStr = ": "+ str(val)
            
        return "[pos:"+ str(self.position) + ";" + ",".join([str(v) for v in self.values]) + valStr +"]"
    