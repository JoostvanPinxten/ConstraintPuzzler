/**
 * The registry of puzzle types: one place that describes each type the app supports.
 *
 * The example files are named here; reading them is up to the caller (the app bundles them,
 * the tests read them from the repository), so this package stays free of platform APIs.
 */
import { parseFutoshikiLines } from './parsers/futoshiki';
import { parseKakuroLines } from './parsers/kakuro';
import { splitLines } from './parsers/common';
import { parseSudokuLines } from './parsers/sudoku';
import { parseSumbreroLines } from './parsers/sumbrero';
import type { Puzzle } from './structure/puzzle';

export type PuzzleTypeName = 'sudoku' | 'kakuro' | 'futoshiki' | 'sumbrero';

export interface PuzzleType {
  /** identifier, e.g. in links and as the registry key */
  readonly name: PuzzleTypeName;
  /** shown to the user, e.g. in menus and titles */
  readonly label: string;
  /** reads the lines of a puzzle file into a Puzzle */
  readonly parseLines: (lines: readonly string[], filename?: string) => Puzzle;
  /** the file name extensions of this type's files (for open-file dialogs) */
  readonly fileExtensions: readonly string[];
  /** the bundled example puzzles: label -> file name (in the puzzles folder), in menu order */
  readonly examples: Readonly<Record<string, string>>;
  /** the example that is opened when no file is given */
  readonly defaultExample: string;
}

/** Check a puzzle type definition (its default example must be listed) and return it. */
export function definePuzzleType(type: PuzzleType): PuzzleType {
  if (!Object.hasOwn(type.examples, type.defaultExample)) {
    throw new Error(`${type.name}: default example '${type.defaultExample}' not listed`);
  }
  return type;
}

export const SUDOKU = definePuzzleType({
  name: 'sudoku',
  label: 'Sudoku',
  parseLines: (lines) => parseSudokuLines(lines),
  fileExtensions: ['txt', 'sud'],
  examples: { Easy: 'easySudoku.txt', Medium: 'mediumSudoku.txt', Hard: 'hardSudoku.txt' },
  defaultExample: 'Easy',
});

export const KAKURO = definePuzzleType({
  name: 'kakuro',
  label: 'Kakuro',
  parseLines: parseKakuroLines,
  fileExtensions: ['txt'],
  examples: { Simple: 'simpleKakuro.txt', Medium: 'mediumKakuro.txt' },
  defaultExample: 'Medium',
});

export const FUTOSHIKI = definePuzzleType({
  name: 'futoshiki',
  label: 'Futoshiki',
  parseLines: (lines) => parseFutoshikiLines(lines),
  fileExtensions: ['txt', 'fut'],
  examples: { '7x7': 'futoshiki.txt' },
  defaultExample: '7x7',
});

export const SUMBRERO = definePuzzleType({
  name: 'sumbrero',
  label: 'Sumbrero',
  parseLines: parseSumbreroLines,
  fileExtensions: ['txt'],
  examples: { Simple: 'simpleSumbrero.txt' },
  defaultExample: 'Simple',
});

/** name -> PuzzleType, in the order the app shows them */
export const PUZZLE_TYPES: Readonly<Record<PuzzleTypeName, PuzzleType>> = {
  sudoku: SUDOKU,
  kakuro: KAKURO,
  futoshiki: FUTOSHIKI,
  sumbrero: SUMBRERO,
};

/** Parse the contents of a puzzle file of the given type. */
export function parsePuzzle(type: PuzzleType, text: string, filename?: string): Puzzle {
  return type.parseLines(splitLines(text), filename);
}

/** All bundled example files of all puzzle types. */
export function exampleFiles(): string[] {
  return Object.values(PUZZLE_TYPES).flatMap((t) => Object.values(t.examples));
}
