# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file 'mainwindow.ui'
#
# Created: Fri Mar 29 15:07:56 2013
#      by: pyside-uic 0.2.14 running on PySide 1.1.2
#
# WARNING! All changes made in this file will be lost!

from PySide import QtCore, QtGui

class Ui_MainWindow(object):
    def setupUi(self, MainWindow):
        MainWindow.setObjectName("MainWindow")
        MainWindow.resize(858, 646)
        self.centralwidget = QtGui.QWidget(MainWindow)
        self.centralwidget.setObjectName("centralwidget")
        self.horizontalLayout = QtGui.QHBoxLayout(self.centralwidget)
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.puzzleGraphicsView = QtGui.QGraphicsView(self.centralwidget)
        sizePolicy = QtGui.QSizePolicy(QtGui.QSizePolicy.MinimumExpanding, QtGui.QSizePolicy.Expanding)
        sizePolicy.setHorizontalStretch(50)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.puzzleGraphicsView.sizePolicy().hasHeightForWidth())
        self.puzzleGraphicsView.setSizePolicy(sizePolicy)
        self.puzzleGraphicsView.setObjectName("puzzleGraphicsView")
        self.horizontalLayout.addWidget(self.puzzleGraphicsView)
        MainWindow.setCentralWidget(self.centralwidget)
        self.menubar = QtGui.QMenuBar(MainWindow)
        self.menubar.setGeometry(QtCore.QRect(0, 0, 858, 21))
        self.menubar.setObjectName("menubar")
        MainWindow.setMenuBar(self.menubar)
        self.statusbar = QtGui.QStatusBar(MainWindow)
        self.statusbar.setObjectName("statusbar")
        MainWindow.setStatusBar(self.statusbar)
        self.puzzleStructureDockWidget = QtGui.QDockWidget(MainWindow)
        self.puzzleStructureDockWidget.setFeatures(QtGui.QDockWidget.DockWidgetFloatable|QtGui.QDockWidget.DockWidgetMovable)
        self.puzzleStructureDockWidget.setObjectName("puzzleStructureDockWidget")
        self.dockWidgetContents = QtGui.QWidget()
        self.dockWidgetContents.setObjectName("dockWidgetContents")
        self.horizontalLayout_2 = QtGui.QHBoxLayout(self.dockWidgetContents)
        self.horizontalLayout_2.setObjectName("horizontalLayout_2")
        self.verticalLayout_2 = QtGui.QVBoxLayout()
        self.verticalLayout_2.setObjectName("verticalLayout_2")
        self.puzzleTreeView = QtGui.QTreeView(self.dockWidgetContents)
        sizePolicy = QtGui.QSizePolicy(QtGui.QSizePolicy.Preferred, QtGui.QSizePolicy.Expanding)
        sizePolicy.setHorizontalStretch(150)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.puzzleTreeView.sizePolicy().hasHeightForWidth())
        self.puzzleTreeView.setSizePolicy(sizePolicy)
        self.puzzleTreeView.setSelectionMode(QtGui.QAbstractItemView.SingleSelection)
        self.puzzleTreeView.setObjectName("puzzleTreeView")
        self.verticalLayout_2.addWidget(self.puzzleTreeView)
        self.solverGroupBox = QtGui.QGroupBox(self.dockWidgetContents)
        self.solverGroupBox.setObjectName("solverGroupBox")
        self.verticalLayout_3 = QtGui.QVBoxLayout(self.solverGroupBox)
        self.verticalLayout_3.setObjectName("verticalLayout_3")
        self.solvePushButton = QtGui.QPushButton(self.solverGroupBox)
        self.solvePushButton.setObjectName("solvePushButton")
        self.verticalLayout_3.addWidget(self.solvePushButton)
        self.verticalLayout_2.addWidget(self.solverGroupBox)
        self.horizontalLayout_2.addLayout(self.verticalLayout_2)
        self.puzzleStructureDockWidget.setWidget(self.dockWidgetContents)
        MainWindow.addDockWidget(QtCore.Qt.DockWidgetArea(1), self.puzzleStructureDockWidget)

        self.retranslateUi(MainWindow)
        QtCore.QMetaObject.connectSlotsByName(MainWindow)

    def retranslateUi(self, MainWindow):
        MainWindow.setWindowTitle(QtGui.QApplication.translate("MainWindow", "MainWindow", None, QtGui.QApplication.UnicodeUTF8))
        self.puzzleStructureDockWidget.setWindowTitle(QtGui.QApplication.translate("MainWindow", "Puzzle structure", None, QtGui.QApplication.UnicodeUTF8))
        self.solverGroupBox.setTitle(QtGui.QApplication.translate("MainWindow", "Solver steps", None, QtGui.QApplication.UnicodeUTF8))
        self.solvePushButton.setText(QtGui.QApplication.translate("MainWindow", "Solve", None, QtGui.QApplication.UnicodeUTF8))

