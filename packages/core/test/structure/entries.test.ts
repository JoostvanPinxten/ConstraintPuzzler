// Entering, changing and clearing values by hand (UserEntries).
import { beforeEach, describe, expect, it } from 'vitest';

import { parseSudokuLines } from '../../src/parsers/sudoku';
import type { Cell } from '../../src/structure/cell';
import { EntryError, UserEntries } from '../../src/structure/entries';
import type { Puzzle } from '../../src/structure/puzzle';
import { sortedValues } from '../../src/structure/types';
import { EASY } from '../helpers';

describe('UserEntries', () => {
  let puzzle: Puzzle;
  let entries: UserEntries;
  let topLeft: Cell;
  const cell = (x: number, y: number): Cell => puzzle.getGrid().getCellFromSquareGrid(x, y);

  beforeEach(() => {
    puzzle = parseSudokuLines(EASY);
    entries = new UserEntries(puzzle);
    // top-left cell: 6, 9, 2 in its row, 8, 3, 1, 5 in its column
    topLeft = cell(0, 0);
    expect(sortedValues(topLeft.getPossibleValues())).toEqual([4, 7]);
  });

  it('propagates an entered value', () => {
    entries.enter(topLeft, 4);
    expect(topLeft.getValue()).toBe(4);
    expect(topLeft.isEntered()).toBe(true);
    expect(topLeft.isGiven()).toBe(false);
    expect(topLeft.isInferred()).toBe(false);
    expect(cell(4, 0).values.has(4)).toBe(false);
  });

  it('cannot change given cells', () => {
    const given = cell(1, 0);
    expect(given.isGiven()).toBe(true);
    expect(() => entries.enter(given, 4)).toThrow(EntryError);
    expect(() => entries.enter(given, 4)).toThrow(/given/);
    expect(() => entries.clear(given)).toThrow(/given/);
    expect(given.getValue()).toBe(6);
  });

  it('keeps a value that is not a candidate as a mistake', () => {
    const state = puzzle.saveState();
    expect(entries.violations()).toEqual(new Set());
    entries.enter(topLeft, 6);
    // shown, but kept out of the model
    expect(puzzle.saveState()).toEqual(state);
    expect(entries.isMistake(topLeft)).toBe(true);
    expect(entries.valueOf(topLeft)).toBe(6);
    expect(topLeft.getValue()).toBeNull();
    // the given 6 in the same row clashes with it
    expect(entries.violations()).toEqual(new Set([topLeft, cell(1, 0)]));

    // fixing the mistake
    entries.enter(topLeft, 4);
    expect(entries.isMistake(topLeft)).toBe(false);
    expect(topLeft.getValue()).toBe(4);
    expect(entries.violations()).toEqual(new Set());
  });

  it('clears a mistake', () => {
    const state = puzzle.saveState();
    entries.enter(topLeft, 6);
    entries.clear(topLeft);
    expect(entries.mistakes).toEqual(new Map());
    expect(entries.violations()).toEqual(new Set());
    expect(puzzle.saveState()).toEqual(state);
  });

  it('refuses values the puzzle does not use', () => {
    const state = puzzle.saveState();
    expect(() => entries.enter(topLeft, 0)).toThrow(/not a value/);
    expect(puzzle.saveState()).toEqual(state);
    expect(entries.entries).toEqual(new Map());
  });

  it('replays the entries when a value changes', () => {
    entries.enter(topLeft, 4);
    entries.enter(topLeft, 7);
    expect(topLeft.getValue()).toBe(7);
    // the same as entering 7 straight away: the 4 is back as a candidate in the row
    const fresh = parseSudokuLines(EASY);
    new UserEntries(fresh).enter(fresh.getGrid().getCellFromSquareGrid(0, 0), 7);
    expect(puzzle.saveState()).toEqual(fresh.saveState());
  });

  it('restores the loaded puzzle when clearing', () => {
    const state = puzzle.saveState();
    entries.enter(topLeft, 4);
    entries.clear(topLeft);
    expect(puzzle.saveState()).toEqual(state);
    expect(entries.entries).toEqual(new Map());
  });

  it('turns a change that clashes with another entry into a mistake', () => {
    entries.enter(topLeft, 4);
    const other = cell(3, 0); // same row, candidates 7 and 8
    entries.enter(other, 7);
    entries.enter(topLeft, 7);
    expect(entries.mistakes).toEqual(new Map([[topLeft, 7]]));
    expect(topLeft.getValue()).toBeNull();
    expect(other.getValue()).toBe(7);
    expect(entries.violations()).toEqual(new Set([topLeft, other]));

    // clearing the other entry makes the 7 fit: it is entered in the model after all
    entries.clear(other);
    expect(entries.mistakes).toEqual(new Map());
    expect(topLeft.getValue()).toBe(7);
    expect(entries.violations()).toEqual(new Set());
  });

  it('keeps the entered flag through save and restore', () => {
    const state = puzzle.saveState();
    entries.enter(topLeft, 4);
    const entered = puzzle.saveState();
    puzzle.restoreState(state);
    expect(topLeft.isEntered()).toBe(false);
    puzzle.restoreState(entered);
    expect(topLeft.isEntered()).toBe(true);
  });
});
