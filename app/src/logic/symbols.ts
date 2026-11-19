/**
 * Colour-blind friendly marks for the colours of a nonogram: every colour also gets a shape,
 * so two colours that look alike (e.g. red and green, for red-green colour blindness) can still
 * be told apart. The shapes are polygons, so the board, the clues and the colour pad draw them
 * the same way.
 */
import { BLANK, type PaletteColor, type Value } from '@constraintpuzzler/core';

import type { Point } from './layout';

export const COLOR_SYMBOLS = [
  'circle',
  'triangle',
  'square',
  'diamond',
  'plus',
  'star',
  'hexagon',
  'triangleDown',
] as const;
export type ColorSymbol = (typeof COLOR_SYMBOLS)[number];

/**
 * The shape of a colour: by its place among the colours of the palette (BLANK has none). With
 * more colours than shapes, the shapes repeat.
 */
export function symbolOf(palette: readonly PaletteColor[], value: Value): ColorSymbol | null {
  if (value === BLANK) return null;
  const index = palette.filter((c) => c.value !== BLANK).findIndex((c) => c.value === value);
  if (index < 0) return null;
  return COLOR_SYMBOLS[index % COLOR_SYMBOLS.length] as ColorSymbol;
}

/**
 * The shape of every colour of the palette (value -> shape); undefined when there is at most one
 * colour, as symbols do not help then.
 */
export function colorSymbols(
  palette: readonly PaletteColor[] | null,
): ReadonlyMap<Value, ColorSymbol> | undefined {
  if (palette === null || !hasSeveralColors(palette)) return undefined;
  const symbols = new Map<Value, ColorSymbol>();
  for (const color of palette) {
    const symbol = symbolOf(palette, color.value);
    if (symbol !== null) symbols.set(color.value, symbol);
  }
  return symbols;
}

/** Whether colour symbols help: the palette has more than one colour. */
export function hasSeveralColors(palette: readonly PaletteColor[] | null): boolean {
  return (palette ?? []).filter((c) => c.value !== BLANK).length > 1;
}

const polygon = (corners: number, center: Point, radius: number, turn = -Math.PI / 2): Point[] =>
  Array.from({ length: corners }, (_, k) => ({
    x: center.x + radius * Math.cos(turn + (2 * Math.PI * k) / corners),
    y: center.y + radius * Math.sin(turn + (2 * Math.PI * k) / corners),
  }));

/** The outline of a shape that fits in a square of `size` around `center`. */
export function symbolPoints(symbol: ColorSymbol, center: Point, size: number): Point[] {
  const r = size / 2;
  const { x, y } = center;
  switch (symbol) {
    case 'circle':
      return polygon(20, center, r * 0.9);
    case 'triangle':
      // centred on its height, so it looks centred in the cell
      return polygon(3, { x, y: y + r * 0.15 }, r);
    case 'triangleDown':
      return polygon(3, { x, y: y - r * 0.15 }, r, Math.PI / 2);
    case 'square':
      return polygon(4, center, r * 1.15, -Math.PI / 4);
    case 'diamond':
      return polygon(4, center, r);
    case 'hexagon':
      return polygon(6, center, r, 0);
    case 'star':
      return Array.from({ length: 10 }, (_, k) => {
        const radius = k % 2 === 0 ? r : r * 0.45;
        const angle = -Math.PI / 2 + (Math.PI * k) / 5;
        return { x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle) };
      });
    case 'plus': {
      const t = r * 0.36; // half the width of a bar
      return [
        { x: x - t, y: y - r },
        { x: x + t, y: y - r },
        { x: x + t, y: y - t },
        { x: x + r, y: y - t },
        { x: x + r, y: y + t },
        { x: x + t, y: y + t },
        { x: x + t, y: y + r },
        { x: x - t, y: y + r },
        { x: x - t, y: y + t },
        { x: x - r, y: y + t },
        { x: x - r, y: y - t },
        { x: x - t, y: y - t },
      ];
    }
  }
}
