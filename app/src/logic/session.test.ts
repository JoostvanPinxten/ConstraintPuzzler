// Playing a puzzle through a PuzzleSession: the behaviour of the desktop window layers
// (as the former PySide6 GUI smoke tests checked them), without rendering.
import {
  CELL,
  ExactCoverConstraint,
  PUZZLE_TYPES,
  REGION,
  VALUE,
  type Cell,
} from '@constraintpuzzler/core';

import { openExample, openText } from '../puzzles/open';
import { HighlightRole } from './highlight';
import { DEFAULT_SETTINGS, PuzzleSession } from './session';

const EASY = (): PuzzleSession => openExample('sudoku', 'Easy');
const cellAt = (session: PuzzleSession, x: number, y: number): Cell =>
  session.puzzle.getGrid().getCellFromSquareGrid(x, y);

describe('opening', () => {
  it.each(
    Object.values(PUZZLE_TYPES).flatMap((t) =>
      Object.keys(t.examples).map((label) => [t.name, label] as const),
    ),
  )('opens %s %s', (type, label) => {
    const session = openExample(type, label);
    expect(session.puzzle.getGrid().getCells().length).toBeGreaterThan(0);
    expect(session.title).toContain(label);
  });

  it('refuses a broken file', () => {
    expect(() => openText(PUZZLE_TYPES.kakuro, 'cell(1,1)\n', 'broken.txt')).toThrow(
      /broken.txt, line 1/,
    );
  });
});

