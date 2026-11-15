"""Render the logo SVGs to PNG with Qt's SVG renderer.

Usage: uv run python doc/logo/render.py
"""

import sys
from pathlib import Path

from PySide6.QtCore import QRectF, Qt
from PySide6.QtGui import QGuiApplication, QImage, QPainter
from PySide6.QtSvg import QSvgRenderer

HERE = Path(__file__).parent
TARGETS = [
    ("constraintpuzzler-mark.svg", "constraintpuzzler-mark-{0}.png", [16, 32, 64, 256, 512]),
    ("constraintpuzzler-logo.svg", "constraintpuzzler-logo.png", [None]),
]


def render(svg: Path, out: Path, size: int | None) -> None:
    renderer = QSvgRenderer(str(svg))
    default = renderer.defaultSize()
    w, h = (size, size) if size else (default.width() * 2, default.height() * 2)
    image = QImage(w, h, QImage.Format.Format_ARGB32)
    image.fill(Qt.GlobalColor.transparent)
    painter = QPainter(image)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    renderer.render(painter, QRectF(0, 0, w, h))
    painter.end()
    image.save(str(out))
    print(f"wrote {out.name} ({w}x{h})")


def main() -> None:
    QGuiApplication(sys.argv)
    for svg_name, out_pattern, sizes in TARGETS:
        for size in sizes:
            render(HERE / svg_name, HERE / out_pattern.format(size), size)


if __name__ == "__main__":
    main()
