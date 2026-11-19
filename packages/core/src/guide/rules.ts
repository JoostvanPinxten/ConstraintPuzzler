/**
 * The rules of every puzzle type, explained for players, with the techniques that help to solve
 * it (easiest first). The puzzle type registry (puzzletypes.ts) gives every type its guide.
 */
import type { TechniqueId } from './techniques';

export interface PuzzleGuide {
  /** one line: what you fill in */
  readonly goal: string;
  readonly rules: readonly string[];
  /** the techniques that apply, easiest first (keys of TECHNIQUE_GUIDE) */
  readonly techniques: readonly TechniqueId[];
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

export const SUDOKU_GUIDE: PuzzleGuide = {
  goal: 'Fill the grid with the numbers 1 to 9.',
  rules: [
    'Every row holds each number 1–9 exactly once.',
    'Every column holds each number 1–9 exactly once.',
    'Every 3×3 box holds each number 1–9 exactly once.',
    'The given numbers cannot be changed; a good puzzle has exactly one solution.',
  ],
  techniques: SUDOKU_TECHNIQUES,
};

export const KAKURO_GUIDE: PuzzleGuide = {
  goal: 'Fill the white cells with the numbers 1 to 9.',
  rules: [
    'A clue gives the sum of the run of white cells to its right (across) or below it (down).',
    'The cells of a run add up to its clue.',
    'A number appears at most once in a run.',
  ],
  techniques: ['sumCombinations', 'nakedSingle', 'elimination', 'nakedSubset', 'guess'],
};

export const FUTOSHIKI_GUIDE: PuzzleGuide = {
  goal: 'Fill the N×N grid with the numbers 1 to N.',
  rules: [
    'Every row and every column holds each number 1–N exactly once.',
    'A < or > sign between two cells says which of the two is smaller.',
  ],
  techniques: [
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
  ],
};

export const JIDOKU_GUIDE: PuzzleGuide = {
  goal: 'Fill the grid with the numbers 1 to 9.',
  rules: [
    'As in Sudoku, every row, column and 3×3 box holds each number 1–9 exactly once.',
    'There are usually no given numbers: the clues are < and > signs between neighbouring cells of a box, drawn as a bent edge that points to the smaller cell.',
  ],
  techniques: ['inequality', ...SUDOKU_TECHNIQUES],
};

export const SUMBRERO_GUIDE: PuzzleGuide = {
  goal: 'Fill every hexagon with a number from the puzzle’s range.',
  rules: [
    'Lines of hexagons run in three directions: straight down, down-right and up-right.',
    'A clue gives the sum of its line: the hexagons of the line add up to it.',
    'A number appears at most once in a line with a clue.',
  ],
  techniques: ['sumCombinations', 'nakedSingle', 'elimination', 'nakedSubset', 'guess'],
};

export const NONOGRAM_GUIDE: PuzzleGuide = {
  goal: 'Colour the cells to reveal a picture.',
  rules: [
    'The clue of a row or column lists the lengths of its blocks of filled cells, in order.',
    'Blocks of the same colour have at least one blank cell between them; blocks of different colours may touch.',
    'All other cells are blank. With several colours, a clue’s colour is the colour of its block.',
  ],
  techniques: ['wholeLine', 'overlap', 'reach', 'placements', 'guess'],
};
