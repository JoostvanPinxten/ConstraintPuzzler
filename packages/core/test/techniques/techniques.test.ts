// Techniques that combine several constraint groups: intersection removal and fish (X-Wing, ...).
import { describe, expect, it } from 'vitest';

import { parseSudokuLines } from '../../src/parsers/sudoku';
import { createEmptySudoku, createFutoshikiPuzzle } from '../../src/puzzlefactory';
import { Solver } from '../../src/solver/solver';
import type { Cell } from '../../src/structure/cell';
import { Deduction, DeductionLog } from '../../src/structure/deduction';
import { ContradictionError } from '../../src/structure/errors';
import type { Puzzle } from '../../src/structure/puzzle';
import { Jellyfish, Swordfish, XWing } from '../../src/techniques/fish';
import { IntersectionRemoval } from '../../src/techniques/intersection';
import { Technique, type Finding } from '../../src/techniques/technique';
import { TECHNIQUES } from '../../src/techniques/techniques';
import { allExamples } from '../helpers';

/** One-line sudokus ('.' for an empty cell), as the puzzle files expect them. */
function sudoku(line: string): Puzzle {
  const rows = Array.from({ length: 9 }, (_, r) =>
    [...line.slice(r * 9, r * 9 + 9)].map((ch) => (ch === '.' ? '-' : ch)).join(' '),
  );
  return parseSudokuLines(rows);
}

// solvable with intersections and an X-Wing, not with the constraints alone
const XWING_SAMPLE =
  '1.....569492.561.8.561.924...964.8.1.64.1....218.356.4.4.5...169.5.614.2621.....5';
// needs a Swordfish (and intersections) to get further than the constraints alone
const SWORDFISH_SAMPLE =
  '52941.7.3..6..3..2..32......523...76637.5.2..19.62753.3...6942.2..83.6..96.7423.';

/** The cell at column x, row y (both from 1), as the puzzle shows it. */
function at(puzzle: Puzzle, x: number, y: number): Cell {
  return puzzle.getGrid().getCellFromSquareGrid(x - 1, y - 1);
}

/** In an empty sudoku: leave `value` in row y only at the given columns. */
function onlyInRow(puzzle: Puzzle, value: number, y: number, columns: number[]): void {
  for (let x = 1; x <= 9; x++) if (!columns.includes(x)) at(puzzle, x, y).remove(value);
}

/** Apply a technique once, recording what it changes. */
function applyOnce(puzzle: Puzzle, technique: Technique): { changed: boolean; log: DeductionLog } {
  const log = new DeductionLog();
  const changed = puzzle.recording(log, () => puzzle.causedBy(technique, () => technique.apply()));
  return { changed, log };
}

/** The (column, row) of the cells that lost `value`, sorted. */
function removedFrom(log: DeductionLog, value: number): string[] {
  return log.deductions
    .filter((d) => d.removed.has(value))
    .map((d) => d.cell.getName())
    .sort();
}

describe('IntersectionRemoval', () => {
  it('removes a value from a row when a block holds it only in that row (pointing)', () => {
    const puzzle = createEmptySudoku();
    // block 1 holds 7 only at (1, 1) and (2, 1)
    for (const [x, y] of [
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ] as const) {
      at(puzzle, x, y).remove(7);
    }
    const technique = new IntersectionRemoval(puzzle);
    const { changed, log } = applyOnce(puzzle, technique);
    expect(changed).toBe(true);
    expect(removedFrom(log, 7)).toEqual(['4, 1', '5, 1', '6, 1', '7, 1', '8, 1', '9, 1']);
    const reason = (log.deductions[0] as Deduction).reason();
    expect(reason).toContain('Block 1 can only hold 7 in 1, 1; 2, 1');
    expect(reason).toContain('no other cell of Row 1');
  });

  it('removes a value from a block when a row holds it only in that block (claiming)', () => {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 4, 5, [4, 6]);
    const { changed, log } = applyOnce(puzzle, new IntersectionRemoval(puzzle));
    expect(changed).toBe(true);
    expect(removedFrom(log, 4)).toEqual(['4, 4', '4, 6', '5, 4', '5, 6', '6, 4', '6, 6']);
  });

  it('does nothing on an empty sudoku', () => {
    const puzzle = createEmptySudoku();
    expect(applyOnce(puzzle, new IntersectionRemoval(puzzle)).changed).toBe(false);
  });
});

