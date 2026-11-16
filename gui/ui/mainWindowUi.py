# -*- coding: utf-8 -*-

################################################################################
## Form generated from reading UI file 'mainwindow.ui'
##
## Created by: Qt User Interface Compiler version 6.12.0
##
## WARNING! All changes made in this file will be lost when recompiling UI file!
################################################################################

from PySide6.QtCore import (QCoreApplication, QDate, QDateTime, QLocale,
    QMetaObject, QObject, QPoint, QRect,
    QSize, QTime, QUrl, Qt)
from PySide6.QtGui import (QBrush, QColor, QConicalGradient, QCursor,
    QFont, QFontDatabase, QGradient, QIcon,
    QImage, QKeySequence, QLinearGradient, QPainter,
    QPalette, QPixmap, QRadialGradient, QTransform)
from PySide6.QtWidgets import (QAbstractItemView, QApplication, QDockWidget, QGraphicsView,
    QGroupBox, QHBoxLayout, QHeaderView, QMainWindow,
    QMenuBar, QPushButton, QSizePolicy, QStatusBar,
    QTreeView, QVBoxLayout, QWidget)

class Ui_MainWindow(object):
    def setupUi(self, MainWindow):
        if not MainWindow.objectName():
            MainWindow.setObjectName(u"MainWindow")
        MainWindow.resize(858, 646)
        self.centralwidget = QWidget(MainWindow)
        self.centralwidget.setObjectName(u"centralwidget")
        self.horizontalLayout = QHBoxLayout(self.centralwidget)
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.puzzleGraphicsView = QGraphicsView(self.centralwidget)
        self.puzzleGraphicsView.setObjectName(u"puzzleGraphicsView")
        sizePolicy = QSizePolicy(QSizePolicy.Policy.MinimumExpanding, QSizePolicy.Policy.Expanding)
        sizePolicy.setHorizontalStretch(50)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.puzzleGraphicsView.sizePolicy().hasHeightForWidth())
        self.puzzleGraphicsView.setSizePolicy(sizePolicy)

        self.horizontalLayout.addWidget(self.puzzleGraphicsView)

        MainWindow.setCentralWidget(self.centralwidget)
        self.menubar = QMenuBar(MainWindow)
        self.menubar.setObjectName(u"menubar")
        self.menubar.setGeometry(QRect(0, 0, 858, 21))
        MainWindow.setMenuBar(self.menubar)
        self.statusbar = QStatusBar(MainWindow)
        self.statusbar.setObjectName(u"statusbar")
        MainWindow.setStatusBar(self.statusbar)
        self.puzzleStructureDockWidget = QDockWidget(MainWindow)
        self.puzzleStructureDockWidget.setObjectName(u"puzzleStructureDockWidget")
        self.puzzleStructureDockWidget.setFeatures(QDockWidget.DockWidgetFloatable|QDockWidget.DockWidgetMovable)
        self.dockWidgetContents = QWidget()
        self.dockWidgetContents.setObjectName(u"dockWidgetContents")
        self.horizontalLayout_2 = QHBoxLayout(self.dockWidgetContents)
        self.horizontalLayout_2.setObjectName(u"horizontalLayout_2")
        self.verticalLayout_2 = QVBoxLayout()
        self.verticalLayout_2.setObjectName(u"verticalLayout_2")
        self.puzzleTreeView = QTreeView(self.dockWidgetContents)
        self.puzzleTreeView.setObjectName(u"puzzleTreeView")
        sizePolicy1 = QSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        sizePolicy1.setHorizontalStretch(150)
        sizePolicy1.setVerticalStretch(0)
        sizePolicy1.setHeightForWidth(self.puzzleTreeView.sizePolicy().hasHeightForWidth())
        self.puzzleTreeView.setSizePolicy(sizePolicy1)
        self.puzzleTreeView.setSelectionMode(QAbstractItemView.SingleSelection)

        self.verticalLayout_2.addWidget(self.puzzleTreeView)

        self.solverGroupBox = QGroupBox(self.dockWidgetContents)
        self.solverGroupBox.setObjectName(u"solverGroupBox")
        self.verticalLayout_3 = QVBoxLayout(self.solverGroupBox)
        self.verticalLayout_3.setObjectName(u"verticalLayout_3")
        self.notesPushButton = QPushButton(self.solverGroupBox)
        self.notesPushButton.setObjectName(u"notesPushButton")
        self.notesPushButton.setCheckable(True)

        self.verticalLayout_3.addWidget(self.notesPushButton)

        self.hintPushButton = QPushButton(self.solverGroupBox)
        self.hintPushButton.setObjectName(u"hintPushButton")

        self.verticalLayout_3.addWidget(self.hintPushButton)

        self.checkPushButton = QPushButton(self.solverGroupBox)
        self.checkPushButton.setObjectName(u"checkPushButton")

        self.verticalLayout_3.addWidget(self.checkPushButton)

        self.solveStepPushButton = QPushButton(self.solverGroupBox)
        self.solveStepPushButton.setObjectName(u"solveStepPushButton")

        self.verticalLayout_3.addWidget(self.solveStepPushButton)

        self.solvePushButton = QPushButton(self.solverGroupBox)
        self.solvePushButton.setObjectName(u"solvePushButton")

        self.verticalLayout_3.addWidget(self.solvePushButton)


        self.verticalLayout_2.addWidget(self.solverGroupBox)


        self.horizontalLayout_2.addLayout(self.verticalLayout_2)

        self.puzzleStructureDockWidget.setWidget(self.dockWidgetContents)
        MainWindow.addDockWidget(Qt.DockWidgetArea.LeftDockWidgetArea, self.puzzleStructureDockWidget)

        self.retranslateUi(MainWindow)

        QMetaObject.connectSlotsByName(MainWindow)
    # setupUi

    def retranslateUi(self, MainWindow):
        MainWindow.setWindowTitle(QCoreApplication.translate("MainWindow", u"MainWindow", None))
        self.puzzleStructureDockWidget.setWindowTitle(QCoreApplication.translate("MainWindow", u"Puzzle structure", None))
        self.solverGroupBox.setTitle(QCoreApplication.translate("MainWindow", u"Solver steps", None))
