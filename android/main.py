"""Android entry point.

pyside6-android-deploy requires the entry point to be called ``main.py`` in the application
directory; android/build_apk.sh copies this file next to the app sources. It just starts the
launcher, like the desktop executable.
"""

import sys

import constraintPuzzlerMain

if __name__ == "__main__":
    if not sys.argv:  # an embedded interpreter may start with an empty argv
        sys.argv = ["ConstraintPuzzler"]
    sys.exit(constraintPuzzlerMain.main([]))
