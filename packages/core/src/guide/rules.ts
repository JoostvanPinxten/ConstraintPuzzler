/**
 * The rules of every puzzle type, explained for players, with the techniques that help to solve
 * it (easiest first). The puzzle type registry (puzzletypes.ts) gives every type its guide. The
 * texts are in the catalog (keys `guide.rules.<type>.goal` and `guide.rules.<type>.1`, `.2`, ...).
 */
import { formatMessage, msg, type Message } from '../i18n/message';
import type { TechniqueId } from './techniques';
import { numberedKeys, requiredKey } from './texts';

export interface PuzzleGuide {
  /** the puzzle type (see PUZZLE_TYPES), whose texts these are */
  readonly type: string;
  /** one line: what you fill in (in English; see puzzleGuideTexts) */
  readonly goal: string;
  readonly rules: readonly string[];
  /** the techniques that apply, easiest first (keys of TECHNIQUE_GUIDE) */
  readonly techniques: readonly TechniqueId[];
}

/** The goal and rules of a puzzle type as messages. */
export interface PuzzleGuideTexts {
  readonly goal: Message;
  readonly rules: readonly Message[];
}

/** The goal and rules of a puzzle type (its `type`), as messages. */
export function puzzleGuideTexts(type: string): PuzzleGuideTexts {
  return {
    goal: msg(requiredKey(`guide.rules.${type}.goal`)),
    rules: numberedKeys(`guide.rules.${type}.`).map((key) => msg(key)),
  };
}

function guide(type: string, techniques: readonly TechniqueId[]): PuzzleGuide {
  const texts = puzzleGuideTexts(type);
  return {
    type,
    goal: formatMessage(texts.goal),
    rules: texts.rules.map((rule) => formatMessage(rule)),
    techniques,
  };
}

const SUDOKU_TECHNIQUES: readonly TechniqueId[] = [
  'nakedSingle',
  'hiddenSingle',
  'elimination',
  'intersection',
  'nakedSubset',
  'hiddenSubset',
  'xWing',
  'swordfish',
  'jellyfish',
  'guess',
];

export const SUDOKU_GUIDE: PuzzleGuide = guide('sudoku', SUDOKU_TECHNIQUES);

export const KAKURO_GUIDE: PuzzleGuide = guide('kakuro', [
  'sumCombinations',
  'nakedSingle',
  'elimination',
  'nakedSubset',
  'guess',
]);

export const FUTOSHIKI_GUIDE: PuzzleGuide = guide('futoshiki', [
  'inequality',
  'nakedSingle',
  'hiddenSingle',
  'elimination',
  'nakedSubset',
  'hiddenSubset',
  'xWing',
  'swordfish',
  'jellyfish',
  'guess',
]);

export const JIDOKU_GUIDE: PuzzleGuide = guide('jidoku', ['inequality', ...SUDOKU_TECHNIQUES]);

export const SUMBRERO_GUIDE: PuzzleGuide = guide('sumbrero', [
  'sumCombinations',
  'nakedSingle',
  'elimination',
  'nakedSubset',
  'guess',
]);

export const NONOGRAM_GUIDE: PuzzleGuide = guide('nonogram', [
  'wholeLine',
  'overlap',
  'reach',
  'placements',
  'guess',
]);
