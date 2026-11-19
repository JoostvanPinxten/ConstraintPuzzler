// The TypeScript engine against the Python engine: tools/export_fixtures.py recorded what the
// Python code makes of every example puzzle; the port must reach the same conclusions.
import { describe, expect, it } from 'vitest';

import { PositionedCell, ValueSource } from '../src/structure/cell';
import { DeductionLog } from '../src/structure/deduction';
import { TotalSumValueConstraint } from '../src/constraints/totalsumvalueconstraint';
import { Solver } from '../src/solver/solver';
import { exampleFiles } from '../src/puzzletypes';
import { loadExample, loadFixtures } from './helpers';

const fixtures = loadFixtures();
/** examples of puzzle types added after the Python engine, so without a fixture */
const NEWER_THAN_PYTHON = ['jidoku.txt'];

describe('golden fixtures from the Python engine', () => {
  it('cover every registered example of the Python era', () => {
    const examples = exampleFiles().filter((f) => !NEWER_THAN_PYTHON.includes(f));
    expect(fixtures.map((f) => f.file).sort()).toEqual(examples.sort());
  });

  describe.each(fixtures.map((f) => [f.file, f] as const))('%s', (_file, fixture) => {
    it('parses into the same structure', () => {
      const puzzle = loadExample(fixture.type, fixture.file);
      const cells = puzzle.getGrid().getCells();
      const structure = {
        values: puzzle.getValues(),
        cells: cells.map((c) => ({
          position: c instanceof PositionedCell ? [c.getPosition().x(), c.getPosition().y()] : null,
          given: c.getValue(),
        })),
        groups: puzzle.getConstraintGroups().map((g) => ({
          name: g.getName(),
          cells: g.getCells().map((c) => cells.indexOf(c)),
          constraints: g.getConstraints().map((k) => ({
            type: k.getType(),
            ...(k instanceof TotalSumValueConstraint ? { total: k.getTotalValue() } : {}),
          })),
        })),
      };
      expect(structure).toEqual(fixture.structure);
    });

    it('determines the same values in one deduction pass', () => {
      // a whole pass, as the Python engine's hint() used (hints now only offer the values
      // that follow directly from the current state, see directhints.test.ts)
      const puzzle = loadExample(fixture.type, fixture.file);
      const cells = puzzle.getGrid().getCells();
      const log = new DeductionLog();
      puzzle.recording(log, () => new Solver(puzzle).step());
      const deduced = log.deductions.filter(
        (d) => d.setsValue() && d.source === ValueSource.DEDUCED,
      );
      const rows = new Map<string, (typeof fixture.firstPass)[number]>();
      for (const d of deduced) {
        const row = {
          cell: cells.indexOf(d.cell),
          value: d.value as number,
          difficulty: d.difficulty(),
          cause: d.cause?.getType() ?? null,
        };
        rows.set(JSON.stringify(row), row);
      }
      const sorted = [...rows.values()].sort(
        (a, b) =>
          a.cell - b.cell ||
          a.value - b.value ||
          a.difficulty - b.difficulty ||
          (a.cause ?? '').localeCompare(b.cause ?? ''),
      );
      expect(sorted).toEqual(fixture.firstPass);
    });

    it('propagates to the same fixpoint without guessing', () => {
      const puzzle = loadExample(fixture.type, fixture.file);
      const solved = new Solver(puzzle).solve();
      expect(fixture.propagated).not.toBeNull();
      expect({
        solved,
        cells: puzzle
          .saveState()
          .cells.map((c) => ({ value: c.value, candidates: [...c.candidates] })),
      }).toEqual(fixture.propagated);
    });

    it('finds the same solution', () => {
      const puzzle = loadExample(fixture.type, fixture.file);
      const before = puzzle.saveState();
      const { solution, unique } = new Solver(puzzle).findSolution();
      expect(puzzle.saveState()).toEqual(before);
      expect({ unique, values: solution.cells.map((c) => c.value) }).toEqual(fixture.solution);
    });
  });
});