describe('entering values', () => {
  it('selects a cell and enters, changes and clears a value', () => {
    const session = EASY();
    const topLeft = cellAt(session, 0, 0); // candidates 4 and 7
    session.selectCell(topLeft);
    expect(session.selectedCell()).toBe(topLeft);
    expect(session.pressKey('4')).toBe(true);
    expect(topLeft.getValue()).toBe(4);
    expect(topLeft.isEntered()).toBe(true);
    session.pressKey('7');
    expect(topLeft.getValue()).toBe(7);
    session.pressKey('Backspace');
    expect(topLeft.hasValue()).toBe(false);
    session.pressKey('7');
    session.pressKey('0'); // 0 is not a sudoku value: it clears
    expect(topLeft.hasValue()).toBe(false);
  });

  it('counts the open cells that are filled in', () => {
    const session = EASY();
    const start = session.progress();
    const givens = session.puzzle
      .getGrid()
      .getCells()
      .filter((c) => c.isGiven()).length;
    expect(start).toEqual({ filled: 0, total: 81 - givens });
    session.selectCell(cellAt(session, 0, 0));
    session.pressKey('4');
    expect(session.progress().filled).toBe(1);
    session.pressKey('Backspace');
    expect(session.progress().filled).toBe(0);
    session.selectCell(cellAt(session, 1, 0)); // given: not counted
    session.pressKey('3');
    expect(session.progress()).toEqual(start);
  });

  it('counts finishing the puzzle by typing or Step, not by Solve or undo/redo', async () => {
    const session = EASY();
    const solved = EASY();
    await solved.solve({ ...DEFAULT_SETTINGS, allowGuessing: true });
    const open = session.puzzle
      .getGrid()
      .getCells()
      .filter((c) => !c.hasValue());
    const last = open.pop() as Cell;
    const solutionOf = (cell: Cell) =>
      solved.puzzle.getGrid().getCells()[session.puzzle.getGrid().getCells().indexOf(cell)];
    for (const cell of open) {
      session.selectCell(cell);
      session.typeDigit(solutionOf(cell)?.getValue() as number);
    }
    expect(session.finishedCount).toBe(0);
    session.selectCell(last);
    session.typeDigit(solutionOf(last)?.getValue() as number);
    expect(session.finishedCount).toBe(1);
    expect(session.inputMessage).toBe('Solved!');

    session.undo();
    session.redo();
    expect(session.finishedCount).toBe(1);
    session.undo();
    session.solveStep();
    expect(session.puzzle.isSolved()).toBe(true);
    expect(session.finishedCount).toBe(2);

    const bySolve = EASY();
    await bySolve.solve(DEFAULT_SETTINGS);
    expect(bySolve.puzzle.isSolved()).toBe(true);
    expect(bySolve.finishedCount).toBe(0);
  });

  it('ignores keys without a selected cell', () => {
    const session = EASY();
    expect(session.pressKey('4')).toBe(false);
    expect(session.pressKey('x')).toBe(false);
  });

  it('cannot change given cells', () => {
    const session = EASY();
    const given = cellAt(session, 1, 0);
    session.selectCell(given);
    session.pressKey('3');
    expect(given.getValue()).toBe(6);
    expect(session.inputMessage).toMatch(/given/);
  });

  it('shows a mistake in red with the cells it clashes with', () => {
    const session = EASY();
    const topLeft = cellAt(session, 0, 0);
    session.selectCell(topLeft);
    session.pressKey('6'); // the given 6 is in the same row
    expect(session.game.isMistake(topLeft)).toBe(true);
    expect(session.violations()).toEqual(new Set([topLeft, cellAt(session, 1, 0)]));
    // the given 6 is cell 2, 1 (positions count from 1)
    expect(session.game.violationNote(topLeft, session.violations())).toContain('cell(s) 2, 1');
  });

  it('toggles notes in notes mode and with Ctrl', () => {
    const session = EASY();
    const topLeft = cellAt(session, 0, 0);
    session.selectCell(topLeft);
    session.pressKey('n');
    expect(session.notesMode).toBe(true);
    session.pressKey('4');
    session.pressKey('7');
    expect([...session.game.notesOf(topLeft)].sort()).toEqual([4, 7]);
    session.pressKey('4');
    expect([...session.game.notesOf(topLeft)]).toEqual([7]);
    session.pressKey('N');
    expect(session.notesMode).toBe(false);
    session.pressKey('4', true); // Ctrl+4
    expect([...session.game.notesOf(topLeft)].sort()).toEqual([4, 7]);
    expect(topLeft.hasValue()).toBe(false);
  });

  it('moves the selection with the arrow keys', () => {
    const session = EASY();
    session.pressKey('ArrowRight'); // nothing selected: the first cell
    expect(session.selectedCell()).toBe(cellAt(session, 0, 0));
    session.pressKey('ArrowRight');
    session.pressKey('ArrowDown');
    expect(session.selectedCell()).toBe(cellAt(session, 1, 1));
    session.pressKey('ArrowUp');
    session.pressKey('ArrowUp'); // at the edge: stays
    expect(session.selectedCell()).toBe(cellAt(session, 1, 0));
  });

  it('says when the puzzle is solved', () => {
    const session = openExample('kakuro', 'Simple');
    const solution = new Map(
      session.puzzle
        .getGrid()
        .getCells()
        .map((c, i) => [c, i] as const),
    );
    const found = session.solver.findSolution().solution;
    for (const [cell, i] of solution) {
      if (cell.isGiven()) continue;
      session.selectCell(cell);
      session.typeDigit(found.cells[i]?.value as number);
    }
    expect(session.inputMessage).toBe('Solved!');
  });

  it('undoes and redoes, and tells subscribers', () => {
    const session = EASY();
    let renders = 0;
    session.subscribe(() => renders++);
    const topLeft = cellAt(session, 0, 0);
    session.selectCell(topLeft);
    session.typeDigit(4);
    expect(session.canUndo()).toBe(true);
    session.undo();
    expect(topLeft.hasValue()).toBe(false);
    session.redo();
    expect(topLeft.getValue()).toBe(4);
    expect(renders).toBeGreaterThanOrEqual(4);
  });
});

describe('highlighting', () => {
  it('shows the cells a selected cell shares a group with', () => {
    const session = EASY();
    const cell = cellAt(session, 4, 4);
    session.selectCell(cell);
    const roles = session.highlight();
    expect(roles.get(cell)).toBe(HighlightRole.SELECTED);
    expect([...roles.values()].filter((r) => r === HighlightRole.PEER)).toHaveLength(20);
  });

  it('colours the open and solved cells of a group', () => {
    const session = EASY();
    const row = session.puzzle.getConstraintGroups().find((g) => g.getName() === 'Row 1');
    expect(row).toBeDefined();
    session.select({ kind: 'group', group: row! });
    const roles = session.highlight();
    for (const cell of row!.getCells()) {
      expect(roles.get(cell)).toBe(cell.hasValue() ? HighlightRole.SOLVED : HighlightRole.OPEN);
    }
  });
});

