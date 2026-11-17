// Playing a puzzle: entries and solver actions through Game, with undo and redo.
import { beforeEach, describe, expect, it } from 'vitest';

import { parseSudokuLines } from '../../src/parsers/sudoku';
import { Solver } from '../../src/solver/solver';
import { ValueSource, type Cell } from '../../src/structure/cell';
import { EntryError } from '../../src/structure/entries';
import { Game } from '../../src/structure/game';
import type { Puzzle } from '../../src/structure/puzzle';
import { sortedValues, type PuzzleState } from '../../src/structure/types';
import { EASY, loadExample } from '../helpers';

const notes = (game: Game, cell: Cell): number[] => sortedValues(game.notesOf(cell));

describe('Game', () => {
  let puzzle: Puzzle;
  let game: Game;
  let topLeft: Cell;
  let loaded: PuzzleState;
  const cell = (x: number, y: number): Cell => puzzle.getGrid().getCellFromSquareGrid(x, y);

  beforeEach(() => {
    puzzle = parseSudokuLines(EASY);
    game = new Game(puzzle);
    topLeft = cell(0, 0); // candidates 4 and 7
    loaded = puzzle.saveState();
  });

  it('has nothing to undo at the start', () => {
    expect(game.canUndo()).toBe(false);
    expect(game.undo()).toBe(false);
    expect(game.redo()).toBe(false);
  });

  it('undoes and redoes an entry', () => {
    game.enter(topLeft, 4);
    expect(topLeft.getValue()).toBe(4);
    expect(topLeft.getSource()).toBe(ValueSource.ENTERED);
    expect(game.canUndo()).toBe(true);

    expect(game.undo()).toBe(true);
    expect(topLeft.hasValue()).toBe(false);
    expect(puzzle.saveState()).toEqual(loaded);
    expect(game.entries.entries).toEqual(new Map());
    expect(game.canRedo()).toBe(true);

    expect(game.redo()).toBe(true);
    expect(topLeft.getValue()).toBe(4);
    expect(game.entries.entries).toEqual(new Map([[topLeft, 4]]));
  });

  it('undoes a mistake', () => {
    game.enter(topLeft, 1); // 1 is in its column: a mistake
    expect(game.isMistake(topLeft)).toBe(true);
    expect(game.violations().has(topLeft)).toBe(true);
    expect(game.violationNote(topLeft)).not.toBeNull();
    game.undo();
    expect(game.isMistake(topLeft)).toBe(false);
    expect(game.violations()).toEqual(new Set());
  });

  it('clears the redo history on a new action', () => {
    game.enter(topLeft, 4);
    game.undo();
    game.enter(topLeft, 7);
    expect(game.canRedo()).toBe(false);
    expect(topLeft.getValue()).toBe(7);
  });

  it('does not record a rejected entry', () => {
    expect(() => game.enter(cell(1, 0), 3)).toThrow(EntryError);
    expect(game.canUndo()).toBe(false);
  });

  it('does not record an entry that changes nothing', () => {
    game.clear(topLeft); // already empty
    expect(game.canUndo()).toBe(false);
  });

  it('undoes solve', () => {
    expect(game.solve(new Solver(puzzle))).toBe(true);
    expect(game.isSolved()).toBe(true);
    expect(topLeft.getSource()).toBe(ValueSource.DEDUCED);
    game.undo();
    expect(puzzle.saveState()).toEqual(loaded);
  });

  it('undoes a single solve step', () => {
    const openCells = puzzle.getNumberOfOpenCells();
    expect(game.solveStep(new Solver(puzzle))).toBe(true);
    expect(puzzle.getNumberOfOpenCells()).toBe(openCells - 1);
    game.undo();
    expect(puzzle.getNumberOfOpenCells()).toBe(openCells);
  });

  it('replaces mistakes when solving', () => {
    game.enter(topLeft, 1);
    game.solve(new Solver(puzzle));
    expect(game.isMistake(topLeft)).toBe(false);
    expect([4, 7]).toContain(game.valueOf(topLeft));
    expect(game.isSolved()).toBe(true);
    // undo brings the mistake back
    game.undo();
    expect(game.isMistake(topLeft)).toBe(true);
  });

  it('limits the history', () => {
    const limited = new Game(puzzle, 2);
    for (const value of [4, 7, 4]) limited.enter(topLeft, value);
    expect(limited.undo()).toBe(true);
    expect(limited.undo()).toBe(true);
    expect(limited.undo()).toBe(false);
  });

  it('tells subscribers about changes', () => {
    let calls = 0;
    const unsubscribe = game.subscribe(() => calls++);
    game.enter(topLeft, 4);
    game.clear(cell(2, 2)); // already empty: no change
    game.undo();
    game.redo();
    expect(calls).toBe(3);
    expect(game.revision).toBe(3);
    unsubscribe();
    game.undo();
    expect(calls).toBe(3);
  });
});

