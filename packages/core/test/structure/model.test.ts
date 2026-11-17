// The puzzle model: Signal, Cell, Grid, ConstraintGroup membership and puzzle snapshots.
import { beforeEach, describe, expect, it } from 'vitest';

import { UniqueValueConstraint } from '../../src/constraints/uniquevalueconstraint';
import { createEmptySudoku, createFutoshikiPuzzle } from '../../src/puzzlefactory';
import { PositionedCell, ValueSource, type Cell } from '../../src/structure/cell';
import { ContradictionError } from '../../src/structure/errors';
import { Position } from '../../src/structure/position';
import { Puzzle } from '../../src/structure/puzzle';
import { Signal } from '../../src/structure/signal';
import { sortedValues } from '../../src/structure/types';

const candidates = (cell: Cell): number[] => sortedValues(cell.getPossibleValues());

describe('Signal', () => {
  it('calls the callbacks in order', () => {
    const signal = new Signal<[number]>();
    const calls: [string, number][] = [];
    signal.connect((x) => calls.push(['a', x]));
    signal.connect((x) => calls.push(['b', x]));
    signal.emit(1);
    expect(calls).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('disconnects', () => {
    const signal = new Signal<[number]>();
    const calls: number[] = [];
    const callback = (x: number): void => void calls.push(x);
    signal.connect(callback);
    signal.disconnect(callback);
    signal.emit(1);
    expect(calls).toEqual([]);
  });

  it('lets exceptions propagate (the solver relies on this)', () => {
    const signal = new Signal<[number]>();
    signal.connect(() => {
      throw new ContradictionError('boom');
    });
    expect(() => signal.emit(1)).toThrow(ContradictionError);
  });

  it('lets a callback disconnect while emitting', () => {
    const signal = new Signal<[number]>();
    const calls: number[] = [];
    const once = (x: number): void => {
      calls.push(x);
      signal.disconnect(once);
    };
    signal.connect(once);
    signal.emit(1);
    signal.emit(2);
    expect(calls).toEqual([1]);
  });
});

describe('Cell', () => {
  let puzzle: Puzzle;
  let cell: Cell;
  let changed: Cell[];
  let narrowed: Cell[];

  beforeEach(() => {
    puzzle = new Puzzle('test', [1, 2, 3]);
    cell = puzzle.getGrid().addCell();
    changed = [];
    narrowed = [];
    cell.valueChanged.connect((c) => changed.push(c));
    cell.possibleValuesChanged.connect((c) => narrowed.push(c));
  });

  it('sets a value', () => {
    cell.setValue(2);
    expect(cell.getValue()).toBe(2);
    expect(candidates(cell)).toEqual([2]);
    expect(cell.isGiven()).toBe(true);
    expect(changed).toEqual([cell]);
  });

  it('knows where its value came from', () => {
    cell.inferValue(1);
    expect(cell.isInferred()).toBe(true);
    expect(cell.isGiven()).toBe(false);
    const other = puzzle.getGrid().addCell();
    other.setValue(1, ValueSource.ENTERED);
    expect(other.isEntered()).toBe(true);
    expect(other.isGiven()).toBe(false);
  });

  it('refuses an impossible value', () => {
    cell.remove(3);
    expect(() => cell.setValue(3)).toThrow(ContradictionError);
  });

  it('removes candidates', () => {
    cell.remove(1);
    expect(candidates(cell)).toEqual([2, 3]);
    expect(narrowed).toEqual([cell]);
    cell.remove(1); // already gone: no new notification
    expect(narrowed).toEqual([cell]);
  });

  it('refuses to remove the last candidate', () => {
    cell.remove(1);
    cell.remove(2);
    expect(() => cell.remove(3)).toThrow(ContradictionError);
  });

  it('refuses to remove its value', () => {
    cell.setValue(2);
    expect(() => cell.remove(2)).toThrow(ContradictionError);
  });

  it('turns a single candidate into its value', () => {
    cell.remove(1);
    cell.checkForSinglePossibility();
    expect(cell.hasValue()).toBe(false);
    cell.remove(2);
    cell.checkForSinglePossibility();
    expect(cell.getValue()).toBe(3);
    expect(cell.isInferred()).toBe(true);
  });

  it('keeps its groups when reset', () => {
    const group = puzzle.addConstraintGroup('Group');
    group.addCell(cell);
    cell.setValue(1);
    cell.reset();
    expect(cell.hasValue()).toBe(false);
    expect(candidates(cell)).toEqual([1, 2, 3]);
    expect(cell.getConstraintGroups()).toEqual([group]);
  });
});

describe('Grid', () => {
  it('holds positioned cells', () => {
    const puzzle = new Puzzle('test', [1, 2]);
    const cell = puzzle.getGrid().addCell(new Position(2, 3));
    expect(cell).toBeInstanceOf(PositionedCell);
    expect(cell.getName()).toBe('2, 3');
    expect(puzzle.getGrid().searchCellWithPosition(new Position(2, 3))).toBe(cell);
    expect(cell.getGrid().getPuzzle()).toBe(puzzle);
  });

  it('lays out a square grid row by row', () => {
    const sudoku = createEmptySudoku();
    const grid = sudoku.getGrid();
    const cells = grid.getCells();
    expect(cells).toHaveLength(81);
    expect(grid.getCellFromSquareGrid(0, 0)).toBe(cells[0]);
    expect(grid.getCellFromSquareGrid(8, 0)).toBe(cells[8]);
    expect(grid.getCellFromSquareGrid(0, 1)).toBe(cells[9]);
    expect(grid.getCellFromSquareGrid(8, 8)).toBe(cells[80]);
  });
});

describe('ConstraintGroup', () => {
  it('is known to its cells', () => {
    const sudoku = createEmptySudoku();
    const cell = sudoku.getGrid().getCellFromSquareGrid(4, 4);
    const names = cell
      .getConstraintGroups()
      .map((g) => g.getName())
      .sort();
    expect(names).toEqual(['Block 5', 'Column 5', 'Row 5']);
    for (const group of cell.getConstraintGroups()) expect(group.getCells()).toContain(cell);
  });

  it('is known to cells added by the factories', () => {
    const puzzle = createFutoshikiPuzzle(4);
    for (const cell of puzzle.getGrid().getCells()) {
      expect(cell.getConstraintGroups()).toHaveLength(2);
    }
  });

  it('takes its values from the puzzle', () => {
    const puzzle = new Puzzle('test', [1, 2, 3]);
    const group = puzzle.addConstraintGroup('Group');
    expect(sortedValues(group.getValues())).toEqual([1, 2, 3]);
    const constraint = group.addConstraint(UniqueValueConstraint);
    expect(sortedValues(constraint.values)).toEqual([1, 2, 3]);
  });

  it('removes a placed value from the peers', () => {
    const puzzle = new Puzzle('test', [1, 2, 3]);
    const group = puzzle.addConstraintGroup('Group');
    group.addConstraint(UniqueValueConstraint);
    const cells = [0, 1, 2].map(() => puzzle.getGrid().addCell());
    for (const cell of cells) group.addCell(cell);
    cells[0]?.setValue(2);
    expect(candidates(cells[1] as Cell)).toEqual([1, 3]);
    expect(candidates(cells[2] as Cell)).toEqual([1, 3]);
  });
});

describe('puzzle state', () => {
  it('restores a snapshot', () => {
    const sudoku = createEmptySudoku();
    const state = sudoku.saveState();
    const cell = sudoku.getGrid().getCellFromSquareGrid(0, 0);
    const peer = sudoku.getGrid().getCellFromSquareGrid(5, 0);
    cell.setValue(4);
    expect(peer.values.has(4)).toBe(false);
    expect(sudoku.saveState()).not.toEqual(state);

    sudoku.restoreState(state);
    expect(cell.hasValue()).toBe(false);
    expect(peer.values.has(4)).toBe(true);
    expect(sudoku.saveState()).toEqual(state);
  });

  it('only notifies the cells that changed', () => {
    const sudoku = createEmptySudoku();
    const state = sudoku.saveState();
    sudoku.getGrid().getCellFromSquareGrid(0, 0).setValue(4);
    const notified: Cell[] = [];
    for (const c of sudoku.getGrid().getCells()) {
      c.possibleValuesChanged.connect((x) => notified.push(x));
      c.valueChanged.connect((x) => notified.push(x));
    }
    sudoku.restoreState(state);
    // the cell itself plus the 20 cells in its row, column and block
    expect(notified).toHaveLength(21);
    expect(new Set(notified).size).toBe(21);
  });
});