describe('hints', () => {
  it('reveals the region, then the cell, then the value', () => {
    const session = EASY();
    expect(session.hintLabel()).toBe('Hint');
    session.hint();
    expect(session.hints.level).toBe(REGION);
    expect(session.hintRegion.size).toBeGreaterThan(0);
    expect(session.selection).toBeNull();
    expect(session.hintLabel()).toBe('Hint: which cell?');
    expect(session.highlight().get([...session.hintRegion][0]!)).toBe(HighlightRole.HINT);

    session.hint();
    expect(session.hints.level).toBe(CELL);
    const deduction = session.hints.deduction!;
    expect(session.selectedCell()).toBe(deduction.cell);
    expect(session.stepMessage).toContain(deduction.cell.getName());
    expect(session.hintLabel()).toBe('Hint: show value');

    session.hint();
    expect(session.hints.level).toBe(VALUE);
    expect(session.stepMessage).toBe(`Hint: ${session.hints.message()}`);
    expect(session.stepMessage).toContain(deduction.describe());
    expect(deduction.cell.hasValue()).toBe(false); // nothing is filled in
  });

  it('shows the numbers that lead to an exact cover value with the value', () => {
    const session = EASY();
    const deduction = session.solver
      .deducibleValues()
      .find((d) => d.cause instanceof ExactCoverConstraint)!;
    // reveal this deduction: the cell first, then the value
    session.hint();
    session.hints.deduction = deduction;
    session.hints.level = CELL;
    expect(session.hintReasons.size).toBe(0);
    expect(session.hintRuledOut.size).toBe(0);
    expect(session.hintReasonGroups.size).toBe(0);
    session.hint();
    expect(session.hints.level).toBe(VALUE);
    expect(session.hintReasons.size).toBeGreaterThan(0);
    const roles = session.highlight();
    for (const reason of session.hintReasons) {
      expect(reason.getValue()).toBe(deduction.value);
      expect(roles.get(reason)).toBe(HighlightRole.REASON);
    }
    expect(session.hintRegion).toEqual(
      new Set((deduction.cause as ExactCoverConstraint).group.getCells()),
    );
    expect(roles.get(deduction.cell)).toBe(HighlightRole.SELECTED);
    // the other open cells of the region are marked as ruled out
    expect(session.hintRuledOut).toEqual(session.hints.ruledOutCells());
    expect(session.hintRuledOut.size).toBeGreaterThan(0);
    for (const cell of session.hintRuledOut) {
      expect(session.hintRegion.has(cell)).toBe(true);
      expect(cell.hasValue()).toBe(false);
    }
    expect(session.hintRuledOut.has(deduction.cell)).toBe(false);
    expect(session.hintReasonGroups).toEqual(session.hints.reasonGroups());
    expect(session.hintReasonGroups.size).toBeGreaterThan(0);
    // their cells are filled, except where a stronger role (the region, a number) shows
    for (const group of session.hintReasonGroups) {
      for (const cell of group.getCells()) {
        expect(roles.get(cell)).toBeGreaterThanOrEqual(HighlightRole.REASON_GROUP);
        if (!session.hintRegion.has(cell) && !session.hintReasons.has(cell)) {
          if (cell !== deduction.cell) expect(roles.get(cell)).toBe(HighlightRole.REASON_GROUP);
        }
      }
    }

    session.typeDigit(deduction.value!);
    expect(session.hintReasons.size).toBe(0);
    expect(session.hintRuledOut.size).toBe(0);
    expect(session.hintReasonGroups.size).toBe(0);
  });

  it('shows the numbers around the only candidate left in a cell with the value', () => {
    const session = EASY();
    const deduction = session.solver.deducibleValues().find((d) => d.cell.getName() === '5, 7')!;
    session.hint();
    session.hints.deduction = deduction;
    session.hints.level = CELL;
    session.hint();
    expect(session.hints.level).toBe(VALUE);
    expect(session.hintRuledOut.size).toBe(0);
    expect(session.hintRegion.size).toBe(0);
    expect([...session.hintReasonGroups].map((g) => g.getName()).sort()).toEqual([
      'Block 8',
      'Column 5',
      'Row 7',
    ]);
    const roles = session.highlight();
    expect(session.hintReasons.size).toBe(10); // 4 in row 7, 3 in column 5, 3 more in block 8
    expect(session.stepMessage).toContain(
      'Row 7 has 5, 7, 6 and 8; Column 5 has 6, 9 and 3; Block 8 also has 1, 5 and 2.',
    );
    for (const cell of session.hintReasons) expect(roles.get(cell)).toBe(HighlightRole.REASON);
    for (const group of session.hintReasonGroups) {
      for (const cell of group.getCells()) {
        if (!cell.hasValue() && cell !== deduction.cell) {
          expect(roles.get(cell)).toBe(HighlightRole.REASON_GROUP);
        }
      }
    }
  });

  it('forgets the hint when a value is entered', () => {
    const session = EASY();
    session.hint();
    session.hint();
    const cell = session.selectedCell()!;
    session.typeDigit(session.hints.deduction!.value!);
    expect(cell.isEntered()).toBe(true);
    expect(session.hints.deduction).toBeNull();
    expect(session.hintRegion.size).toBe(0);
  });

  it('reports when no hint is available', () => {
    const session = openExample('sudoku', 'Easy');
    session.solver.solve();
    session.hint();
    expect(session.notice?.title).toBe('No hint');
    session.dismissNotice();
    expect(session.notice).toBeNull();
  });
});

