/** Parser for Kakuro files; see doc/puzzle-files.md for the syntax. */
import { TotalSumValueConstraint } from '../constraints/totalsumvalueconstraint';
import { UniqueValueConstraint } from '../constraints/uniquevalueconstraint';
import type { PositionedCell } from '../structure/cell';
import { msg } from '../i18n/message';
import { Position } from '../structure/position';
import { Puzzle } from '../structure/puzzle';
import {
  parseInteger,
  parsePosition,
  parsePositionList,
  parseRange,
  PuzzleFileError,
} from './common';

/**
 * Reads the lines of a Kakuro file. Throws PuzzleFileError (naming filename and the line) when
 * they cannot be parsed.
 */
export function parseKakuroLines(lines: readonly string[], filename = '<kakuro>'): Puzzle {
  let puzzle: Puzzle | null = null;
  const cells = new Map<string, PositionedCell>(); // Position.key() -> cell, declared so far
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!['range', 'cell', 'total'].some((keyword) => line.startsWith(keyword))) {
      return; // comments and blank lines
    }
    try {
      if (line.startsWith('range')) {
        puzzle = new Puzzle('Test-kakuro', parseRange(line.split('=')[1] ?? ''));
        return;
      }
      if (puzzle === null) throw new Error("'range = min,max' must come before cells and totals");

      if (line.startsWith('cell')) {
        const position = parsePosition(line.slice('cell'.length));
        if (cells.has(position.key())) {
          throw new Error(`cell ${position.toString()} is declared twice`);
        }
        cells.set(position.key(), puzzle.getGrid().addCell(position));
        return;
      }

      // total((x,y);(x,y);...) = value
      const rest = line.slice('total'.length);
      const separator = rest.lastIndexOf('=');
      const cellText = separator >= 0 ? rest.slice(0, separator).trim() : '';
      const valueText = separator >= 0 ? rest.slice(separator + 1) : rest;
      if (separator < 0 || !(cellText.startsWith('(') && cellText.endsWith(')'))) {
        throw new Error('expected total((x,y);(x,y);...) = value');
      }
      const positions = parsePositionList(cellText.slice(1, -1));
      const value = parseInteger(valueText);
      for (const position of positions) {
        if (!cells.has(position.key())) {
          throw new Error(`cell ${position.toString()} is used before it is declared`);
        }
      }
      if (new Set(positions.map((p) => p.key())).size !== positions.length) {
        throw new Error('a cell appears more than once in this total');
      }
      const group = puzzle.addConstraintGroup(msg('group.line'));
      for (const position of positions) group.addCell(cells.get(position.key()) as PositionedCell);
      group.addConstraint(UniqueValueConstraint);
      group.addConstraint(TotalSumValueConstraint).setTotalValue(value);
    } catch (error) {
      if (error instanceof PuzzleFileError) throw error;
      throw new PuzzleFileError(filename, i + 1, `${(error as Error).message} (${line})`);
    }
  });
  if (puzzle === null) {
    throw new PuzzleFileError(filename, lines.length, "no 'range = min,max' line found");
  }
  return puzzle;
}

/**
 * Where the clue of a Kakuro line is drawn: the position of the black square just before the
 * line's first cell, and the direction of the line ("down" or "across").
 *
 * A line whose cells all share their x coordinate (and has more than one cell) runs down; any
 * other line runs across.
 */
export function clueAnchor(cells: Iterable<PositionedCell>): [Position, 'down' | 'across'] {
  const positions = [...cells].map((cell) => cell.getPosition());
  const first = positions[0];
  if (first === undefined) throw new Error('a Kakuro line needs at least one cell');
  if (positions.length > 1 && new Set(positions.map((p) => p.x())).size === 1) {
    const top = positions.reduce((best, p) => (p.y() < best.y() ? p : best), first);
    return [new Position(top.x(), top.y() - 1), 'down'];
  }
  const left = positions.reduce(
    (best, p) => (p.x() < best.x() || (p.x() === best.x() && p.y() < best.y()) ? p : best),
    first,
  );
  return [new Position(left.x() - 1, left.y()), 'across'];
}
