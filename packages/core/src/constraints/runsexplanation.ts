/**
 * The texts of a nonogram line (RunsConstraint) for players, as messages: its clue, its
 * description and why it made a deduction. Kept apart from the constraint's search code.
 */
import { commaList, msg, semicolonList, type Message, type MessageParam } from '../i18n/message';
import type { Deduction } from '../structure/deduction';
import { sortedValues, type Value } from '../structure/types';
import {
  BLACK_AND_WHITE,
  BLANK,
  type PaletteColor,
  type Run,
  type RunsConstraint,
} from './runsconstraint';

/** The name of a colour: a message for the built-in blank and black, else its own name. */
export function paletteColorName(color: PaletteColor): string | Message {
  if (color === BLACK_AND_WHITE[0]) return msg('color.blank');
  if (color === BLACK_AND_WHITE[1]) return msg('color.black');
  return color.name;
}

/** The name of a value of the line's palette (or the number, for a value not in it). */
export function colorParam(constraint: RunsConstraint, value: Value): MessageParam {
  const color = constraint.palette.find((c) => c.value === value);
  return color === undefined ? value : paletteColorName(color);
}

/** '3 1' for one colour, else '3 red, 1 black'; 'no blocks' when empty. */
export function clueMessage(constraint: RunsConstraint, runs: readonly Run[]): Message {
  if (runs.length === 0) return msg('runs.clueNone');
  const colors = constraint.palette.filter((c) => c.value !== BLANK).length;
  if (colors <= 1) return msg('text.plain', { text: runs.map((r) => String(r.length)).join(' ') });
  return msg('text.plain', {
    text: commaList(
      runs.map((r) =>
        msg('runs.clueBlock', { length: r.length, color: colorParam(constraint, r.color) }),
      ),
    ),
  });
}

/** "cell 3" or "cells 3-5" (counting from 1). */
function cellRange(from: number, to: number): Message {
  return from === to
    ? msg('runs.cell', { cell: from + 1 })
    : msg('runs.cells', { from: from + 1, to: to + 1 });
}

/** The rule of the line and how far it is known. */
export function describeRuns(constraint: RunsConstraint): Message {
  const cells = constraint.group.getCells();
  const known = cells.filter((c) => c.getValue() !== null).length;
  const rule =
    constraint.runs.length === 0
      ? msg('runs.describeNone')
      : msg('runs.describe', { clue: clueMessage(constraint, constraint.runs) });
  if (known === cells.length) return msg('runs.complete', { rule });
  return msg('runs.known', { rule, known, total: cells.length });
}

/** Why the line made a deduction. */
export function explainRuns(constraint: RunsConstraint, deduction: Deduction): Message {
  const group = constraint.group.nameMessage();
  const line = msg(
    constraint.group.getName().toLowerCase().startsWith('column') ? 'runs.column' : 'runs.line',
  );
  const reason = constraint.reasonOf(deduction);
  const index = constraint.group.cells.indexOf(deduction.cell);
  const value = deduction.setsValue()
    ? (deduction.value as Value)
    : (sortedValues(deduction.removed)[0] as Value);
  const color = colorParam(constraint, value);
  const clue = clueMessage(constraint, constraint.runs);
  switch (reason.technique) {
    case 'wholeLine':
      if (constraint.runs.length === 0) return msg('runs.wholeLineEmpty', { group });
      return msg('runs.wholeLine', { group, clue, line });
    case 'overlap': {
      const b = reason.run ?? 0;
      const run = constraint.runs[b] as Run;
      const first = reason.first ?? index;
      const last = reason.last ?? index;
      const where =
        first === last
          ? msg('runs.startsAt', { cell: first + 1 })
          : msg('runs.startsIn', { range: cellRange(first, last) });
      const why = boundsWhy(constraint, b, first, last);
      const params = {
        block: b + 1,
        group,
        clue: clueMessage(constraint, [run]),
        where,
        range: cellRange(last, first + run.length - 1),
        color: colorParam(constraint, run.color),
      };
      return why === null
        ? msg('runs.overlap', params)
        : msg('runs.overlapWhy', { ...params, why });
    }
    case 'reach':
      if (deduction.setsValue()) return msg('runs.reachBlank', { group });
      if (!constraint.runs.some((r) => r.color === value)) {
        return msg('runs.noColor', { group, color });
      }
      return msg('runs.reachColor', { group, color });
    case 'placements':
      return msg(deduction.setsValue() ? 'runs.placementsEvery' : 'runs.placementsNone', {
        group,
        clue,
        color,
      });
  }
}

/**
 * Why block b starts no earlier than `first` and no later than `last`: the blocks before or
 * after it need the room, or else the cells known so far. Null when it can start anywhere.
 */
function boundsWhy(
  constraint: RunsConstraint,
  b: number,
  first: number,
  last: number,
): Message | null {
  const cellsOfLine = constraint.group.cells;
  const n = cellsOfLine.length;
  const run = constraint.runs[b] as Run;
  const open = constraint.placements(cellsOfLine.map(() => new Set(constraint.group.getValues())));
  const reasons: Message[] = [];
  const blocks = (runs: readonly Run[], before: boolean, cells: number): Message => {
    const filled = runs.reduce((sum, r) => sum + r.length, 0);
    const which = msg(before ? 'runs.blocksBefore' : 'runs.blocksAfter', {
      count: runs.length,
      clue: clueMessage(constraint, runs),
    });
    const room = msg(before ? 'runs.firstCells' : 'runs.lastCells', { count: cells });
    const key =
      cells - filled > 1 ? 'runs.needGaps' : cells > filled ? 'runs.needGap' : 'runs.need';
    return msg(key, { blocks: which, room });
  };
  const known: Message[] = [];
  if (first > 0) {
    if (open !== null && open.firstStart[b] === first) {
      reasons.push(blocks(constraint.runs.slice(0, b), true, first));
    } else known.push(msg('runs.knownBefore', { cell: first + 1 }));
  }
  if (last + run.length < n) {
    if (open !== null && open.lastStart[b] === last) {
      reasons.push(blocks(constraint.runs.slice(b + 1), false, n - last - run.length));
    } else known.push(msg('runs.knownAfter', { cell: last + 1 }));
  }
  if (known.length > 0) {
    reasons.push(msg('runs.knownKeep', { where: { items: known, join: 'or' } }));
  }
  return reasons.length > 0 ? msg('text.plain', { text: semicolonList(reasons) }) : null;
}