describe('fish', () => {
  it('finds an X-Wing and removes the value from the rest of its columns', () => {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 7, 2, [4, 8]);
    onlyInRow(puzzle, 7, 6, [4, 8]);
    const { changed, log } = applyOnce(puzzle, new XWing(puzzle));
    expect(changed).toBe(true);
    const expected = [1, 3, 4, 5, 7, 8, 9].flatMap((y) => [`4, ${y}`, `8, ${y}`]).sort();
    expect(removedFrom(log, 7)).toEqual(expected);
    expect((log.deductions[0] as Deduction).reason()).toBe(
      'X-Wing on 7: Row 2 and Row 6 can only hold 7 in cells of Column 4 and Column 8; each of' +
        ' those gets its 7 there, so no other cell of Column 4 and Column 8 can hold 7',
    );
    expect((log.deductions[0] as Deduction).difficulty()).toBe(XWing.difficulty);
  });

  it('finds an X-Wing on columns too', () => {
    const puzzle = createEmptySudoku();
    for (const x of [3, 9]) {
      for (let y = 1; y <= 9; y++) if (y !== 2 && y !== 7) at(puzzle, x, y).remove(5);
    }
    const { log } = applyOnce(puzzle, new XWing(puzzle));
    expect(removedFrom(log, 5)).toHaveLength(14);
    expect(removedFrom(log, 5).every((name) => /, [27]$/.test(name))).toBe(true);
  });

  it('finds a Swordfish that no X-Wing explains', () => {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 8, 1, [2, 5]);
    onlyInRow(puzzle, 8, 5, [5, 8]);
    onlyInRow(puzzle, 8, 9, [2, 8]);
    expect(applyOnce(puzzle, new XWing(puzzle)).changed).toBe(false);
    const { changed, log } = applyOnce(puzzle, new Swordfish(puzzle));
    expect(changed).toBe(true);
    expect(removedFrom(log, 8)).toHaveLength(18); // 6 other rows x 3 columns
    expect((log.deductions[0] as Deduction).reason()).toContain(
      'Row 1, Row 5 and Row 9 can only hold 8 in cells of Column 2, Column 5 and Column 8',
    );
  });

  it('finds a Jellyfish that no smaller fish explains', () => {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 2, 1, [1, 4]);
    onlyInRow(puzzle, 2, 3, [4, 6]);
    onlyInRow(puzzle, 2, 5, [6, 9]);
    onlyInRow(puzzle, 2, 7, [9, 1]);
    expect(applyOnce(puzzle, new XWing(puzzle)).changed).toBe(false);
    expect(applyOnce(puzzle, new Swordfish(puzzle)).changed).toBe(false);
    const { changed, log } = applyOnce(puzzle, new Jellyfish(puzzle));
    expect(changed).toBe(true);
    expect(removedFrom(log, 2)).toHaveLength(20); // 5 other rows x 4 columns
  });

  it('does not take rows and blocks for crossing lines', () => {
    const puzzle = createEmptySudoku();
    // rows 1 and 2 hold 3 only in block 1: an intersection, but no fish
    onlyInRow(puzzle, 3, 1, [1, 2, 3]);
    onlyInRow(puzzle, 3, 2, [1, 2, 3]);
    for (const technique of [new XWing(puzzle), new Swordfish(puzzle)]) {
      expect(applyOnce(puzzle, technique).changed).toBe(false);
    }
  });

  it('works on other grids of exact cover lines (Futoshiki)', () => {
    const puzzle = createFutoshikiPuzzle(5);
    for (const y of [1, 4]) {
      for (let x = 1; x <= 5; x++) if (x !== 2 && x !== 5) at(puzzle, x, y).remove(3);
    }
    const { log } = applyOnce(puzzle, new XWing(puzzle));
    expect(removedFrom(log, 3)).toEqual(['2, 2', '2, 3', '2, 5', '5, 2', '5, 3', '5, 5']);
  });

  it('throws a ContradictionError when a removal leaves a cell without candidates', () => {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 7, 2, [4, 8]);
    onlyInRow(puzzle, 7, 6, [4, 8]);
    const cell = at(puzzle, 4, 9);
    for (let v = 1; v <= 9; v++) if (v !== 7) cell.remove(v);
    expect(() => new XWing(puzzle).apply()).toThrow(ContradictionError);
  });
});

