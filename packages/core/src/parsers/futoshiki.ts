/** Parser for square Futoshiki files; see doc/puzzle-files.md for the syntax. */
import { CellGreaterThanCellConstraint } from '../constraints/cellgreaterthancellconstraint';
import { createFutoshikiPuzzle } from '../puzzlefactory';
import type { Cell } from '../structure/cell';
import type { Puzzle } from '../structure/puzzle';
import { parseInteger, PuzzleFileError } from './common';
import { readGridValues } from './sudoku';

/** '3,4' (1-based) -> [2, 3] (0-based x, y). */
function parseCell(text: string): [number, number] {
  const parts = text.split(',');
  if (parts.length !== 2) throw new Error(`expected a cell like x,y, got '${text}'`);
  return parts.map((v) => parseInteger(v) - 1) as [number, number];
}

/** One 'x1,y1>x2,y2' line: the 0-based (x, y) of the greater and of the lesser cell. */
export type Relation = readonly [greater: [number, number], lesser: [number, number]];

/** Adds a 'Relativity' group with a CellGreaterThanCellConstraint: greater > lesser. */
export function addRelation(puzzle: Puzzle, greaterCell: Cell, lesserCell: Cell): void {
  const group = puzzle.addConstraintGroup('Relativity');
  const constraint = group.addConstraint(CellGreaterThanCellConstraint);
  group.addCell(greaterCell);
  group.addCell(lesserCell);
  constraint.setGreaterCell(greaterCell);
  constraint.setLesserCell(lesserCell);
}

/**
 * Splits a square grid file with relations: the grid lines (non-empty, before the 'relativity'
 * line) and the relations after it, one 'x1,y1>x2,y2' per line (1-based; blank lines are skipped).
 * `check` may reject a relation with a message; the error names the file and line.
 */
export function splitGridAndRelations(
  rawLines: readonly string[],
  filename: string,
  check: (relation: Relation) => string | null = () => null,
): { gridLines: string[]; relations: Relation[] } {
  const lines = rawLines.map((line) => line.trim());
  const split = lines.indexOf('relativity');
  const gridLines = (split >= 0 ? lines.slice(0, split) : lines).filter((l) => l.length > 0);
  const relations: Relation[] = [];
  if (split < 0) return { gridLines, relations };
  lines.slice(split + 1).forEach((line, i) => {
    if (!line.includes('>')) return;
    const lineNumber = split + 2 + i;
    try {
      const parts = line.split('>');
      if (parts.length !== 2) throw new Error(`expected x1,y1>x2,y2, got '${line}'`);
      const relation: Relation = [parseCell(parts[0] as string), parseCell(parts[1] as string)];
      const problem = check(relation);
      if (problem !== null) throw new Error(problem);
      relations.push(relation);
    } catch (error) {
      if (error instanceof PuzzleFileError) throw error;
      throw new PuzzleFileError(filename, lineNumber, (error as Error).message);
    }
  });
  return { gridLines, relations };
}

/** Adds the relations to a square grid puzzle. */
export function addRelations(puzzle: Puzzle, relations: readonly Relation[]): void {
  const grid = puzzle.getGrid();
  for (const [greater, lesser] of relations) {
    addRelation(
      puzzle,
      grid.getCellFromSquareGrid(...greater),
      grid.getCellFromSquareGrid(...lesser),
    );
  }
}

/**
 * Reads a square futoshiki: the grid in the sudoku file format, followed by a 'relativity'
 * line and one 'x1,y1>x2,y2' line per inequality (1-based coordinates), meaning that cell
 * (x1,y1) is greater than cell (x2,y2).
 */
export function parseFutoshikiLines(rawLines: readonly string[], filename = '<futoshiki>'): Puzzle {
  const { gridLines, relations } = splitGridAndRelations(rawLines, filename);
  const puzzle = createFutoshikiPuzzle(gridLines.length);
  readGridValues(puzzle, gridLines);
  addRelations(puzzle, relations);
  return puzzle;
}
