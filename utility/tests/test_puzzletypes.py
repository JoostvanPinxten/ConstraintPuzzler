"""The puzzle-type registry: complete, consistent, and usable without PySide6."""

import subprocess
import sys
import unittest
from pathlib import Path

from structure.puzzle import Puzzle
from utility.puzzletypes import PUZZLE_TYPES, PuzzleType, exampleFiles
from utility.resources import resourcePath

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class PuzzleTypesTest(unittest.TestCase):
    def testKeysAreNames(self):
        for name, puzzleType in PUZZLE_TYPES.items():
            self.assertEqual(puzzleType.name, name)

    def testEveryExampleParses(self):
        for puzzleType in PUZZLE_TYPES.values():
            self.assertIn(puzzleType.defaultExample, puzzleType.examples)
            for label, fileName in puzzleType.examples.items():
                with self.subTest(puzzle=puzzleType.name, example=label):
                    puzzle = puzzleType.parser(resourcePath(fileName))
                    self.assertIsInstance(puzzle, Puzzle)
                    self.assertTrue(puzzle.grid.getCells())

    def testWindowModuleExists(self):
        for puzzleType in PUZZLE_TYPES.values():
            self.assertTrue((REPO_ROOT / f"{puzzleType.windowModule}.py").is_file())

    def testExampleFilesAreUnique(self):
        files = exampleFiles()
        self.assertEqual(len(files), len(set(files)))

    def testDefaultExampleMustBeListed(self):
        with self.assertRaises(ValueError):
            PuzzleType("x", "X", lambda f: Puzzle("x", {1}), "X (*.txt)", {"a": "a.txt"}, "b")

    def testRegistryDoesNotImportPySide6(self):
        code = (
            "import sys, utility.puzzletypes; "
            "sys.exit(any(m.startswith('PySide6') for m in sys.modules))"
        )
        result = subprocess.run([sys.executable, "-c", code], cwd=REPO_ROOT)
        self.assertEqual(result.returncode, 0, "utility.puzzletypes imports PySide6")


if __name__ == "__main__":
    unittest.main()
