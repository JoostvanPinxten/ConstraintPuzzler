# PyInstaller spec for the standalone ConstraintPuzzler executable (one folder, windowed).
#
#   uv run pyinstaller constraintpuzzler.spec --noconfirm
#
# Output: dist/ConstraintPuzzler/ (Windows, Linux) or dist/ConstraintPuzzler.app (macOS).
# pyproject.toml is bundled so utility.version.getVersion() works in the frozen app.
import sys
import tomllib
from glob import glob

with open("pyproject.toml", "rb") as f:
    VERSION = tomllib.load(f)["project"]["version"]

datas = [("pyproject.toml", ".")] + [(path, ".") for path in sorted(glob("*.txt"))]

a = Analysis(
    ["constraintPuzzlerMain.py"],
    pathex=["."],
    datas=datas,
    excludes=["tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ConstraintPuzzler",
    console=False,
    upx=False,
)

coll = COLLECT(exe, a.binaries, a.datas, name="ConstraintPuzzler", upx=False)

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="ConstraintPuzzler.app",
        bundle_identifier="io.github.joostvanpinxten.constraintpuzzler",
        version=VERSION,
    )
