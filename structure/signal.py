class Signal:
    """Minimal observer, replacing Qt signals in the puzzle model.

    Unlike Qt signals, exceptions raised by a connected callback propagate to
    the code that emitted the signal. The solver relies on this to notice
    contradictions found while constraints react to a changed cell."""

    def __init__(self):
        self._callbacks = []

    def connect(self, callback):
        self._callbacks.append(callback)

    def disconnect(self, callback):
        self._callbacks.remove(callback)

    def emit(self, *args):
        for callback in list(self._callbacks):
            callback(*args)
