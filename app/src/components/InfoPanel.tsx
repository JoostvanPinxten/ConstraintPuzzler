// Explains the selection: its description, a broken rule, messages, and the
// legend of the highlight colours. (The label below the tree in the desktop app.)
import { StyleSheet, Text, View } from 'react-native';

import {
  HighlightRole,
  legend,
  REASON_GROUP_COLOR,
  REASON_GROUP_LABEL,
  roleColor,
  RULED_OUT_COLOR,
  RULED_OUT_LABEL,
  TECHNIQUE_GROUP_LABEL,
  TECHNIQUE_RULED_OUT_LABEL,
} from '../logic/highlight';
import type { PuzzleSession } from '../logic/session';
import { describeSelection } from '../logic/tree';
import { PlacementsView } from './PlacementsView';
import { useSettings } from '../settings';
import { COLORS } from '../theme';
import { useSession } from '../useSession';

export function InfoPanel({ session }: { session: PuzzleSession }) {
  useSession(session);
  const { settings } = useSettings();
  const selection = session.selection;
  const cell = session.selectedCell();
  const note = cell !== null ? session.game.violationNote(cell, session.violations()) : null;
  const entries = legend(session.highlight().values());
  const technique = session.shownFinding !== null;

  return (
    <View style={styles.panel} testID="info">
      {selection === null && session.stepMessage === null && (
        <Text style={styles.muted}>
          Tap a cell in the puzzle, or select a cell, group or rule in the list, to see its cells
          and rules.
        </Text>
      )}
      {selection !== null && <Description session={session} showHints={settings.showHints} />}
      {note !== null && <Text style={styles.error}>{note}</Text>}
      {session.inputMessage !== null && <Text style={styles.error}>{session.inputMessage}</Text>}
      {session.stepMessage !== null && <Text style={styles.italic}>{session.stepMessage}</Text>}
      {session.hintPlacements !== null && (
        <PlacementsView session={session} diagram={session.hintPlacements} />
      )}
      {session.solving !== null && (
        <Text style={styles.italic}>
          {session.solving === 'solve' ? 'Solving…' : 'Finding the solution…'}
        </Text>
      )}
      {(entries.length > 0 || session.hintRuledOut.size > 0) && (
        <View style={styles.legend}>
          {entries.map(({ color, label }) => (
            <View key={label} style={styles.legendEntry}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
          {session.hintReasonGroups.size > 0 && (
            <View style={styles.legendEntry}>
              <View style={[styles.swatch, styles.reasonGroupSwatch]} />
              <Text style={styles.legendText}>
                {technique ? TECHNIQUE_GROUP_LABEL : REASON_GROUP_LABEL}
              </Text>
            </View>
          )}
          {session.hintRuledOut.size > 0 && (
            <View style={styles.legendEntry}>
              <View style={[styles.swatch, styles.ruledOutSwatch]} />
              <Text style={styles.legendText}>
                {technique ? TECHNIQUE_RULED_OUT_LABEL : RULED_OUT_LABEL}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Description({ session, showHints }: { session: PuzzleSession; showHints: boolean }) {
  if (session.selection === null) return null;
  const d = describeSelection(session.puzzle, session.selection, showHints);
  return (
    <View style={styles.description}>
      <Text style={styles.text}>
        <Text style={styles.bold}>{d.title}</Text>
        {d.kind !== undefined ? ` (${d.kind})` : ''}
      </Text>
      {d.lines.map((line, i) => (
        <Text key={i} style={styles.text}>
          {line}
        </Text>
      ))}
      {d.bullets?.map((line, i) => (
        <Text key={`b${i}`} style={styles.text}>
          {`• ${line}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  description: { gap: 2 },
  text: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '600' },
  italic: { color: COLORS.text, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  muted: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  error: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendEntry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 12, height: 12, borderWidth: 1, borderColor: COLORS.border },
  ruledOutSwatch: {
    borderStyle: 'dashed',
    borderColor: RULED_OUT_COLOR,
    backgroundColor: '#ffffff',
  },
  reasonGroupSwatch: {
    borderWidth: 2,
    borderColor: REASON_GROUP_COLOR,
    backgroundColor: roleColor(HighlightRole.REASON_GROUP),
  },
  legendText: { color: COLORS.text, fontSize: 13 },
});
