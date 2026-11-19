// The nonogram file format, and the example nonograms with the solver.
import { describe, expect, it } from 'vitest';

import { paletteOf, RunsConstraint } from '../../src/constraints/runsconstraint';
import { PuzzleFileError } from '../../src/parsers/common';
import { parseNonogramLines } from '../../src/parsers/nonogram';
import { Solver } from '../../src/solver/solver';
import { PositionedCell } from '../../src/structure/cell';
import { loadExample } from '../helpers';

const runsOf = (lines: string[], group: string) =>
  parseNonogramLines(lines)
    .getConstraintGroups()
    .find((g) => g.getName() === group)
    ?.getConstraints()[0] as RunsConstraint;

function fileError(lines: string[]): PuzzleFileError {
  try {
    parseNonogramLines(lines, 'test.txt');
  } catch (error) {
    expect(error).toBeInstanceOf(PuzzleFileError);
    return error as PuzzleFileError;
  }
  throw new Error('no error');
}

describe('nonogram files', () => {
  it('reads a black-and-white nonogram', () => {
    const lines = ['# a 3x2 picture', 'rows', '1 1', '-', 'columns', '1', '0', '1'];
    const puzzle = parseNonogramLines(lines, 'tiny.txt');
    expect(puzzle.getValues()).toEqual([0, 1]);
    expect(puzzle.getGrid().getCells()).toHaveLength(6);
    expect(puzzle.getConstraintGroups().map((g) => g.getName())).toEqual([
      'Row 1',
      'Row 2',
      'Column 1',
      'Column 2',
      'Column 3',
    ]);
    expect(runsOf(lines, 'Row 1').getRuns()).toEqual([
      { color: 1, length: 1 },
      { color: 1, length: 1 },
    ]);
    expect(runsOf(lines, 'Row 2').getRuns()).toEqual([]);
    expect(paletteOf(puzzle)?.map((c) => c.name)).toEqual(['blank', 'black']);
    // rows from top to bottom, columns from left to right (positions are 1-based x, y)
    const row1 = puzzle.getConstraintGroups()[0]?.getCells() as PositionedCell[];
    expect(row1.map((c) => c.getName())).toEqual(['1, 1', '2, 1', '3, 1']);
  });

  it('reads colours, in the order listed', () => {
    const lines = [
      'colors',
      'r red #D62728',
      'g green #2ca02c',
      'rows',
      '1r 1g',
      'columns',
      '1r',
      '1G',
    ];
    const puzzle = parseNonogramLines(lines);
    expect(puzzle.getValues()).toEqual([0, 1, 2]);
    expect(paletteOf(puzzle)).toEqual([
      { value: 0, name: 'blank', hex: '#ffffff' },
      { value: 1, name: 'red', hex: '#d62728' },
      { value: 2, name: 'green', hex: '#2ca02c' },
    ]);
    expect(runsOf(lines, 'Row 1').clueText()).toBe('1 red, 1 green');
  });

  it('names the line of a mistake', () => {
    expect(fileError(['rows', '1', 'columns', 'x']).lineNumber).toBe(4);
    expect(fileError(['1', 'rows']).message).toMatch(
      /line 1: expected 'colors', 'rows' or 'columns'/,
    );
    expect(fileError(['rows', '1', 'rows']).message).toMatch(/a second 'rows' section/);
    expect(fileError(['rows', '1']).message).toMatch(/no 'columns' section/);
    expect(fileError(['colors', 'r red', 'rows', '1r', 'columns', '1r']).lineNumber).toBe(2);
    expect(fileError(['colors', 'r red #f00', 'r rose #f0f']).message).toMatch(/used twice/);
    expect(
      fileError(['colors', 'r red #f00', 'g green #0f0', 'rows', '1', 'columns', '1r']).message,
    ).toMatch(/needs a colour/);
    expect(fileError(['colors', 'r red #f00', 'rows', '1x', 'columns', '1r']).message).toMatch(
      /unknown colour 'x'/,
    );
    expect(fileError(['rows', '0 1', 'columns', '1']).message).toMatch(/at least one cell/);
    expect(fileError(['rows', '1+', 'columns', '1']).message).toMatch(/expected a block/);
    expect(fileError(['rows', '1', 'columns', '1', '1']).message).toMatch(
      /the rows have 1 black cells, the columns 2/,
    );
    expect(fileError(['rows', '2 1', 'columns', '1', '1', '1']).message).toMatch(
      /line 2: Row 1: the blocks 2 1 do not fit in 3/,
    );
  });
});

describe('nonogram value names', () => {
  it('names the values after the colours, in hints and steps', () => {
    const puzzle = loadExample('nonogram', 'nonogramCherries.txt');
    expect(puzzle.valueName(0)).toBe('blank');
    expect(puzzle.valueName(1)).toBe('red');
    expect(puzzle.formatValues([3, 1])).toBe('red, brown');
    const hint = new Solver(puzzle).hint();
    expect(hint?.describe()).toMatch(/^cell \d+, \d+ is (blank|red|green|brown): /);
  });

  it('names black and white', () => {
    const puzzle = loadExample('nonogram', 'nonogramCup.txt');
    expect([0, 1].map((v) => puzzle.valueName(v))).toEqual(['blank', 'black']);
  });

  it('leaves the values of other puzzles as numbers', () => {
    const sudoku = loadExample('sudoku', 'easySudoku.txt');
    expect(sudoku.valueName(4)).toBe('4');
    expect(sudoku.formatValues([])).toBe('none');
  });
});

describe('the example nonograms', () => {
  it.each([
    ['nonogramCup.txt', 100],
    ['nonogramCherries.txt', 100],
  ])('%s has one solution, found by line logic alone', (file, cells) => {
    const puzzle = loadExample('nonogram', file);
    expect(puzzle.getGrid().getCells()).toHaveLength(cells);
    expect(new Solver(loadExample('nonogram', file)).countSolutions()).toBe(1);
    const solver = new Solver(puzzle);
    solver.propagate();
    expect(
      puzzle
        .getGrid()
        .getCells()
        .every((c) => c.getValue() !== null),
    ).toBe(true);
    for (const group of puzzle.getConstraintGroups()) {
      for (const constraint of group.getConstraints()) {
        expect(constraint.violations((c) => c.getValue()).size).toBe(0);
      }
    }
  });

  it('hints the easiest deduction first', () => {
    const hint = new Solver(loadExample('nonogram', 'nonogramCherries.txt')).hint();
    // the cherries have lines that their blocks fill completely
    expect(hint?.difficulty()).toBe(2);
    expect(hint?.reason()).toMatch(/fill the whole (line|column)$/);
  });

  it('steps through the cup with explained values', () => {
    const puzzle = loadExample('nonogram', 'nonogramCup.txt');
    const solver = new Solver(puzzle);
    for (let i = 0; i < 10; i++) {
      expect(solver.solveStep()).toBe(true);
      expect(solver.lastStep?.reason()).not.toBe('removed');
    }
  });
});
