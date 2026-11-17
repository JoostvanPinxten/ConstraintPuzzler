/** Parser for 9x9 Sudoku files; see doc/puzzle-files.md for the syntax. */
import { createEmptySudoku } from '../puzzlefactory';
import type { Puzzle } from '../structure/puzzle';

/**
 * Sets the givens of a square grid: one row per line, values separated by whitespace. Anything
 * that is not one of the puzzle values is an empty cell.
 */
export function readGridValues(puzzle: Puzzle, lines: readonly string[]): void {
  const values = puzzle.getValues();
  lines.forEach((line, y) => {
    line
      .split(/\s+/)
      .filter((element) => element.length > 0)
      .forEach((element, x) => {
        if (/^\d+$/.test(element) && values.includes(Number(element))) {
          puzzle.getGrid().setConstraintGridValue(x, y, Number(element));
        }
      });
  });
}

/**
 * Reads a 9x9 sudoku: one row per line, values separated by spaces. Anything that is not one
 * of the puzzle values (e.g. '-' or '0') is an empty cell.
 */
export function parseSudokuLines(lines: readonly string[]): Puzzle {
  const sudoku = createEmptySudoku();
  readGridValues(sudoku, lines);
  return sudoku;
}
