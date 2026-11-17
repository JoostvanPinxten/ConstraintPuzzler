// The board geometry of every puzzle type (as the former PySide6 GUI smoke tests checked it).
import {
  CellGreaterThanCellConstraint,
  PUZZLE_TYPES,
  TotalSumValueConstraint,
  type PuzzleTypeName,
} from '@constraintpuzzler/core';

import { openExample } from '../puzzles/open';
import {
  clueLayout,
  framePositions,
  hintGrid,
  inequalitySign,
  LAYOUTS,
  type Point,
} from './layout';

const center = (points: readonly Point[]): Point => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
});

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
    const centers = layout.cells.map((s) => center(s.outline));
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

describe('futoshiki', () => {
  it('has a sign pointing to the lesser cell for every inequality', () => {
    const puzzle = openExample('futoshiki').puzzle;
    const layout = LAYOUTS.futoshiki(puzzle);
    const shapes = new Map(layout.cells.map((s) => [s.cell, s]));
    const signs = layout.decorations.filter((d) => d.kind === 'polyline');
    const relations = puzzle
      .getConstraints()
      .filter(
        (c): c is CellGreaterThanCellConstraint => c instanceof CellGreaterThanCellConstraint,
      );
    expect(signs).toHaveLength(relations.length);
    relations.forEach((relation, i) => {
      const sign = signs[i]!;
      if (sign.kind !== 'polyline') throw new Error('not a sign');
      const tip = sign.points[1]!;
      const lesser = shapes.get(relation.lesserCell!)!.valueCenter;
      const greater = shapes.get(relation.greaterCell!)!.valueCenter;
      expect(Math.hypot(tip.x - lesser.x, tip.y - lesser.y)).toBeLessThan(
        Math.hypot(tip.x - greater.x, tip.y - greater.y),
      );
    });
  });

  it('needs two distinct cells for a sign', () => {
    expect(() => inequalitySign({ x: 0, y: 0 }, { x: 0, y: 0 }, 5, 5)).toThrow();
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
