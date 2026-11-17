// The puzzle-type registry: complete, consistent, and free of platform dependencies.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { definePuzzleType, exampleFiles, PUZZLE_TYPES, SUDOKU } from '../src/puzzletypes';
import { Puzzle } from '../src/structure/puzzle';
import { loadExample, REPO_ROOT } from './helpers';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('puzzle types', () => {
  it('are keyed by their names', () => {
    for (const [name, type] of Object.entries(PUZZLE_TYPES)) expect(type.name).toBe(name);
  });

  it.each(Object.values(PUZZLE_TYPES))('$name: every example parses', (type) => {
    expect(Object.keys(type.examples)).toContain(type.defaultExample);
    for (const file of Object.values(type.examples)) {
      const puzzle = loadExample(type.name, file);
      expect(puzzle).toBeInstanceOf(Puzzle);
      expect(puzzle.getGrid().getCells().length).toBeGreaterThan(0);
    }
  });

  it('have unique example files', () => {
    const files = exampleFiles();
    expect(new Set(files).size).toBe(files.length);
  });

  it('must list their default example', () => {
    expect(() =>
      definePuzzleType({ ...SUDOKU, examples: { a: 'a.txt' }, defaultExample: 'b' }),
    ).toThrow(/not listed/);
  });

  it('keep the engine free of platform imports (only relative imports in src)', () => {
    const imports = /(?:^|\n)\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g;
    for (const file of sourceFiles(join(REPO_ROOT, 'packages', 'core', 'src'))) {
      for (const match of readFileSync(file, 'utf-8').matchAll(imports)) {
        expect(match[1], `${file} imports ${match[1]}`).toMatch(/^\.\.?\//);
      }
    }
  });
});