describe('the solver with techniques', () => {
  it('tries the techniques easiest first', () => {
    const solver = new Solver(createEmptySudoku());
    const difficulties = solver.techniques.map((t) => t.getDifficulty());
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
    expect(solver.techniques.map((t) => t.getType())).toEqual([
      'Intersection removal',
      'X-Wing',
      'Swordfish',
      'Jellyfish',
    ]);
    expect(TECHNIQUES).toHaveLength(4);
  });

  it('solves an X-Wing puzzle without guessing, which the constraints alone cannot', () => {
    const plain = sudoku(XWING_SAMPLE);
    expect(new Solver(plain, false, []).solve()).toBe(false);

    const puzzle = sudoku(XWING_SAMPLE);
    const solver = new Solver(puzzle);
    expect(solver.solve()).toBe(true);
    const types = new Set(
      solver.log.deductions.map((d) => (d.cause instanceof Technique ? d.cause.getType() : null)),
    );
    expect(types).toContain('X-Wing');
    expect(types).toContain('Intersection removal');
  });

  it('gets further on a Swordfish puzzle', () => {
    const plain = sudoku(SWORDFISH_SAMPLE);
    new Solver(plain, false, []).propagate();
    const puzzle = sudoku(SWORDFISH_SAMPLE);
    const solver = new Solver(puzzle);
    solver.propagate();
    expect(puzzle.getNumberOfOpenCells()).toBeLessThan(plain.getNumberOfOpenCells());
    expect(solver.log.deductions.some((d) => d.cause instanceof Swordfish)).toBe(true);
  });

  it('never removes a value of the solution', () => {
    const cases: [string, () => Puzzle][] = [
      ...allExamples(),
      ['X-Wing sample', () => sudoku(XWING_SAMPLE)],
      ['Swordfish sample', () => sudoku(SWORDFISH_SAMPLE)],
    ];
    for (const [name, load] of cases) {
      const puzzle = load();
      const { solution } = new Solver(load(), false, []).findSolution();
      new Solver(puzzle).propagate();
      puzzle
        .getGrid()
        .getCells()
        .forEach((cell, i) => {
          const value = solution.cells[i]?.value;
          expect(value != null && cell.values.has(value), `${name}, ${cell.getName()}`).toBe(true);
        });
    }
  });

  it('finds the same solution as the constraints alone (with guessing)', () => {
    const inkala =
      '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..';
    const values = (solver: Solver): unknown => {
      const { solution, unique } = solver.findSolution();
      return { unique, values: solution.cells.map((c) => c.value) };
    };
    const expected = values(new Solver(sudoku(inkala), true, []));
    expect(expected).toMatchObject({ unique: true });
    expect(values(new Solver(sudoku(inkala), true))).toEqual(expected);
  });

  it('narrows the candidates with a technique when a step finds nothing else', () => {
    const puzzle = sudoku(XWING_SAMPLE);
    const solver = new Solver(puzzle);
    solver.random = () => 0;
    const causes = new Set<string>();
    for (let i = 0; i < 200 && !puzzle.isSolved(); i++) {
      expect(solver.solveStep()).toBe(true);
      if (solver.lastStep === null) {
        for (const d of solver.log.deductions) {
          if (d.cause instanceof Technique) causes.add(d.cause.getType());
          expect(d.setsValue()).toBe(false);
          expect(d.reason()).not.toBe('removed');
        }
      }
    }
    expect(puzzle.isSolved()).toBe(true);
    expect(causes).toContain('X-Wing');
  });
});

