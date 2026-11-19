/**
 * Parser for Jidoku ("Less-Than-Sudoku") files; see doc/puzzle-files.md for the syntax.
 *
 * Jidoku as in O'Sullivan & Horan, "Generating and Solving Logic Puzzles through Constraint
 * Satisfaction" (AAAI 2007): a 9x9 Sudoku whose clues are < / > relations between orthogonally
 * adjacent cells of the same 3x3 box, usually without any given values.
 */
import { createEmptySudoku } from '../puzzlefactory';
import type { Puzzle } from '../structure/puzzle';
import { addRelations, splitGridAndRelations, type Relation } from './futoshiki';
import { PuzzleFileError } from './common';
import { readGridValues } from './sudoku';

/** Why a relation is not a Jidoku clue, or null when it is one. */
export function jidokuRelationProblem([[x1, y1], [x2, y2]]: Relation): string | null {
  for (const v of [x1, y1, x2, y2]) {
    if (v < 0 || v > 8) return 'cells must lie within the 9x9 grid (1-9)';
  }
  if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return 'the cells must be orthogonal neighbours';
  if (Math.floor(x1 / 3) !== Math.floor(x2 / 3) || Math.floor(y1 / 3) !== Math.floor(y2 / 3)) {
    return 'the cells must lie in the same 3x3 box';
  }
  return null;
}

/**
 * Reads a jidoku: the 9x9 grid in the sudoku file format (usually all '-'), a 'relativity' line
 * and one 'x1,y1>x2,y2' line per clue (1-based), meaning cell (x1,y1) is greater than (x2,y2).
 */
export function parseJidokuLines(rawLines: readonly string[], filename = '<jidoku>'): Puzzle {
  const { gridLines, relations } = splitGridAndRelations(rawLines, filename, jidokuRelationProblem);
  if (gridLines.length !== 9) {
    throw new PuzzleFileError(filename, 1, `expected 9 grid lines, got ${gridLines.length}`);
  }
  const puzzle = createEmptySudoku('Jidoku');
  readGridValues(puzzle, gridLines);
  addRelations(puzzle, relations);
  return puzzle;
}
