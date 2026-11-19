// The board geometry of every puzzle type (as the former PySide6 GUI smoke tests checked it).
import {
  CellGreaterThanCellConstraint,
  parsePuzzle,
  PUZZLE_TYPES,
  TotalSumValueConstraint,
  type PuzzleTypeName,
} from '@constraintpuzzler/core';

import { openExample } from '../puzzles/open';
import {
  BEND_DEPTH,
  clueLayout,
  framePositions,
  hintGrid,
  inequalitySign,
  JIDOKU_BOX_SHADE,
  LAYOUTS,
  outlineEdges,
  type Point,
} from './layout';

describe.each(Object.keys(PUZZLE_TYPES) as PuzzleTypeName[])('%s layout', (type) => {
  const puzzle = openExample(type).puzzle;
  const layout = LAYOUTS[type](puzzle);

  it('has a shape for every cell', () => {
    expect(layout.cells.map((s) => s.cell).sort()).toEqual([...puzzle.getGrid().getCells()].sort());
  });

  it('keeps everything inside the bounds', () => {
    const { bounds } = layout;
    for (const shape of layout.cells) {
      for (const p of shape.outline) {
        expect(p.x).toBeGreaterThanOrEqual(bounds.x);
        expect(p.y).toBeGreaterThanOrEqual(bounds.y);
        expect(p.x).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(p.y).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
    }
  });

  it('puts the hint area and the value inside the cell', () => {
    for (const shape of layout.cells) {
      const xs = shape.outline.map((p) => p.x);
      const ys = shape.outline.map((p) => p.y);
      const inside = (p: Point) =>
        p.x >= Math.min(...xs) - 1e-9 &&
        p.x <= Math.max(...xs) + 1e-9 &&
        p.y >= Math.min(...ys) - 1e-9 &&
        p.y <= Math.max(...ys) + 1e-9;
      const area = shape.hintArea;
      expect(inside({ x: area.x, y: area.y })).toBe(true);
      expect(inside({ x: area.x + area.width, y: area.y + area.height })).toBe(true);
      expect(inside(shape.valueCenter)).toBe(true);
    }
  });

  it('does not overlap cells', () => {
    const centers = layout.cells.map((s) => s.valueCenter);
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const a = centers[i]!;
        const b = centers[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40);
      }
    }
  });
});

describe('hint grid', () => {
  it('is 3x3 for nine values', () => {
    expect(hintGrid(9)).toEqual([3, 3]);
    expect(hintGrid(7)).toEqual([3, 3]);
    expect(hintGrid(16)).toEqual([4, 4]);
    expect(hintGrid(1)).toEqual([1, 1]);
  });
});

describe('kakuro', () => {
  it('draws one clue per sum', () => {
    const puzzle = openExample('kakuro', 'Medium').puzzle;
    const sums = puzzle.getConstraints().filter((c) => c instanceof TotalSumValueConstraint);
    const texts = LAYOUTS.kakuro(puzzle).decorations.filter((d) => d.kind === 'text');
    expect(texts).toHaveLength(sums.length);
    expect(texts.map((t) => (t.kind === 'text' ? t.text : '')).sort()).toEqual(
      sums.map((s) => String((s as TotalSumValueConstraint).getTotalValue())).sort(),
    );
  });
});

/** The inequalities of a puzzle. */
const relationsOf = (type: PuzzleTypeName) => {
  const puzzle = openExample(type).puzzle;
  const relations = puzzle
    .getConstraints()
    .filter((c): c is CellGreaterThanCellConstraint => c instanceof CellGreaterThanCellConstraint);
  return { puzzle, relations, layout: LAYOUTS[type](puzzle) };
};

describe.each(['futoshiki', 'jidoku'] as const)('%s bent edges', (type) => {
  const { relations, layout } = relationsOf(type);
  const shapes = new Map(layout.cells.map((s) => [s.cell, s]));

  it('bends the shared edge of every inequality, its point in the lesser cell', () => {
    expect(layout.decorations.filter((d) => d.kind === 'polyline')).toHaveLength(0);
    for (const relation of relations) {
      const greater = shapes.get(relation.greaterCell!)!;
      const lesser = shapes.get(relation.lesserCell!)!;
      const shared = greater.outline.filter((p) =>
        lesser.outline.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-9),
      );
      // the two corners, the two ends of the bend and its tip
      expect(shared).toHaveLength(5);
      const g = greater.valueCenter;
      const l = lesser.valueCenter;
      // the tip lies on the line between the centres, the bend depth beyond the middle
      const tip = shared.reduce((best, p) =>
        Math.hypot(p.x - l.x, p.y - l.y) < Math.hypot(best.x - l.x, best.y - l.y) ? p : best,
      );
      const size = Math.hypot(g.x - l.x, g.y - l.y);
      expect(Math.hypot(tip.x - l.x, tip.y - l.y)).toBeCloseTo(size / 2 - BEND_DEPTH * size);
    }
  });

  it('keeps the small values clear of the bends', () => {
    for (const shape of layout.cells) {
      const { hintArea, outline } = shape;
      for (const p of outline) {
        const inside =
          p.x > hintArea.x + 1e-9 &&
          p.x < hintArea.x + hintArea.width - 1e-9 &&
          p.y > hintArea.y + 1e-9 &&
          p.y < hintArea.y + hintArea.height - 1e-9;
        expect(inside).toBe(false);
      }
    }
  });
});

