import { DEFAULT_LANGUAGE, msg } from '@constraintpuzzler/core';

import { i18n } from '../i18n';
import { openExample } from '../puzzles/open';
import { formatUi, plain, ui } from './messages';
import { describeSelection } from './tree';

describe('session messages', () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  it('format nested app and engine messages in the current language', async () => {
    const message = ui('hint.message', {
      message: ui('step.narrowing', { count: 2, reason: msg('values.none') }),
    });
    expect(formatUi(message)).toBe('Hint: removed 2 candidates. none.');
    await i18n.changeLanguage('nl');
    expect(formatUi(message)).toBe('Hint: 2 kandidaten weggehaald. geen.');
    expect(formatUi(ui('step.narrowing', { count: 1, reason: 'x' }))).toBe(
      '1 kandidaat weggehaald. x.',
    );
  });

  it('show hints and the engine explanations in Dutch', async () => {
    const session = openExample('sudoku', 'Easy');
    await i18n.changeLanguage('nl');
    session.hint();
    expect(formatUi(session.stepMessage!)).toMatch(/^Hint: (Kijk naar|In het gemarkeerde gebied)/);
    session.hint();
    session.hint();
    expect(formatUi(session.stepMessage!)).toMatch(/^Hint: vakje \d+, \d+ is \d: /);
    const group = session.puzzle.getConstraintGroups()[0]!;
    const description = describeSelection(session.puzzle, { kind: 'group', group }, true);
    expect(description.title).toBe('Blok 1');
    expect(description.bullets?.[0]).toMatch(/^Elk cijfer komt precies één keer voor/);
  });

  it('keep plain texts as they are', () => {
    expect(formatUi(plain('Row 3: {{not a placeholder}}'))).toBe('Row 3: {{not a placeholder}}');
  });

  it('follow the language while they are shown', async () => {
    const session = openExample('sudoku', 'Easy');
    session.selection = { kind: 'cell', cell: session.puzzle.getGrid().getCells()[0]! };
    session.solving = 'solve';
    session.typeDigit(5);
    const message = session.inputMessage!;
    expect(formatUi(message)).toMatch(/^The solver is busy/);
    await i18n.changeLanguage('nl');
    expect(formatUi(message)).toMatch(/^De oplosser is bezig/);
    expect(i18n.t(session.hintLabel())).toBe('Hint');
  });
});
