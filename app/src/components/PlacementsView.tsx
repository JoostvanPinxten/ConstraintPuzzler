// The picture below a nonogram hint: the line now, then the placements of its blocks that
// explain the hint, with the hint's cell outlined (see logic/placements.ts).
import { BLANK, paletteOf, type PlacementDiagram, type Value } from '@constraintpuzzler/core';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polygon, Rect } from 'react-native-svg';

import { formatCore } from '../i18n';
import { HighlightRole, roleColor } from '../logic/highlight';
import { textColorOn } from '../logic/layout';
import { placementsCaption } from '../logic/placements';
import type { PuzzleSession } from '../logic/session';
import { colorSymbols, symbolPoints } from '../logic/symbols';
import { useSettings } from '../settings';
import { COLORS } from '../theme';

/** the colour of a cell that is still open in a line (or not part of the block shown) */
const OPEN_COLOR = '#e3e5e8';

export function PlacementsView({
  session,
  diagram,
}: {
  session: PuzzleSession;
  diagram: PlacementDiagram;
}) {
  const { settings } = useSettings();
  const palette = useMemo(() => paletteOf(session.puzzle) ?? [], [session]);
  const symbols = useMemo(
    () => (settings.colorSymbols ? colorSymbols(palette) : undefined),
    [palette, settings.colorSymbols],
  );
  const n = diagram.known.length;
  const lines: readonly (readonly (Value | null)[])[] = [diagram.known, ...diagram.rows];
  // the cells along a line, and the lines next to each other
  const s = diagram.vertical ? 14 : Math.max(8, Math.min(16, Math.floor(320 / n)));
  const gap = s / 2;
  const across = (l: number): number => l * s + (l > 0 ? gap : 0);
  const along = n * s;
  const depth = across(lines.length);
  const width = (diagram.vertical ? depth : along) + 2;
  const height = (diagram.vertical ? along : depth) + 2;
  const at = (l: number, j: number) =>
    diagram.vertical ? { x: across(l) + 1, y: j * s + 1 } : { x: j * s + 1, y: across(l) + 1 };
  const outline = roleColor(HighlightRole.SELECTED);
  const hex = (value: Value): string => palette.find((c) => c.value === value)?.hex ?? '#000000';

  const first = at(1, diagram.index);
  const last = at(lines.length - 1, diagram.index);
  return (
    <View style={styles.box} testID="hint-placements">
      <Text style={styles.caption}>
        {placementsCaption(diagram, (v) => {
          const name = session.puzzle.valueNameMessage(v);
          return typeof name === 'object' ? formatCore(name) : String(name);
        })}
      </Text>
      <Svg width={width} height={height}>
        {lines.map((line, l) =>
          line.map((value, j) => {
            const { x, y } = at(l, j);
            // for an overlap, the blocks other than the one shown are pale
            const span = l > 0 ? diagram.spans?.[l - 1] : undefined;
            const pale = span !== undefined && (j < span[0] || j > span[1]);
            const fill = value === null ? OPEN_COLOR : value === BLANK ? '#ffffff' : hex(value);
            const symbol = value !== null ? symbols?.get(value) : undefined;
            const center = { x: x + s / 2, y: y + s / 2 };
            return (
              <G key={`${l}-${j}`} opacity={pale ? 0.55 : 1}>
                <Rect
                  x={x}
                  y={y}
                  width={s}
                  height={s}
                  fill={fill}
                  stroke={COLORS.border}
                  strokeWidth={1}
                />
                {value === BLANK && (
                  <Circle cx={center.x} cy={center.y} r={s / 10} fill={COLORS.candidate} />
                )}
                {symbol !== undefined && (
                  <Polygon
                    points={symbolPoints(symbol, center, s * 0.5)
                      .map((p) => `${p.x},${p.y}`)
                      .join(' ')}
                    fill={textColorOn(fill)}
                  />
                )}
              </G>
            );
          }),
        )}
        {lines.length > 1 && (
          <Rect
            x={first.x}
            y={first.y}
            width={last.x - first.x + s}
            height={last.y - first.y + s}
            fill="none"
            stroke={outline}
            strokeWidth={2.5}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  caption: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
});
