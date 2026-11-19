// The colour-blind friendly shapes of the colours of a nonogram.
import { BLACK_AND_WHITE, type PaletteColor } from '@constraintpuzzler/core';

import { COLOR_SYMBOLS, colorSymbols, hasSeveralColors, symbolOf, symbolPoints } from './symbols';

const palette = (colors: number): PaletteColor[] => [
  { value: 0, name: 'blank', hex: '#ffffff' },
  ...Array.from({ length: colors }, (_, i) => ({
    value: i + 1,
    name: `c${i + 1}`,
    hex: '#000000',
  })),
];

describe('colour symbols', () => {
  it('gives every colour its own shape, in the order of the palette', () => {
    const three = palette(3);
    expect([0, 1, 2, 3].map((v) => symbolOf(three, v))).toEqual([
      null,
      'circle',
      'triangle',
      'square',
    ]);
    expect(symbolOf(three, 9)).toBeNull();
    expect(new Set(colorSymbols(three)?.values()).size).toBe(3);
  });

  it('repeats the shapes when there are more colours than shapes', () => {
    const many = palette(COLOR_SYMBOLS.length + 1);
    expect(symbolOf(many, COLOR_SYMBOLS.length + 1)).toBe('circle');
  });

  it('only helps with several colours', () => {
    expect(hasSeveralColors(BLACK_AND_WHITE)).toBe(false);
    expect(hasSeveralColors(null)).toBe(false);
    expect(colorSymbols(BLACK_AND_WHITE)).toBeUndefined();
    expect(colorSymbols(null)).toBeUndefined();
    expect(hasSeveralColors(palette(2))).toBe(true);
  });

  it.each(COLOR_SYMBOLS)('draws a %s inside its square', (symbol) => {
    const points = symbolPoints(symbol, { x: 10, y: 20 }, 8);
    expect(points.length).toBeGreaterThanOrEqual(3);
    for (const p of points) {
      expect(Math.abs(p.x - 10)).toBeLessThanOrEqual(4 + 1e-9);
      expect(Math.abs(p.y - 20)).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it('draws different outlines for different shapes', () => {
    const outlines = COLOR_SYMBOLS.map((s) => JSON.stringify(symbolPoints(s, { x: 0, y: 0 }, 10)));
    expect(new Set(outlines).size).toBe(COLOR_SYMBOLS.length);
  });
});
