'''
Created on 30 dec. 2012

@author: Juice
'''
from PySide import QtGui, QtCore
class Item(QtCore.QObject):

    def getParentItem(self):
        return self.parentItem
    
    def getItem(self):
        raise NotImplementedError
    
    def setParentItem(self, item):
        self.parentItem = item
        