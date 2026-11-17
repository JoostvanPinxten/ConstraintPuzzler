"""Android entry point.

pyside6-android-deploy requires the entry point to be called ``main.py`` in the application
directory; android/build_apk.sh copies this file next to the app sources. It starts the launcher,
like the desktop executable, with one Android-specific workaround (see AndroidApplication).
"""

import sys

from PySide6 import QtCore, QtGui, QtWidgets

import constraintPuzzlerMain

# Holds the accessibility root set by disableAccessibilityBridge for the lifetime of the app.
_accessibilityRoot: QtCore.QObject | None = None


def disableAccessibilityBridge() -> None:
    """Make Qt answer the Android accessibility queries with nothing.

    With an accessibility service enabled on the device (a screen reader, but also e.g. a
    password manager or a sync app), Android asks Qt for its accessibility tree from the Android
    UI thread. Qt 6.12 runs those queries on the Qt thread while holding its Android "deadlock
    protector"; when the Qt thread repaints a window at the same time it needs that protector for
    the EGL surface and aborts ("Failed to acquire deadlock protector for
    QAndroidPlatformOpenGLWindow::eglSurface()"), so the app crashes as soon as a puzzle is drawn.

    The queries only run while Qt's accessibility context object exists. On Android,
    QAccessible.setRootObject() replaces that object by a new child of the new root, so point the
    root at a placeholder and delete the context object under it.
    """
    global _accessibilityRoot
    _accessibilityRoot = QtCore.QObject()
    QtGui.QAccessible.setRootObject(_accessibilityRoot)
    for child in _accessibilityRoot.children():
        child.deleteLater()


class AndroidApplication(QtWidgets.QApplication):
    @staticmethod
    def exec() -> int:
        # QGuiApplication.exec() calls QAccessible.setRootObject(app), which (re)creates the
        # accessibility context object, so disable the bridge once the event loop is running.
        QtCore.QTimer.singleShot(0, disableAccessibilityBridge)
        return QtWidgets.QApplication.exec()


if __name__ == "__main__":
    if not sys.argv:  # an embedded interpreter may start with an empty argv
        sys.argv = ["ConstraintPuzzler"]
    app = AndroidApplication(sys.argv[:1])  # constraintPuzzlerMain.main() reuses this instance
    sys.exit(constraintPuzzlerMain.main([]))
