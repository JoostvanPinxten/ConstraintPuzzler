"""
Created on 24 dec. 2012

@author: Juice
"""


class Constraint(object):
    def __init__(self, group, initialValues):
        self.initialValues = list(initialValues)
        self.group = group

        self.reset()

    def reset(self):
        self.values = list(self.initialValues)

    def applyConstraint(self):
        raise NotImplementedError

    def notify(self, cell):
        raise NotImplementedError
