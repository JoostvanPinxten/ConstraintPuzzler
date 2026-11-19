/**
 * The solving techniques explained for players: one entry for every kind of deduction the
 * engine makes (Deduction.techniqueId names the entry behind a deduction), so a hint can link
 * to the technique it used. The texts are short and practical: what to look for and what it
 * lets you conclude.
 */

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

/** Every technique, by id. */
export const TECHNIQUE_GUIDE: Readonly<Record<TechniqueId, TechniqueGuide>> = defineTechniques([
  {
    id: 'nakedSingle',
    name: 'Naked single',
    summary: 'A cell with only one candidate left gets that value.',
    steps: [
      'Look at the values the cell’s groups already hold: none of them can go in the cell.',
      'When all values but one are ruled out, the last one is the cell’s value.',
    ],
    example: 'A Sudoku cell whose row, column and box together hold 1–8 must be 9.',
  },
  {
    id: 'hiddenSingle',
    name: 'Hidden single',
    summary: 'A value that fits in only one cell of a group goes in that cell.',
    steps: [
      'Pick a group that needs every value once (a row, column or box) and a value it still misses.',
      'Rule out every open cell that cannot hold it: if one cell is left, the value goes there, even when that cell has other candidates too.',
    ],
    example:
      'If 4 is missing from a row and the other open cells of the row all see a 4, the 4 goes in the last cell.',
  },
  {
    id: 'elimination',
    name: 'Elimination',
    summary:
      'A placed value is removed from the candidates of the cells that share a group with it.',
    steps: [
      'When a value is placed, no other cell of its groups can hold it.',
      'Removing it from those cells is the basis of the other techniques; with notes, cross it off as you go.',
    ],
  },
  {
    id: 'nakedSubset',
    name: 'Naked pair, triple, …',
    summary: 'k cells of a group that share only k candidates take those values between them.',
    steps: [
      'Find two cells of a group with the same two candidates (or three cells with three candidates between them, and so on).',
      'Those values must go in those cells, so remove them from the other cells of the group.',
    ],
    example: 'Two cells of a row with candidates {2, 7}: no other cell of the row can be 2 or 7.',
  },
  {
    id: 'hiddenSubset',
    name: 'Hidden pair, triple, …',
    summary: 'k values that fit in only the same k cells of a group fill those cells.',
    steps: [
      'Find two values that a group still needs and that fit in the same two cells only (or three values in three cells, and so on).',
      'Those cells hold exactly those values, so their other candidates go.',
    ],
    example: 'If 3 and 8 can only go in the same two cells of a box, those cells are {3, 8}.',
  },
  {
    id: 'intersection',
    name: 'Pointing and box-line',
    summary:
      'When a value of one group can only go where it overlaps another group, the rest of the other group loses it.',
    steps: [
      'Pointing: in a box, a value fits only in cells of one row (or column). It must go in that row there, so the row’s cells outside the box lose it.',
      'Box-line: in a row (or column), a value fits only in cells of one box. It must go in the box there, so the box’s other cells lose it.',
    ],
  },
  {
    id: 'xWing',
    name: 'X-Wing',
    summary: 'A value that fits in the same two columns of two rows is in those columns there.',
    steps: [
      'Find two rows where a value fits in exactly two cells, and the cells are in the same two columns.',
      'The value goes in one corner of the rectangle in each row, so it takes both columns: the other cells of those columns lose it.',
      'The same works with rows and columns swapped.',
    ],
  },
  {
    id: 'swordfish',
    name: 'Swordfish',
    summary: 'The X-Wing with three rows and three columns.',
    steps: [
      'Find three rows where a value fits only in cells of the same three columns (two or three cells per row).',
      'The value takes one cell of each of those columns in those rows, so the other cells of the columns lose it.',
    ],
  },
  {
    id: 'jellyfish',
    name: 'Jellyfish',
    summary: 'The X-Wing with four rows and four columns.',
    steps: [
      'Find four rows where a value fits only in cells of the same four columns.',
      'The other cells of those four columns lose the value.',
    ],
  },
  {
    id: 'sumCombinations',
    name: 'Sum combinations',
    summary: 'Only values that are part of a combination adding up to the total can go in a line.',
    steps: [
      'List the sets of different values that add up to the total with the right number of cells; subtract the values already placed.',
      'A value that is in none of those sets cannot go in the line. Some totals have only one set: 3 in two cells is 1 + 2, 17 in two cells is 8 + 9.',
      'Where two lines cross, the cell can only hold values that fit both.',
    ],
    example:
      'A line of two cells adding up to 4 is 1 + 3 (2 + 2 repeats a value), so neither cell can be 2.',
  },
  {
    id: 'inequality',
    name: 'Inequalities',
    summary:
      'A cell that must be smaller than another cannot hold the largest values, and the larger cell not the smallest.',
    steps: [
      'The smaller cell must be below the largest candidate of the larger cell, the larger cell above the smallest candidate of the smaller one.',
      'Follow chains: in a < b < c, a is at most N − 2 and c at least 3.',
    ],
    example: 'If b < c and c can only be 3 or 5, b can be at most 4.',
  },
  {
    id: 'wholeLine',
    name: 'Whole line',
    summary: 'A line without blocks is all blank, and blocks that need the whole line fill it.',
    steps: [
      'Add up the blocks and the gaps they need (one blank between blocks of the same colour).',
      'If that is the length of the line, there is only one way to place them; a 0 clue means the whole line is blank.',
    ],
    example: 'Clue 3 2 in a line of 6: 3 + 1 + 2 = 6, so the line is ■■■□■■.',
  },
  {
    id: 'overlap',
    name: 'Overlap',
    summary: 'Cells that a block covers wherever it goes are that block’s colour.',
    steps: [
      'Push a block as far to the start as it can go, then as far to the end.',
      'The cells it covers in both positions are filled, wherever it ends up.',
    ],
    example: 'A block of 7 in a line of 10 can start at cell 1 to 4: cells 4–7 are always covered.',
  },
  {
    id: 'reach',
    name: 'Out of reach',
    summary: 'A cell that no block of a colour can reach is not that colour.',
    steps: [
      'For each block, work out the first and last cell it can cover.',
      'Cells outside the reach of every block of a colour cannot be that colour; with one colour they are blank.',
    ],
  },
  {
    id: 'placements',
    name: 'All placements',
    summary:
      'A colour that a cell has in no placement of the blocks that fits the known cells is ruled out.',
    steps: [
      'Try every way to place the blocks of a line that agrees with the cells you know.',
      'A cell that has the same colour in all of them gets that colour; a colour it never gets is ruled out.',
    ],
  },
  {
    id: 'guess',
    name: 'Guessing',
    summary:
      'When nothing follows from the rules, try a value and see whether it leads to a contradiction.',
    steps: [
      'Pick a cell with few candidates and assume one of them.',
      'Carry on solving; if a rule breaks, the guess was wrong, so go back and remove that candidate. The app only guesses with Allow guessing on.',
    ],
  },
]);