describe('findings', () => {
  /** An empty sudoku with an X-Wing on 7 in rows 2 and 6, columns 4 and 8. */
  function xWingGrid(): Puzzle {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 7, 2, [4, 8]);
    onlyInRow(puzzle, 7, 6, [4, 8]);
    return puzzle;
  }

  it('describe the pattern as data, without changing the puzzle', () => {
    const puzzle = xWingGrid();
    const before = puzzle.saveState();
    const technique = new XWing(puzzle);
    const finding = technique.find() as Finding;
    expect(puzzle.saveState()).toEqual(before);
    expect(finding.technique).toBe(technique);
    expect(finding.value).toBe(7);
    expect(finding.groups.map((g) => g.getName())).toEqual(['Row 2', 'Row 6']);
    expect(finding.cover.map((g) => g.getName())).toEqual(['Column 4', 'Column 8']);
    expect(finding.pattern.map((c) => c.getName())).toEqual(['4, 2', '8, 2', '4, 6', '8, 6']);
    expect(finding.targets).toHaveLength(14);
    expect(finding.reason).toMatch(/^X-Wing on 7: Row 2 and Row 6/);
  });

  it('describe an intersection with the group to look at and the group that loses the value', () => {
    const puzzle = createEmptySudoku();
    onlyInRow(puzzle, 4, 5, [4, 6]);
    const finding = new IntersectionRemoval(puzzle).find() as Finding;
    expect(finding.groups.map((g) => g.getName())).toEqual(['Row 5']);
    expect(finding.cover.map((g) => g.getName())).toEqual(['Block 5']);
    expect(finding.pattern.map((c) => c.getName())).toEqual(['4, 5', '6, 5']);
  });

  it('can be looked up from the deductions they made', () => {
    const puzzle = xWingGrid();
    const technique = new XWing(puzzle);
    const finding = technique.find() as Finding;
    const log = new DeductionLog();
    puzzle.recording(log, () => puzzle.causedBy(technique, () => technique.applyFinding(finding)));
    expect(log.deductions).toHaveLength(14);
    for (const d of log.deductions) {
      expect(technique.findingFor(d)).toBe(finding);
      expect(d.reason()).toBe(finding.reason);
    }
    // a deduction the technique did not make has no finding
    const other = new Deduction(at(puzzle, 1, 1), new Set([7]));
    expect(technique.findingFor(other)).toBeNull();
    expect(technique.explain(other)).toBe('X-Wing');
  });

  it('know whether they still apply', () => {
    const puzzle = xWingGrid();
    const technique = new XWing(puzzle);
    const finding = technique.find() as Finding;
    expect(technique.stillApplies(finding)).toBe(true);
    technique.applyFinding(finding);
    expect(technique.stillApplies(finding)).toBe(false); // nothing left to remove

    // a pattern cell lost the value since the finding was made
    const puzzle2 = xWingGrid();
    const technique2 = new XWing(puzzle2);
    const finding2 = technique2.find() as Finding;
    at(puzzle2, 4, 2).remove(7);
    expect(technique2.stillApplies(finding2)).toBe(false);
  });

  it('are offered by the solver without changing the puzzle, the easiest technique first', () => {
    const puzzle = xWingGrid();
    // also an intersection: block 1 holds 3 only in row 1
    for (const [x, y] of [
      [1, 2],
      [2, 2],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ] as const) {
      at(puzzle, x, y).remove(3);
    }
    const before = puzzle.saveState();
    const solver = new Solver(puzzle);
    const finding = solver.techniqueFinding() as Finding;
    expect(puzzle.saveState()).toEqual(before);
    expect(finding.technique).toBeInstanceOf(IntersectionRemoval);
    expect(new Solver(createEmptySudoku()).techniqueFinding()).toBeNull();
    expect(new Solver(puzzle, false, []).techniqueFinding()).toBeNull();
  });

  it('are applied by a step that is given one (e.g. the hint shown)', () => {
    const puzzle = sudoku(XWING_SAMPLE);
    const solver = new Solver(puzzle);
    // step until no value follows directly and a technique applies
    let finding: Finding | null = null;
    for (let i = 0; i < 100 && finding === null; i++) {
      if (solver.deducibleValues().length === 0) finding = solver.techniqueFinding();
      if (finding === null) solver.solveStep();
    }
    expect(finding).not.toBeNull();
    const chosen = finding as Finding;
    expect(solver.solveStep(chosen)).toBe(true);
    expect(solver.lastStep).toBeNull();
    expect(solver.log.deductions.length).toBeGreaterThan(0);
    for (const d of solver.log.deductions) {
      expect(d.cause).toBe(chosen.technique);
      expect(chosen.targets).toContain(d.cell);
      expect(d.removed).toEqual(new Set([chosen.value]));
    }
    // once applied, the finding no longer applies; a step then does something else
    expect(chosen.technique.stillApplies(chosen)).toBe(false);
  });
});
