"""Strip a PySide6 Android wheel down to what ConstraintPuzzler uses.

    python android/slim_wheel.py <in.whl> <out.whl>

pyside6-android-deploy's recipe copies the whole wheel into the APK: every Qt library, QML
module and translation (about 230 MB unpacked). This keeps the Python modules the app imports
(QtCore, QtGui, QtWidgets), the Qt plugins it needs on Android, and the native libraries these
load (followed through the ELF ``DT_NEEDED`` entries), and drops the other native libraries, the
QML modules and the translations. Everything else (Python files, jars, the dependency XML files
the deploy tool reads) is kept.
"""

from __future__ import annotations

import re
import struct
import sys
import zipfile

MODULES = ("Core", "Gui", "Widgets")
PLUGINS = re.compile(
    r"PySide6/Qt/plugins/("
    r"platforms/\w+_qtforandroid"
    r"|styles/\w+"
    r"|imageformats/\w+_q(gif|ico|jpeg|svg|webp)"
    r")_[\w-]+\.so$"
)
DROPPED_DIRS = ("PySide6/Qt/qml/", "PySide6/Qt/translations/")

PT_LOAD, PT_DYNAMIC = 1, 2
DT_NULL, DT_NEEDED, DT_STRTAB = 0, 1, 5


def neededLibraries(elf: bytes) -> list[str]:
    """The DT_NEEDED entries of a little-endian ELF64 shared library."""
    if elf[:4] != b"\x7fELF" or elf[4] != 2 or elf[5] != 1:
        raise ValueError("not a little-endian ELF64 file")
    phoff = struct.unpack_from("<Q", elf, 0x20)[0]
    phentsize, phnum = struct.unpack_from("<HH", elf, 0x36)
    loads: list[tuple[int, int, int]] = []  # (vaddr, filesz, offset)
    dynamic: tuple[int, int] | None = None  # (offset, size)
    for i in range(phnum):
        ptype, _flags, offset, vaddr, _paddr, filesz, _memsz, _align = struct.unpack_from(
            "<IIQQQQQQ", elf, phoff + i * phentsize
        )
        if ptype == PT_LOAD:
            loads.append((vaddr, filesz, offset))
        elif ptype == PT_DYNAMIC:
            dynamic = (offset, filesz)
    if dynamic is None:
        return []

    def fileOffset(address: int) -> int:
        for vaddr, filesz, offset in loads:
            if vaddr <= address < vaddr + filesz:
                return address - vaddr + offset
        raise ValueError(f"address {address:#x} is not in a loaded segment")

    entries: list[tuple[int, int]] = []
    for pos in range(dynamic[0], dynamic[0] + dynamic[1], 16):
        tag, value = struct.unpack_from("<qQ", elf, pos)
        if tag == DT_NULL:
            break
        entries.append((tag, value))
    strtab = fileOffset(next(value for tag, value in entries if tag == DT_STRTAB))
    names = []
    for tag, value in entries:
        if tag == DT_NEEDED:
            start = strtab + value
            names.append(elf[start : elf.index(b"\0", start)].decode())
    return names


def keptLibraries(wheel: zipfile.ZipFile) -> set[str]:
    """The .so files reachable from the used Python modules and plugins."""
    names = wheel.namelist()
    byBaseName = {name.rsplit("/", 1)[-1]: name for name in names if name.endswith(".so")}
    roots = [f"PySide6/Qt{module}.abi3.so" for module in MODULES]
    roots += ["PySide6/libpyside6.abi3.so"] + [name for name in names if PLUGINS.match(name)]
    missing = [root for root in roots[: len(MODULES) + 1] if root not in names]
    if missing:
        raise SystemExit(f"Not in the wheel: {', '.join(missing)}")

    kept: set[str] = set()
    todo = list(roots)
    while todo:
        name = todo.pop()
        if name in kept:
            continue
        kept.add(name)
        todo += [byBaseName[lib] for lib in neededLibraries(wheel.read(name)) if lib in byBaseName]
    return kept


def isKept(name: str, libraries: set[str]) -> bool:
    if name.startswith(DROPPED_DIRS):
        return False
    return not name.endswith(".so") or name in libraries


def main(source: str, target: str) -> None:
    with zipfile.ZipFile(source) as wheel:
        libraries = keptLibraries(wheel)
        before = after = 0
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as out:
            for info in wheel.infolist():
                before += info.file_size
                if not isKept(info.filename, libraries):
                    continue
                after += info.file_size
                data = wheel.read(info)
                if info.filename.endswith(".dist-info/RECORD"):
                    lines = data.decode().splitlines(keepends=True)
                    data = "".join(
                        line for line in lines if isKept(line.split(",", 1)[0], libraries)
                    ).encode()
                out.writestr(info, data)
    qtLibraries = sorted(name.rsplit("/", 1)[-1] for name in libraries if "/Qt/lib/" in name)
    print(f"Kept Qt libraries: {', '.join(qtLibraries)}")
    print(f"Unpacked size: {before / 1e6:.0f} MB -> {after / 1e6:.0f} MB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
