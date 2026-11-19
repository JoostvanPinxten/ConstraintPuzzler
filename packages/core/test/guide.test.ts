// The rules and techniques explained for players: every puzzle type has a guide, and every
// technique it names is explained, and every deduction of the engine names a technique the
// guide of its puzzle type explains.
import { describe, expect, it } from 'vitest';

import { TECHNIQUE_GUIDE, type TechniqueId } from '../src/guide/techniques';
import { NONOGRAM, PUZZLE_TYPES, SUDOKU, type PuzzleType } from '../src/puzzletypes';
import { HintSession } from '../src/solver/hints';
import { Solver } from '../src/solver/solver';
import { ValueSource, type Cell } from '../src/structure/cell';
import { Deduction } from '../src/structure/deduction';
import { XWing } from '../src/techniques/fish';
import { loadExample } from './helpers';

const TYPES = Object.values(PUZZLE_TYPES);

describe('technique guide', () => {
  it('is keyed by the technique ids', () => {
    for (const [id, entry] of Object.entries(TECHNIQUE_GUIDE)) expect(entry.id).toBe(id);
  });

  it.each(Object.values(TECHNIQUE_GUIDE))('$id: has a name, summary and steps', (entry) => {
    expect(entry.name).not.toBe('');
    expect(entry.summary).not.toBe('');
    expect(entry.steps.length).toBeGreaterThan(0);
  });

  it('lists every technique for some puzzle type', () => {
    const used = new Set<TechniqueId>(TYPES.flatMap((t) => t.guide.techniques));
    expect([...used].sort()).toEqual(Object.keys(TECHNIQUE_GUIDE).sort());
  });
});

describe('puzzle guides', () => {
  it.each(TYPES)('$name: has a goal, rules and known techniques', (type) => {
    const { goal, rules, techniques } = type.guide;
    expect(goal).not.toBe('');
    expect(rules.length).toBeGreaterThan(0);
    expect(techniques.length).toBeGreaterThan(0);
    expect(new Set(techniques).size).toBe(techniques.length);
    for (const id of techniques) expect(TECHNIQUE_GUIDE[id]).toBeDefined();
  });
});

describe('the technique behind every deduction', () => {
  const examples = TYPES.flatMap((type) =>
    Object.entries(type.examples).map(([label, file]) => ({ type, label, file })),
  );

  /** The technique ids of the deductions made while solving (with guessing). */
  function solvedWith(type: PuzzleType, file: string): Set<TechniqueId | null> {
    const solver = new Solver(loadExample(type.name, file), true);
    expect(solver.solve()).toBe(true);
    return new Set(solver.log.deductions.map((d) => d.techniqueId()));
  }

  it.each(examples)('$type.name/$label: solving only uses techniques of its guide', (example) => {
    const ids = solvedWith(example.type, example.file);
    expect(ids).not.toContain(null);
    for (const id of ids) expect(example.type.guide.techniques).toContain(id);
  });

  it.each(examples)('$type.name/$label: every hint names a technique of its guide', (example) => {
    const solver = new Solver(loadExample(example.type.name, example.file));
    const hints = new HintSession();
    for (let step = 0; step < 500; step++) {
      const hint = hints.advance(solver);
      if (hint === null) break;
      const id = hints.techniqueId();
      expect(id).not.toBeNull();
      expect(example.type.guide.techniques).toContain(id);
      if (!solver.solveStep(hint)) break;
      hints.reset();
    }
  });

  it('tells the techniques of the Sudoku examples apart', () => {
    const ids = new Set(
      Object.values(SUDOKU.examples).flatMap((file) => [...solvedWith(SUDOKU, file)]),
    );
    for (const id of ['nakedSingle', 'hiddenSingle', 'elimination', 'nakedSubset'] as const) {
      expect(ids).toContain(id);
    }
  });

  it('names the nonogram line techniques', () => {
    const ids = new Set(
      Object.values(NONOGRAM.examples).flatMap((file) => [...solvedWith(NONOGRAM, file)]),
    );
    expect(ids).toContain('overlap');
    expect(ids).toContain('wholeLine');
  });

  it('names the technique of a finding and of a guess', () => {
    const technique = new XWing(loadExample('sudoku', 'easySudoku.txt'));
    expect(technique.techniqueId()).toBe('xWing');
    const cell = loadExample('sudoku', 'easySudoku.txt').getGrid().getCells()[0] as Cell;
    expect(new Deduction(cell, new Set(), 1, ValueSource.GUESSED).techniqueId()).toBe('guess');
    expect(new Deduction(cell, new Set(), 1, ValueSource.DEDUCED).techniqueId()).toBe(
      'nakedSingle',
    );
    expect(new Deduction(cell, new Set([1])).techniqueId()).toBeNull();
  });
});