describe('solver steps', () => {
  it('fills in one cell and explains it', () => {
    const session = EASY();
    const open = session.puzzle.getNumberOfOpenCells();
    session.solveStep();
    expect(session.puzzle.getNumberOfOpenCells()).toBe(open - 1);
    const step = session.solver.lastStep!;
    expect(session.selectedCell()).toBe(step.cell);
    expect(session.stepMessage).toBe(`Solver step: ${step.describe()}`);
    expect(session.canUndo()).toBe(true);
  });

  it('fills in the cell of the hint being shown', () => {
    const session = EASY();
    session.hint();
    const hint = session.hints.deduction!;
    session.solveStep();
    expect(hint.cell.getValue()).toBe(hint.value);
  });

  it('says when a step makes no progress', () => {
    const session = openExample('sudoku', 'Hard');
    for (let i = 0; i < 200 && session.notice === null; i++) session.solveStep();
    expect(session.notice?.title).toBe('No progress');
    expect(session.notice?.text).toContain('Allow guessing');
  });
});

describe('solving in the background', () => {
  it('fills in the cells, as one undoable step', async () => {
    const session = EASY();
    await session.solve();
    expect(session.puzzle.isSolved()).toBe(true);
    expect(session.solving).toBeNull();
    session.undo();
    expect(session.puzzle.isSolved()).toBe(false);
  });

  it('leaves the shown puzzle alone while it runs', async () => {
    const session = openExample('sudoku', 'Hard');
    const before = session.puzzle.saveState();
    const solving = session.solve({ ...DEFAULT_SETTINGS, allowGuessing: true });
    expect(session.solving).toBe('solve');
    session.selectCell(cellAt(session, 0, 0));
    session.typeDigit(1);
    expect(session.inputMessage).toMatch(/busy/);
    expect(session.puzzle.saveState()).toEqual(before);
    await solving;
    expect(session.puzzle.isSolved()).toBe(true);
  });

  it('explains a step that only removes candidates, e.g. an X-Wing', () => {
    const session = openExample('sudoku', 'Hard');
    const messages: string[] = [];
    for (let i = 0; i < 200 && session.notice === null; i++) {
      session.solveStep();
      if (session.solver.lastStep === null && session.stepMessage !== null) {
        messages.push(session.stepMessage);
      }
    }
    expect(
      messages.some((m) => /^Solver step: removed \d+ candidates?\. X-Wing on \d/.test(m)),
    ).toBe(true);
  });

  it('shows the pattern of a technique step: groups, pattern, cover and lost values', () => {
    const session = openExample('sudoku', 'Hard');
    for (let i = 0; i < 200 && session.shownFinding === null && session.notice === null; i++) {
      session.solveStep();
    }
    const finding = session.shownFinding!;
    expect(finding.technique.getType()).toBe('X-Wing');
    expect(session.selection).toBeNull();
    expect(session.hintPattern).toEqual(new Set(finding.pattern));
    expect(session.hintReasonGroups).toEqual(new Set(finding.cover));
    expect(session.hintRuledOut).toEqual(new Set(finding.targets));
    // the targets lost the value
    for (const cell of finding.targets) expect(cell.values.has(finding.value)).toBe(false);
    const roles = session.highlight();
    for (const cell of finding.pattern) expect(roles.get(cell)).toBe(HighlightRole.PATTERN);
    for (const cell of finding.groups.flatMap((g) => g.getCells())) {
      expect(roles.get(cell)).toBeGreaterThanOrEqual(HighlightRole.HINT);
    }
    // the next step forgets it
    session.solveStep();
    expect(session.shownFinding).toBeNull();
    expect(session.hintPattern.size).toBe(0);
  });

  it('gets stuck without guessing on the hard sudoku', async () => {
    const session = openExample('sudoku', 'Hard');
    await session.solve(DEFAULT_SETTINGS);
    expect(session.puzzle.isSolved()).toBe(false);
    expect(session.stepMessage).toMatch(/Allow guessing/);
  });

  it('can be cancelled', async () => {
    const session = openExample('sudoku', 'Hard');
    const before = session.puzzle.saveState();
    const solving = session.solve({ ...DEFAULT_SETTINGS, allowGuessing: true });
    void session.solve(); // pressing Solve again cancels
    await solving;
    expect(session.stepMessage).toBe('Solving was cancelled.');
    expect(session.puzzle.saveState()).toEqual(before);
    expect(session.canUndo()).toBe(false);
  });

  it('reports a contradiction', async () => {
    const session = EASY();
    const right = session.solver.findSolution().solution.cells[0]!.value!;
    session.selectCell(cellAt(session, 0, 0));
    session.typeDigit(right === 4 ? 7 : 4); // fits the rules, but leaves no solution
    expect(session.game.isMistake(cellAt(session, 0, 0))).toBe(false);
    const before = session.puzzle.saveState();
    await session.solve({ ...DEFAULT_SETTINGS, allowGuessing: true });
    expect(session.notice?.title).toBe('Puzzle cannot be solved');
    expect(session.puzzle.saveState()).toEqual(before);
  });
});

describe('check', () => {
  it('finds the solution once and reports correct entries', async () => {
    const session = EASY();
    await session.check();
    expect(session.notice?.text).toContain('Nothing is filled in');
    expect(session.game.solution).not.toBeNull();
  });

  it('offers to mark the wrong cells', async () => {
    const session = EASY();
    const topLeft = cellAt(session, 0, 0);
    const solution = session.solver.findSolution().solution;
    const right = solution.cells[0]!.value!;
    session.selectCell(topLeft);
    session.typeDigit(right === 4 ? 7 : 4);
    await session.check();
    expect(session.notice?.text).toContain('1 of 1 filled-in cells are wrong');
    session.notice?.confirm?.action();
    expect(session.checkMarks).toEqual(new Set([topLeft]));
    // the selected cell keeps its (stronger) selection colour
    expect(session.highlight().get(topLeft)).toBe(HighlightRole.SELECTED);
    session.selectCell(null);
    expect(session.highlight().get(topLeft)).toBe(HighlightRole.WRONG);
    // a new value makes the marks outdated
    session.selectCell(topLeft);
    session.typeDigit(right);
    expect(session.checkMarks.size).toBe(0);
  });
});
