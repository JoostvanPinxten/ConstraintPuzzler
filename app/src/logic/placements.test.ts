import type { PlacementDiagram } from '@constraintpuzzler/core';

import { placementsCaption } from './placements';

const name = (v: number): string => (v === 0 ? 'blank' : 'black');
const diagram = (over: Partial<PlacementDiagram>): PlacementDiagram => ({
  index: 0,
  value: 1,
  known: [null, null, null],
  vertical: false,
  block: null,
  rows: [[1, 0, 0]],
  total: 1,
  ...over,
});

describe('placementsCaption', () => {
  it('describes the places of the covering block', () => {
    expect(placementsCaption(diagram({ block: 0, vertical: true }), name)).toBe(
      'The column now (grey: open), then every place block 1 can go: each covers the outlined cell.',
    );
  });

  it('mentions the other blocks when they are drawn', () => {
    const d = diagram({ block: 1, rows: [[1, 0, 1]], spans: [[2, 2]] });
    expect(placementsCaption(d, name)).toBe(
      'The row now (grey: open), then every place block 2 can go, with the other blocks (pale) ' +
        'pushed as far from it as they fit: each covers the outlined cell.',
    );
  });

  it('counts the placements of the blocks', () => {
    const rows = [
      [1, 0, 0],
      [1, 0, 1],
    ];
    expect(placementsCaption(diagram({ rows, total: 2 }), name)).toBe(
      'The row now (grey: open), then the 2 ways its blocks fit: every one makes the outlined cell black.',
    );
    expect(placementsCaption(diagram({ rows, total: 9, value: null }), name)).toBe(
      'The row now (grey: open), then 2 of the 9 ways its blocks fit: none gives the outlined cell the removed colour.',
    );
    expect(placementsCaption(diagram({}), name)).toBe(
      'The row now (grey: open), then the only way its blocks fit: it makes the outlined cell black.',
    );
  });
});
