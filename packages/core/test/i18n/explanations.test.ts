// Every text the engine shows a player is a message that can be shown in every language: solve
// each example step by step and format the hints, steps, reasons and descriptions on the way.
import { describe, expect, it } from 'vitest';

import {
  CORE_RESOURCES,
  LANGUAGES,
  formatMessage,
  interpolate,
  lookup,
  type Language,
  type Message,
  type Translate,
} from '../../src/i18n/message';
import { HintSession } from '../../src/solver/hints';
import { Solver } from '../../src/solver/solver';
import { Game } from '../../src/structure/game';
import type { Puzzle } from '../../src/structure/puzzle';
import { allExamples } from '../helpers';

function translator(language: Language): Translate {
  return (key, params) => {
    const template = lookup(CORE_RESOURCES[language], language, key, params);
    if (template === undefined) throw new Error(`${language}: no '${key}'`);
    return interpolate(template, params);
  };
}

/** The messages a player can see while a puzzle is solved with hints and steps. */
function messagesOf(puzzleOf: () => Puzzle): {
  message: Message;
  english: string;
}[] {
  const puzzle = puzzleOf();
  const game = new Game(puzzle);
  const solver = new Solver(puzzle, true);
  const result: { message: Message; english: string }[] = [];
  const add = (message: Message, english: string): void => {
    result.push({ message, english });
  };
  for (const group of puzzle.getConstraintGroups()) {
    add(group.nameMessage(), group.getName());
    for (const c of group.getConstraints()) {
      add(c.summaryMessage(), c.summary());
      add(c.describeMessage(), c.describe());
      add(c.describeMessage(false), c.describe(false));
    }
  }
  for (let step = 0; step < 40 && !puzzle.isSolved(); step++) {
    const hints = new HintSession();
    for (let level = 0; level < 3; level++) {
      if (hints.advance(solver) === null) break;
      const message = hints.hintMessage();
      if (message !== null) add(message, hints.message());
    }
    const before = solver.log.length;
    if (!game.solveStep(solver, hints.deduction ?? hints.finding)) break;
    for (const d of solver.log.since(before)) {
      add(d.describeMessage(), d.describe());
      add(d.reasonMessage(), d.reason());
    }
  }
  add(game.check(game.solution ?? puzzle.saveState()).summaryMessage(), '');
  return result;
}

describe('the engine messages', () => {
  for (const [name, puzzleOf] of allExamples()) {
    it(`${name}: are the English texts, and can be shown in every language`, () => {
      const messages = messagesOf(puzzleOf);
      expect(messages.length).toBeGreaterThan(0);
      for (const { message, english } of messages) {
        if (english !== '') expect(formatMessage(message)).toBe(english);
        for (const { code } of LANGUAGES) {
          const text = formatMessage(message, translator(code));
          expect(text, `${code}: ${message.key}`).not.toMatch(/\{\{|undefined|\[object/);
        }
      }
    });
  }
});
