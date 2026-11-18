// How to play: entering values and notes, the keyboard, and what the toolbar does. Opened with
// the question mark button next to the switches.
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../theme';
import { Button } from './Controls';

const SECTIONS: readonly { title: string; lines: readonly string[] }[] = [
  {
    title: 'Values',
    lines: [
      'Tap a cell (or use the arrow keys), then tap a number or type it to enter it.',
      'Clear, Delete or Backspace empties the cell.',
    ],
  },
  {
    title: 'Notes',
    lines: [
      'Turn on Notes (or press N) to note candidates: a number notes it, again removes it.',
      'Ctrl+number notes a candidate without turning on notes mode.',
    ],
  },
  {
    title: 'Toolbar',
    lines: [
      'Undo and Redo (Ctrl+Z, Ctrl+Y) step through your changes.',
      'Hint shows a bit more on every press: where to look, the cell, then the value and why.',
      'Step fills in one value, Solve the whole puzzle, Check compares your entries with the solution.',
    ],
  },
  {
    title: 'Switches',
    lines: [
      'Show hints: show the candidates that are left in open cells and in the descriptions.',
      'Allow guessing: let Step and Solve guess when nothing follows from the rules.',
    ],
  },
];

export function HelpDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="summary" testID="help">
          <Text style={styles.title}>How to play</Text>
          <ScrollView contentContainerStyle={styles.body}>
            {SECTIONS.map(({ title, lines }) => (
              <View key={title} style={styles.section}>
                <Text style={styles.heading}>{title}</Text>
                {lines.map((line) => (
                  <Text key={line} style={styles.text}>
                    {`• ${line}`}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={styles.buttons}>
            <Button label="Close" onPress={onClose} testID="help-close" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    maxWidth: 520,
    maxHeight: '90%',
    width: '100%',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  body: { gap: 12 },
  section: { gap: 2 },
  heading: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
