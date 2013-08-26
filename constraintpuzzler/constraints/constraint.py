'''
Created on 24 dec. 2012

@author: Juice
'''
from structure.item import Item
from gui.puzzlemodel.puzzletreemodel import ConstraintProxyItem

class Constraint(Item):
    def __init__(self, group, initialValues):
        self.initialValues = list(initialValues)
        self.group = group
        
        self.item = ConstraintProxyItem(self, group.getItem())
        self.reset()

    def reset(self):
        self.values = list(self.initialValues)
    
    def applyConstraint(self):
        raise NotImplementedError        

    def notify(self, cell):
        raise NotImplementedError
    
