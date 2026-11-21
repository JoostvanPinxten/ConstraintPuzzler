// How to play: entering values and notes, the keyboard, and what the toolbar does. Opened with
// the question mark button next to the switches.
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme';
import { Button } from './Controls';

const SECTIONS = [
  { title: 'help.values', lines: ['help.values1', 'help.values2'] },
  { title: 'help.notes', lines: ['help.notes1', 'help.notes2'] },
  { title: 'help.toolbar', lines: ['help.toolbar1', 'help.toolbar2', 'help.toolbar3'] },
  { title: 'help.switches', lines: ['help.switches1', 'help.switches2', 'help.switches3'] },
] as const;

export function HelpDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="summary" testID="help">
          <Text style={styles.title}>{t('help.title')}</Text>
          <ScrollView contentContainerStyle={styles.body}>
            {SECTIONS.map(({ title, lines }) => (
              <View key={title} style={styles.section}>
                <Text style={styles.heading}>{t(title)}</Text>
                {lines.map((line) => (
                  <Text key={line} style={styles.text}>
                    {`• ${t(line)}`}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={styles.buttons}>
            <Button label={t('dialog.close')} onPress={onClose} testID="help-close" />
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
