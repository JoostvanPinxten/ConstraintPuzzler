/** Parser for nonogram files (one or more colours); see doc/puzzle-files.md for the syntax. */
import {
  BLACK_AND_WHITE,
  RunsConstraint,
  type PaletteColor,
  type Run,
} from '../constraints/runsconstraint';
import type { Cell } from '../structure/cell';
import { paletteColorName } from '../constraints/runsexplanation';
import { msg, type Message } from '../i18n/message';
import { Position } from '../structure/position';
import { Puzzle } from '../structure/puzzle';
import type { Value } from '../structure/types';
import { PuzzleFileError } from './common';

const SECTIONS = ['colors', 'rows', 'columns'] as const;
type Section = (typeof SECTIONS)[number];
const COLOR_LINE = /^([a-z])\s+(\S+)\s+(#[0-9a-f]{3}|#[0-9a-f]{6})$/i;
const RUN_TOKEN = /^(\d+)([a-z]?)$/i;

interface Line {
  readonly text: string;
  readonly number: number;
}

/** A clue line: '3 1', '3r 1b' (colour codes from the colors section), or '-' / '0' for none. */
function parseClue(text: string, codes: ReadonlyMap<string, Value>): Run[] {
  if (text === '-' || text === '0') return [];
  const single = codes.size === 1;
  return text.split(/\s+/).map((token) => {
    const match = RUN_TOKEN.exec(token);
    if (match === null) throw new Error(`expected a block like 3 or 3r, got '${token}'`);
    const length = Number(match[1]);
    if (length < 1) throw new Error(`a block needs at least one cell, got '${token}'`);
    const code = (match[2] ?? '').toLowerCase();
    if (code === '') {
      if (!single)
        throw new Error(`block '${token}' needs a colour (one of ${[...codes.keys()].join(', ')})`);
      return { color: [...codes.values()][0] as Value, length };
    }
    const color = codes.get(code);
    if (color === undefined) throw new Error(`unknown colour '${code}' in '${token}'`);
    return { color, length };
  });
}

/**
 * Reads a nonogram: an optional 'colors' section (one 'code name #rrggbb' per colour, e.g.
 * 'r red #d62728'; without it the puzzle is black and white), a 'rows' section with the clue
 * of every row from top to bottom, and a 'columns' section with the clue of every column from
 * left to right. Lines starting with '#' are comments. Blank cells have the value 0, the
 * colours 1, 2, ... in the order they are listed.
 */
export function parseNonogramLines(rawLines: readonly string[], filename = '<nonogram>'): Puzzle {
  const sections = new Map<Section, Line[]>();
  let current: Section | null = null;
  rawLines.forEach((raw, i) => {
    const text = raw.trim();
    if (text === '' || text.startsWith('#')) return;
    const section = SECTIONS.find((s) => s === text.toLowerCase());
    if (section !== undefined) {
      if (sections.has(section))
        throw new PuzzleFileError(filename, i + 1, `a second '${section}' section`);
      current = section;
      sections.set(section, []);
      return;
    }
    if (current === null) {
      throw new PuzzleFileError(
        filename,
        i + 1,
        `expected 'colors', 'rows' or 'columns', got '${text}'`,
      );
    }
    (sections.get(current) as Line[]).push({ text, number: i + 1 });
  });

  // the palette
  const palette: PaletteColor[] = [BLACK_AND_WHITE[0] as PaletteColor];
  const codes = new Map<string, Value>();
  const colorLines = sections.get('colors');
  if (colorLines === undefined || colorLines.length === 0) {
    palette.push(BLACK_AND_WHITE[1] as PaletteColor);
    codes.set('b', 1);
  } else {
    for (const line of colorLines) {
      const match = COLOR_LINE.exec(line.text);
      if (match === null) {
        throw new PuzzleFileError(
          filename,
          line.number,
          `expected a colour like 'r red #d62728', got '${line.text}'`,
        );
      }
      const code = (match[1] as string).toLowerCase();
      if (codes.has(code))
        throw new PuzzleFileError(filename, line.number, `colour code '${code}' is used twice`);
      const value = palette.length;
      codes.set(code, value);
      palette.push({ value, name: match[2] as string, hex: (match[3] as string).toLowerCase() });
    }
  }

  const clues = (section: Section): { runs: Run[]; line: Line }[] => {
    const lines = sections.get(section);
    if (lines === undefined || lines.length === 0) {
      throw new PuzzleFileError(filename, rawLines.length, `no '${section}' section`);
    }
    return lines.map((line) => {
      try {
        return { runs: parseClue(line.text, codes), line };
      } catch (error) {
        throw new PuzzleFileError(filename, line.number, (error as Error).message);
      }
    });
  };
  const rows = clues('rows');
  const columns = clues('columns');
  const width = columns.length;
  const height = rows.length;

  // every colour must have as many cells in the rows as in the columns
  const count = (lines: { runs: Run[] }[], color: Value): number =>
    lines.reduce(
      (n, l) => n + l.runs.filter((r) => r.color === color).reduce((m, r) => m + r.length, 0),
      0,
    );
  for (const color of palette.slice(1)) {
    const inRows = count(rows, color.value);
    const inColumns = count(columns, color.value);
    if (inRows !== inColumns) {
      throw new PuzzleFileError(
        filename,
        (columns[0] as { line: Line }).line.number,
        `the rows have ${inRows} ${color.name} cells, the columns ${inColumns}`,
      );
    }
  }

  const puzzle = new Puzzle(
    filename,
    palette.map((c) => c.value),
  );
  // hints and the info panel say "red", not "1"
  puzzle.setValueNames(new Map(palette.map((c) => [c.value, paletteColorName(c)])));
  const grid = puzzle.getGrid();
  const cells: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) row.push(grid.addCell(new Position(x + 1, y + 1)));
    cells.push(row);
  }
  const addLine = (name: Message, lineCells: Cell[], clue: { runs: Run[]; line: Line }): void => {
    const group = puzzle.addConstraintGroup(name);
    const constraint = group.addConstraint(RunsConstraint);
    for (const cell of lineCells) group.addCell(cell);
    try {
      constraint.setRuns(clue.runs, palette);
    } catch (error) {
      throw new PuzzleFileError(
        filename,
        clue.line.number,
        `${group.getName()}: ${(error as Error).message}`,
      );
    }
  };
  rows.forEach((clue, y) => addLine(msg('group.row', { index: y + 1 }), cells[y] as Cell[], clue));
  columns.forEach((clue, x) =>
    addLine(
      msg('group.column', { index: x + 1 }),
      cells.map((row) => row[x] as Cell),
      clue,
    ),
  );
  return puzzle;
}