describe('notes', () => {
  let puzzle: Puzzle;
  let game: Game;
  let topLeft: Cell;
  let given: Cell;

  beforeEach(() => {
    puzzle = parseSudokuLines(EASY);
    game = new Game(puzzle);
    topLeft = puzzle.getGrid().getCellFromSquareGrid(0, 0); // candidates 4 and 7
    given = puzzle.getGrid().getCellFromSquareGrid(1, 0);
  });

  it('toggles a note', () => {
    const state = puzzle.saveState();
    game.toggleNote(topLeft, 4);
    game.toggleNote(topLeft, 1); // any value of the puzzle, not only candidates
    expect(notes(game, topLeft)).toEqual([1, 4]);
    game.toggleNote(topLeft, 4);
    expect(notes(game, topLeft)).toEqual([1]);
    game.toggleNote(topLeft, 1);
    expect(notes(game, topLeft)).toEqual([]);
    expect(game.notes.has(topLeft)).toBe(false);
    // notes do not touch the puzzle model
    expect(puzzle.saveState()).toEqual(state);
  });

  it('undoes notes', () => {
    game.toggleNote(topLeft, 4);
    game.toggleNote(topLeft, 7);
    expect(game.undo()).toBe(true);
    expect(notes(game, topLeft)).toEqual([4]);
    expect(game.redo()).toBe(true);
    expect(notes(game, topLeft)).toEqual([4, 7]);
  });

  it('refuses notes in a given or filled cell', () => {
    expect(() => game.toggleNote(given, 4)).toThrow(EntryError);
    expect(() => game.toggleNote(topLeft, 0)).toThrow(EntryError); // not a value of a sudoku
    game.enter(topLeft, 4);
    expect(() => game.toggleNote(topLeft, 7)).toThrow(EntryError);
    game.undo();
    expect(game.canUndo()).toBe(false); // the rejected notes were not recorded
  });

  it('keeps the notes while the cell has a value', () => {
    game.toggleNote(topLeft, 7);
    game.enter(topLeft, 4);
    game.clear(topLeft);
    expect(notes(game, topLeft)).toEqual([7]);
  });
});

describe('check', () => {
  let puzzle: Puzzle;
  let game: Game;
  let solution: PuzzleState;
  let correct: Map<Cell, number | null>;
  let topLeft: Cell;
  let right: number;
  let wrong: number;

  beforeEach(() => {
    puzzle = parseSudokuLines(EASY);
    game = new Game(puzzle);
    const found = new Solver(puzzle).findSolution();
    expect(found.unique).toBe(true);
    solution = found.solution;
    const cells = puzzle.getGrid().getCells();
    correct = new Map(cells.map((c, i) => [c, solution.cells[i]?.value ?? null]));
    topLeft = puzzle.getGrid().getCellFromSquareGrid(0, 0); // candidates 4 and 7
    right = correct.get(topLeft) as number;
    wrong = right === 4 ? 7 : 4;
  });

  it('reports when nothing is filled in', () => {
    const result = game.check(solution);
    expect(result.checked).toBe(0);
    expect(result.isAllCorrect()).toBe(true);
    expect(result.summary()).toContain('Nothing is filled in');
  });

  it('accepts correct entries', () => {
    game.enter(topLeft, right);
    const result = game.check(solution);
    expect(result.checked).toBe(1);
    expect(result.isAllCorrect()).toBe(true);
    expect(result.summary()).toContain('All 1 filled-in cells are correct');
  });

  it('finds a wrong entry that fits the rules', () => {
    game.enter(topLeft, wrong);
    expect(game.violations().has(topLeft)).toBe(false); // no rule says it is wrong
    const result = game.check(solution);
    expect(result.wrongValues).toEqual(new Set([topLeft]));
    expect(result.summary()).toContain('1 of 1 filled-in cells are wrong');
  });

  it('counts a mistake as wrong', () => {
    game.enter(topLeft, 6); // the 6 is already in the row
    expect(game.isMistake(topLeft)).toBe(true);
    expect(game.check(solution).wrongValues).toEqual(new Set([topLeft]));
  });

  it('finds notes without the correct value', () => {
    game.toggleNote(topLeft, wrong);
    const other = puzzle.getGrid().getCellFromSquareGrid(3, 0);
    game.toggleNote(other, correct.get(other) as number);
    const result = game.check(solution);
    expect(result.wrongNotes).toEqual(new Set([topLeft]));
    expect(result.wrongValues).toEqual(new Set());
    expect(result.summary()).toContain('the notes of 1 cell rules out the correct value');
  });
});

describe('guessed values', () => {
  it('are marked by the solver', () => {
    const puzzle = loadExample('sudoku', 'hardSudoku.txt');
    expect(new Game(puzzle).solve(new Solver(puzzle, true))).toBe(true);
    const sources = new Set(
      puzzle
        .getGrid()
        .getCells()
        .map((c) => c.getSource()),
    );
    expect(sources.has(ValueSource.GUESSED)).toBe(true);
    expect(sources.has(ValueSource.GIVEN)).toBe(true);
    const guessed = puzzle
      .getGrid()
      .getCells()
      .filter((c) => c.isGuessed());
    expect(guessed.every((c) => c.isInferred() && !c.isGiven())).toBe(true);
  });
});
