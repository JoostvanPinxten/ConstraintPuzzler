// How far the puzzle is filled in: a bar plus "filled / total" of the cells that were open.
import { StyleSheet, Text, View } from 'react-native';

import type { PuzzleSession } from '../logic/session';
import { COLORS } from '../theme';
import { useSession } from '../useSession';

export function ProgressBar({ session }: { session: PuzzleSession }) {
  useSession(session);
  const { filled, total } = session.progress();
  const fraction = total === 0 ? 1 : filled / total;
  const percent = Math.round(fraction * 100);
  const done = filled === total;

  return (
    <View
      style={styles.row}
      testID="progress"
      accessibilityRole="progressbar"
      accessibilityLabel="Cells filled in"
      accessibilityValue={{ min: 0, max: total, now: filled, text: `${filled} of ${total}` }}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${percent}%`, backgroundColor: done ? COLORS.entered : COLORS.accent },
          ]}
        />
      </View>
      <Text style={styles.label}>{`${filled} / ${total} (${percent}%)`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  label: { color: COLORS.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
});