describe('futoshiki', () => {
  it('draws a separate sign for an inequality between cells that do not touch', () => {
    const puzzle = parsePuzzle(PUZZLE_TYPES.futoshiki, '- - -\n- - -\n- - -\nrelativity\n1,1>3,1');
    const signs = LAYOUTS.futoshiki(puzzle).decorations.filter((d) => d.kind === 'polyline');
    expect(signs).toHaveLength(1);
  });

  it('needs two distinct cells for a sign', () => {
    expect(() => inequalitySign({ x: 0, y: 0 }, { x: 0, y: 0 }, 5, 5)).toThrow();
  });
});

describe('jidoku', () => {
  const { puzzle, layout } = relationsOf('jidoku');

  it('shades every other box, as in the paper', () => {
    const shaded = layout.cells.filter((s) => s.background === JIDOKU_BOX_SHADE);
    expect(shaded).toHaveLength(4 * 9);
    const block = (n: number) =>
      new Set(
        puzzle
          .getConstraintGroups()
          .find((g) => g.getName() === `Block ${n}`)!
          .getCells(),
      );
    for (const n of [2, 4, 6, 8]) {
      expect(shaded.filter((s) => block(n).has(s.cell))).toHaveLength(9);
    }
  });

  it('draws the border of a box around its bends', () => {
    const block = new Set(
      puzzle
        .getConstraintGroups()
        .find((g) => g.getName() === 'Block 1')!
        .getCells(),
    );
    const edges = outlineEdges(layout.cells.filter((s) => block.has(s.cell)));
    // clues only join cells within a box, so its border is straight: 3 edges per side
    expect(edges).toHaveLength(12);
  });
});

describe('sumbrero', () => {
  const puzzle = openExample('sumbrero').puzzle;

  it('frames the cells with black hexagons that are not cells', () => {
    const cells = new Set(
      puzzle
        .getGrid()
        .getPositionedCells()
        .map((c) => c.getPosition().key()),
    );
    const frame = framePositions(puzzle);
    expect(frame.length).toBeGreaterThan(0);
    for (const p of frame) expect(cells.has(p.key())).toBe(false);
  });

  it('puts every clue on a frame hexagon, one per wedge', () => {
    const frame = new Set(framePositions(puzzle).map((p) => p.key()));
    const used = new Set<string>();
    const clues = clueLayout(puzzle);
    expect(clues.size).toBe(puzzle.getConstraintGroups().length);
    for (const [position, direction] of clues.values()) {
      expect(frame.has(position.key())).toBe(true);
      const wedge = `${position.key()}/${direction}`;
      expect(used.has(wedge)).toBe(false);
      used.add(wedge);
    }
  });
});

describe('group outlines', () => {
  const puzzle = openExample('sudoku').puzzle;
  const layout = LAYOUTS.sudoku(puzzle);
  const outline = (name: string) => {
    const group = puzzle.getConstraintGroups().find((g) => g.getName() === name)!;
    const cells = new Set(group.getCells());
    return outlineEdges(layout.cells.filter((s) => cells.has(s.cell)));
  };

  it('draw the border of a box', () => {
    expect(outline('Block 5')).toHaveLength(12);
  });

  it('draw a column across the gaps between the blocks', () => {
    // two long sides of 9 cell edges each, plus the top and the bottom
    const edges = outline('Column 4');
    expect(edges).toHaveLength(20);
    const horizontal = edges.filter(([a, b]) => a.y === b.y);
    expect(horizontal).toHaveLength(2);
  });

  it('draw a Futoshiki row along its bent edges', () => {
    const { puzzle: futoshiki, relations, layout: futoshikiLayout } = relationsOf('futoshiki');
    const row = futoshiki.getConstraintGroups().find((g) => g.getName() === 'Row 2')!;
    const cells = new Set(row.getCells());
    const size = row.getCells().length;
    // a bend on the border of the row turns one edge into four
    const across = relations.filter(
      (r) => cells.has(r.greaterCell!) !== cells.has(r.lesserCell!),
    ).length;
    expect(across).toBeGreaterThan(0);
    const edges = outlineEdges(futoshikiLayout.cells.filter((s) => cells.has(s.cell)));
    expect(edges).toHaveLength(2 * size + 2 + 3 * across);
  });

  it('draw every edge of a single cell', () => {
    expect(outlineEdges([layout.cells[0]!])).toHaveLength(4);
  });
});
