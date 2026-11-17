import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePuzzle, PUZZLE_TYPES, type PuzzleTypeName } from '../src/puzzletypes';
import type { Puzzle } from '../src/structure/puzzle';

const here = dirname(fileURLToPath(import.meta.url));
/** The repository root (the example puzzle files are in its puzzles/ folder). */
export const REPO_ROOT = resolve(here, '..', '..', '..');
export const FIXTURES = resolve(here, '..', 'fixtures');

export function readExample(filename: string): string {
  return readFileSync(join(REPO_ROOT, 'puzzles', filename), 'utf-8');
}

export function loadExample(type: PuzzleTypeName, filename: string): Puzzle {
  return parsePuzzle(PUZZLE_TYPES[type], readExample(filename), filename);
}

export interface Fixture {
  type: PuzzleTypeName;
  example: string;
  file: string;
  structure: {
    values: number[];
    cells: { position: [number, number] | null; given: number | null }[];
    groups: { name: string; cells: number[]; constraints: { type: string; total?: number }[] }[];
  };
  firstPass: { cell: number; value: number; difficulty: number; cause: string | null }[];
  propagated: { solved: boolean; cells: { value: number | null; candidates: number[] }[] } | null;
  solution: { unique: boolean; values: (number | null)[] };
}

/** An easy sudoku (easySudoku.txt), one row per line. */
export const EASY = `\
- 6 9 - - - - - 2
8 2 - 3 6 - - 9 -
3 - - - 9 - - - 1
- - - 4 - - - 5 -
- 5 2 1 - 3 - - 6
1 - 4 - - 6 - 7 3
5 - 7 6 - - - - 8
- - 3 - - 1 5 6 -
- - - 5 3 2 - - -`.split('\n');

/** Every registered example: [name, a function that loads a fresh copy]. */
export function allExamples(): [string, () => Puzzle][] {
  return Object.values(PUZZLE_TYPES).flatMap((type) =>
    Object.entries(type.examples).map(
      ([label, file]) =>
        [`${type.name}/${label}`, () => loadExample(type.name, file)] as [string, () => Puzzle],
    ),
  );
}

/** A seeded pseudo-random generator (mulberry32), to replace Math.random in tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf-8')) as Fixture);
}
