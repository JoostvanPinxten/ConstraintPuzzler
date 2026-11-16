from collections.abc import Callable
from typing import Any


class Signal:
    """Minimal observer, replacing Qt signals in the puzzle model.

    Unlike Qt signals, exceptions raised by a connected callback propagate to
    the code that emitted the signal. The solver relies on this to notice
    contradictions found while constraints react to a changed cell."""

    def __init__(self) -> None:
        self._callbacks: list[Callable[..., Any]] = []

    def connect(self, callback: Callable[..., Any]) -> None:
        self._callbacks.append(callback)

    def disconnect(self, callback: Callable[..., Any]) -> None:
        self._callbacks.remove(callback)

    def emit(self, *args: Any) -> None:
        for callback in list(self._callbacks):
            callback(*args)