#if QT_CONFIG(tooltip)
        self.notesPushButton.setToolTip(QCoreApplication.translate("MainWindow", u"Notes mode: typing a number toggles it as a note in the cell instead of entering it (N; Ctrl+number toggles a note in any mode)", None))
#endif // QT_CONFIG(tooltip)
        self.notesPushButton.setText(QCoreApplication.translate("MainWindow", u"Notes (N)", None))
#if QT_CONFIG(tooltip)
        self.hintPushButton.setToolTip(QCoreApplication.translate("MainWindow", u"Show where to look; click again for the cell, and again for its value and why (nothing is filled in)", None))
#endif // QT_CONFIG(tooltip)
        self.hintPushButton.setText(QCoreApplication.translate("MainWindow", u"Hint", None))
#if QT_CONFIG(tooltip)
        self.checkPushButton.setToolTip(QCoreApplication.translate("MainWindow", u"Compare the filled-in values and notes with the solution", None))
#endif // QT_CONFIG(tooltip)
        self.checkPushButton.setText(QCoreApplication.translate("MainWindow", u"Check", None))
#if QT_CONFIG(tooltip)
        self.solveStepPushButton.setToolTip(QCoreApplication.translate("MainWindow", u"Fill in one cell whose value follows from the constraints", None))
#endif // QT_CONFIG(tooltip)
        self.solveStepPushButton.setText(QCoreApplication.translate("MainWindow", u"Solve single step", None))
        self.solvePushButton.setText(QCoreApplication.translate("MainWindow", u"Solve", None))
    # retranslateUi

