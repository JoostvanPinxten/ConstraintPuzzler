import re
import sys
import tomllib
import unittest
from pathlib import Path
from unittest import mock

from utility import resources
from utility.resources import resourcePath
from utility.version import getVersion

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class VersionTest(unittest.TestCase):
    def test_version_matches_pyproject(self):
        with open(REPO_ROOT / "pyproject.toml", "rb") as f:
            expected = tomllib.load(f)["project"]["version"]
        self.assertEqual(getVersion(), expected)

    def test_version_is_semantic(self):
        self.assertRegex(getVersion(), re.compile(r"^\d+\.\d+\.\d+"))


class ResourcePathTest(unittest.TestCase):
    def test_source_checkout_uses_repo_root(self):
        self.assertEqual(Path(resourcePath("pyproject.toml")), REPO_ROOT / "pyproject.toml")
        self.assertTrue(Path(resourcePath("easySudoku.txt")).is_file())

    def test_frozen_bundle_uses_meipass(self):
        bundle = Path("/opt/bundle")
        with (
            mock.patch.object(sys, "frozen", True, create=True),
            mock.patch.object(sys, "_MEIPASS", str(bundle), create=True),
        ):
            self.assertEqual(resources.resourceRoot(), bundle)
            self.assertEqual(Path(resourcePath("futoshiki.txt")), bundle / "futoshiki.txt")


if __name__ == "__main__":
    unittest.main()
