class ContradictionError(Exception):
    """Raised when the puzzle state is inconsistent, e.g. a cell has no options left
    or a value is removed from a cell where it has already been set."""
