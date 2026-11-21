/**
 * The solving techniques explained for players: one entry for every kind of deduction the
 * engine makes (Deduction.techniqueId names the entry behind a deduction), so a hint can link
 * to the technique it used. The texts are short and practical: what to look for and what it
 * lets you conclude.
 */

import { guideKey, numberedKeys, requiredKey } from './texts';
import { formatMessage, msg, type Message } from '../i18n/message';

export type TechniqueId =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'elimination'
  | 'nakedSubset'
  | 'hiddenSubset'
  | 'intersection'
  | 'xWing'
  | 'swordfish'
  | 'jellyfish'
  | 'sumCombinations'
  | 'inequality'
  | 'wholeLine'
  | 'overlap'
  | 'reach'
  | 'placements'
  | 'guess';

export interface TechniqueGuide {
  readonly id: TechniqueId;
  /** e.g. "Hidden single" */
  readonly name: string;
  /** one line: what the technique concludes */
  readonly summary: string;
  /** how to spot and apply it, a sentence or two each */
  readonly steps: readonly string[];
  /** a small worked example, in words */
  readonly example?: string;
  /** a small board that shows the pattern */
  readonly board?: ExampleBoard;
}

/**
 * A small picture of a technique: a few cells with values, candidates and marks. Every row is
 * a string of cells separated by spaces; a cell is
 * - `5`: a value; `.`: an empty cell; `#` and `x`: a filled and a blank nonogram cell;
 * - `{27}`: the candidates 2 and 7; `{38|16}`: the candidates 3 and 8, and 1 and 6 crossed out;
 * followed by a mark: `*` the pattern (where the value can still go), `!` a cell that loses a
 * candidate, `^` a cell the technique fills in.
 */
export interface ExampleBoard {
  readonly rows: readonly string[];
  /** a thick line after every `box` columns and rows, e.g. 3 for Sudoku boxes */
  readonly box?: number;
  /** the text left of every row, e.g. a nonogram clue */
  readonly rowLabels?: readonly string[];
  /** what the board shows */
  readonly caption: string;
}

export type ExampleMark = 'pattern' | 'target' | 'answer';

export interface ExampleCell {
  /** a value, or '#' / 'x' for a filled / blank nonogram cell; null when empty */
  readonly value: string | null;
  readonly candidates: readonly number[];
  /** candidates shown crossed out */
  readonly removed: readonly number[];
  readonly mark: ExampleMark | null;
}

const MARKS: Readonly<Record<string, ExampleMark>> = {
  '*': 'pattern',
  '!': 'target',
  '^': 'answer',
};
const CELL_PATTERN = /^(?:(\d|#|x|\.)|\{(\d*)(?:\|(\d+))?\})([*!^]?)$/;

const digits = (text: string | undefined): number[] => [...(text ?? '')].map(Number);

/** The cells of an example board, row by row (see ExampleBoard). Throws on a malformed cell. */
export function parseExampleBoard(board: ExampleBoard): ExampleCell[][] {
  return board.rows.map((row) =>
    row
      .trim()
      .split(/\s+/)
      .map((token): ExampleCell => {
        const match = CELL_PATTERN.exec(token);
        if (match === null) throw new Error(`example board: cannot read cell '${token}'`);
        const [, value, candidates, removed, mark] = match;
        return {
          value: value === undefined || value === '.' ? null : value,
          candidates: digits(candidates),
          removed: digits(removed),
          mark: mark === undefined || mark === '' ? null : (MARKS[mark] ?? null),
        };
      }),
  );
}

function defineTechniques(
  entries: readonly TechniqueGuide[],
): Readonly<Record<TechniqueId, TechniqueGuide>> {
  const byId: Partial<Record<TechniqueId, TechniqueGuide>> = {};
  for (const entry of entries) {
    if (byId[entry.id] !== undefined) throw new Error(`technique '${entry.id}' listed twice`);
    byId[entry.id] = entry;
  }
  return byId as Record<TechniqueId, TechniqueGuide>;
}

/** The techniques in the order of the guide. */
const TECHNIQUE_IDS: readonly TechniqueId[] = [
  'nakedSingle',
  'hiddenSingle',
  'elimination',
  'nakedSubset',
  'hiddenSubset',
  'intersection',
  'xWing',
  'swordfish',
  'jellyfish',
  'sumCombinations',
  'inequality',
  'wholeLine',
  'overlap',
  'reach',
  'placements',
  'guess',
];

/** The example boards (their captions are in the catalog, like the other texts). */
const BOARDS: Partial<Record<TechniqueId, Omit<ExampleBoard, 'caption'>>> = {
  hiddenSingle: { rows: ['3 {29} 6 {249}^ 7 {289} 1 5 {89}'] },
  nakedSubset: { rows: ['{27}* {27}* {38|2}! 5 {138|7}! 4 {38} 6 9'] },
  hiddenSubset: { rows: ['{38|16}* {38|169}* 5 {169} 2 {16} 4 7 {69}'] },
  intersection: {
    rows: ['{4}* {4}* 6 . {|4}! . . {|4}! .', '1 2 3 . . . . . .', '5 7 8 . . . . . .'],
    box: 3,
  },
  xWing: {
    rows: [
      '. {7}* . . {7}*',
      '. {|7}! . . .',
      '. . . . {|7}!',
      '. {7}* . . {7}*',
      '. {|7}! . . {|7}!',
    ],
  },
  wholeLine: { rows: ['#^ #^ #^ x^ #^ #^'], rowLabels: ['3 2'] },
  overlap: { rows: ['. . . #^ #^ #^ #^ . . .'], rowLabels: ['7'] },
};

/** The texts of a technique as messages: its name, summary, steps, example and caption. */
export interface TechniqueTexts {
  readonly name: Message;
  readonly summary: Message;
  readonly steps: readonly Message[];
  readonly example?: Message;
  readonly caption?: Message;
}

/** The texts of a technique (keys `guide.technique.<id>.*` of the catalog). */
export function techniqueTexts(id: TechniqueId): TechniqueTexts {
  const prefix = `guide.technique.${id}`;
  const example = guideKey(`${prefix}.example`);
  const caption = guideKey(`${prefix}.caption`);
  return {
    name: msg(requiredKey(`${prefix}.name`)),
    summary: msg(requiredKey(`${prefix}.summary`)),
    steps: numberedKeys(`${prefix}.step`).map((key) => msg(key)),
    ...(example === null ? {} : { example: msg(example) }),
    ...(caption === null ? {} : { caption: msg(caption) }),
  };
}

function techniqueGuide(id: TechniqueId): TechniqueGuide {
  const texts = techniqueTexts(id);
  const board = BOARDS[id];
  return {
    id,
    name: formatMessage(texts.name),
    summary: formatMessage(texts.summary),
    steps: texts.steps.map((step) => formatMessage(step)),
    ...(texts.example === undefined ? {} : { example: formatMessage(texts.example) }),
    ...(board === undefined
      ? {}
      : {
          board: {
            ...board,
            caption: texts.caption === undefined ? '' : formatMessage(texts.caption),
          },
        }),
  };
}

/** Every technique, by id (in English; see techniqueTexts for the texts as messages). */
export const TECHNIQUE_GUIDE: Readonly<Record<TechniqueId, TechniqueGuide>> = defineTechniques(
  TECHNIQUE_IDS.map(techniqueGuide),
);
