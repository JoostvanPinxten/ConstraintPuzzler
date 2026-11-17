"""Export the Python engine's results for every example puzzle as JSON fixtures.

The TypeScript port of the engine (packages/core) is tested against these files, so both
engines must parse the examples into the same structure and reach the same conclusions.

Only order-independent facts are recorded: cells are hashed by identity, so the order in which
the Python solver logs its deductions is not reproducible between runs.

    uv run python -m tools.export_fixtures
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from constraints.totalsumvalueconstraint import TotalSumValueConstraint
from solver.solver import Solver
from structure.cell import PositionedCell
from structure.errors import ContradictionError
from structure.puzzle import Puzzle
from structure.types import PuzzleState
from utility.puzzletypes import PUZZLE_TYPES
from utility.resources import resourcePath

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "packages" / "core" / "fixtures"


def structureOf(puzzle: Puzzle) -> dict[str, Any]:
    cells = puzzle.grid.cells
    index = {cell: i for i, cell in enumerate(cells)}
    return {
        "values": puzzle.getValues(),
        "cells": [
            {
                "position": (
                    [c.getPosition().x(), c.getPosition().y()]
                    if isinstance(c, PositionedCell)
                    else None
                ),
                "given": c.getValue(),
            }
            for c in cells
        ],
        "groups": [
            {
                "name": g.getName(),
                "cells": [index[c] for c in g.getCells()],
                "constraints": [
                    {
                        "type": k.getType(),
                        **(
                            {"total": k.getTotalValue()}
                            if isinstance(k, TotalSumValueConstraint)
                            else {}
                        ),
                    }
                    for k in g.getConstraints()
                ],
            }
            for g in puzzle.getConstraintGroups()
        ],
    }


def cellsOf(state: PuzzleState) -> list[dict[str, Any]]:
    cellStates, _ = state
    return [
        {"value": value, "candidates": sorted(candidates)}
        for candidates, value, _source in cellStates
    ]


def firstPassOf(puzzle: Puzzle, solver: Solver) -> list[dict[str, Any]]:
    """The values one deduction pass determines (what hint() chooses from), sorted."""
    index = {cell: i for i, cell in enumerate(puzzle.grid.cells)}
    state = puzzle.saveState()
    try:
        with puzzle.recording(solver.log):
            solver.step()
        deduced = solver._deducedValues()
    finally:
        puzzle.restoreState(state)
    rows = {
        (
            index[d.cell],
            d.value,
            d.difficulty(),
            d.cause.getType() if d.cause is not None else None,
        )
        for d in deduced
    }
    return [
        {"cell": c, "value": v, "difficulty": diff, "cause": cause}
        for c, v, diff, cause in sorted(rows, key=lambda r: (r[0], r[1] or 0, r[2], r[3] or ""))
    ]


def export(typeName: str, label: str, filename: str) -> dict[str, Any]:
    puzzleType = PUZZLE_TYPES[typeName]
    puzzle = puzzleType.parser(resourcePath(filename))
    fixture: dict[str, Any] = {
        "type": typeName,
        "example": label,
        "file": filename,
        "structure": structureOf(puzzle),
    }

    solver = Solver(puzzle)
    fixture["firstPass"] = firstPassOf(puzzle, solver)

    initial = puzzle.saveState()
    try:
        solved = solver.solve()
        fixture["propagated"] = {"solved": solved, "cells": cellsOf(puzzle.saveState())}
    except ContradictionError:
        fixture["propagated"] = None
    puzzle.restoreState(initial)

    solution, unique = Solver(puzzle).findSolution()
    fixture["solution"] = {
        "unique": unique,
        "values": [cell["value"] for cell in cellsOf(solution)],
    }
    return fixture


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for puzzleType in PUZZLE_TYPES.values():
        for label, filename in puzzleType.examples.items():
            fixture = export(puzzleType.name, label, filename)
            target = OUTPUT / (Path(filename).stem + ".json")
            with open(target, "w", encoding="utf-8", newline="\n") as f:
                json.dump(fixture, f, indent=1)
                f.write("\n")
            print(f"wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
