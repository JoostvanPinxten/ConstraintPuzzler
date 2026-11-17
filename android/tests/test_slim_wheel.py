import sys
import unittest
from pathlib import Path

from android.slim_wheel import isKept, neededLibraries


class NeededLibrariesTest(unittest.TestCase):
    def test_reads_dt_needed_of_python_extension(self):
        # A native library from the running interpreter, when it is an ELF64 file.
        candidates = sorted(Path(sys.base_prefix).glob("lib/python3*/lib-dynload/*.so"))
        if not candidates:
            self.skipTest("no ELF extension modules on this platform")
        needed = neededLibraries(candidates[0].read_bytes())
        self.assertIsInstance(needed, list)
        self.assertTrue(all(isinstance(name, str) and name for name in needed))

    def test_rejects_non_elf(self):
        with self.assertRaises(ValueError):
            neededLibraries(b"MZ not an elf")


class IsKeptTest(unittest.TestCase):
    def test_keeps_python_files_and_reachable_libraries(self):
        libraries = {"PySide6/QtCore.abi3.so"}
        self.assertTrue(isKept("PySide6/__init__.py", libraries))
        self.assertTrue(isKept("PySide6/QtCore.abi3.so", libraries))
        self.assertTrue(isKept("PySide6/Qt/lib/Qt6Core_arm64-v8a-android-dependencies.xml", set()))

    def test_drops_unused_libraries_qml_and_translations(self):
        self.assertFalse(isKept("PySide6/Qt/lib/libQt6Quick_arm64-v8a.so", set()))
        self.assertFalse(isKept("PySide6/Qt/qml/QtQuick/qmldir", set()))
        self.assertFalse(isKept("PySide6/Qt/translations/qtbase_nl.qm", set()))


if __name__ == "__main__":
    unittest.main()
