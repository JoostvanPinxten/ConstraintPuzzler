// Errors a player can see (a puzzle file that cannot be read, a value that cannot be entered, a
// contradiction) carry a message, in English as before and in every language.
import { describe, expect, it } from 'vitest';

import {
  CORE_RESOURCES,
  formatMessage,
  interpolate,
  lookup,
  type Translate,
} from '../../src/i18n/message';
import { PuzzleFileError } from '../../src/parsers/common';
import { parseSudokuLines } from '../../src/parsers/sudoku';
import { parsePuzzle, PUZZLE_TYPES } from '../../src/puzzletypes';
import { EntryError } from '../../src/structure/entries';
import { ContradictionError, errorText, MessageError } from '../../src/structure/errors';
import { Game } from '../../src/structure/game';
import { EASY } from '../helpers';

const dutch: Translate = (key, params) =>
  interpolate(lookup(CORE_RESOURCES.nl, 'nl', key, params) ?? key, params);

function fileError(type: keyof typeof PUZZLE_TYPES, text: string): PuzzleFileError {
  try {
    parsePuzzle(PUZZLE_TYPES[type], text, 'test.txt');
  } catch (error) {
    if (error instanceof PuzzleFileError) return error;
    throw error;
  }
  throw new Error('no error');
}

describe('errors for players', () => {
  it('name the file and line, in English and in Dutch', () => {
    const error = fileError('kakuro', 'range = 1,9\ncell(1,1)\ncell(1,1)\n');
    expect(error.message).toBe(
      'test.txt, line 3: cell Position(1, 1) is declared twice (cell(1,1))',
    );
    expect(formatMessage(error.text, dutch)).toBe(
      'test.txt, regel 3: vakje Position(1, 1) is twee keer gedeclareerd (cell(1,1))',
    );
  });

  it('translate the errors of the shared parse helpers', () => {
    const error = fileError('kakuro', 'range = 9,1\n');
    expect(error.message).toBe('test.txt, line 1: range 9,1 is empty (range = 9,1)');
    expect(formatMessage(error.text, dutch)).toMatch(/^test\.txt, regel 1: bereik 9,1 is leeg/);
  });

  it('translate why a value cannot be entered', () => {
    const game = new Game(parseSudokuLines(EASY));
    const given = game.puzzle
      .getGrid()
      .getCells()
      .find((c) => c.isGiven());
    if (given === undefined) throw new Error('the example has no given cell');
    let caught: unknown = null;
    try {
      game.enter(given, 5);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EntryError);
    expect(formatMessage(errorText(caught), dutch)).toMatch(/^Vakje \d+, \d+ is gegeven;/);
  });

  it('keep other errors and plain texts as they are', () => {
    expect(formatMessage(errorText(new Error('boom')), dutch)).toBe('boom');
    expect(formatMessage(errorText('text'), dutch)).toBe('text');
    const contradiction = new ContradictionError('as it was');
    expect(contradiction).toBeInstanceOf(MessageError);
    expect(contradiction.message).toBe('as it was');
    expect(contradiction.name).toBe('ContradictionError');
  });
});
