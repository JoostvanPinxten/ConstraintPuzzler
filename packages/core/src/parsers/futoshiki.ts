/** Parser for square Futoshiki files; see doc/puzzle-files.md for the syntax. */
import { CellGreaterThanCellConstraint } from '../constraints/cellgreaterthancellconstraint';
import { createFutoshikiPuzzle } from '../puzzlefactory';
import type { Puzzle } from '../structure/puzzle';
import { parseInteger } from './common';
import { readGridValues } from './sudoku';

/** '3,4' (1-based) -> [2, 3] (0-based x, y). */
function parseCell(text: string): [number, number] {
  const parts = text.split(',');
  if (parts.length !== 2) throw new Error(`expected a cell like x,y, got '${text}'`);
  return parts.map((v) => parseInteger(v) - 1) as [number, number];
}

/**
 * Reads a square futoshiki: the grid in the sudoku file format, followed by a 'relativity'
 * line and one 'x1,y1>x2,y2' line per inequality (1-based coordinates), meaning that cell
 * (x1,y1) is greater than cell (x2,y2).
 */
export function parseFutoshikiLines(rawLines: readonly string[]): Puzzle {
  const lines = rawLines.map((line) => line.trim());
  const split = lines.indexOf('relativity');
  const gridLines = (split >= 0 ? lines.slice(0, split) : lines).filter((l) => l.length > 0);
  const relationLines = split >= 0 ? lines.slice(split + 1) : [];

  const puzzle = createFutoshikiPuzzle(gridLines.length);
  readGridValues(puzzle, gridLines);

  for (const line of relationLines) {
    if (!line.includes('>')) continue;
    const parts = line.split('>');
    if (parts.length !== 2) throw new Error(`expected x1,y1>x2,y2, got '${line}'`);
    const greater = parseCell(parts[0] as string);
    const lesser = parseCell(parts[1] as string);
    const greaterCell = puzzle.getGrid().getCellFromSquareGrid(...greater);
    const lesserCell = puzzle.getGrid().getCellFromSquareGrid(...lesser);

    const group = puzzle.addConstraintGroup('Relativity');
    const constraint = group.addConstraint(CellGreaterThanCellConstraint);
    group.addCell(greaterCell);
    group.addCell(lesserCell);
    constraint.setGreaterCell(greaterCell);
    constraint.setLesserCell(lesserCell);
  }
  return puzzle;
}
