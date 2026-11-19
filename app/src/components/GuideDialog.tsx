// The rules of a puzzle type and the techniques that help to solve it. Opened from the toolbar,
// from a card on the start page, and from "About this technique" after a hint or step (then
// at that technique).
import type { PuzzleType, TechniqueGuide, TechniqueId } from '@constraintpuzzler/core';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';

import { guideContent, toggleTechnique } from '../logic/guide';
import { COLORS } from '../theme';
import { Button } from './Controls';

export function GuideDialog({
  type,
  technique = null,
  onClose,
}: {
  /** the puzzle type to explain; null hides the dialog */
  type: PuzzleType | null;
  /** the technique to open at */
  technique?: TechniqueId | null;
  onClose: () => void;
}) {
  if (type === null) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <GuideBody type={type} technique={technique} onClose={onClose} />
    </Modal>
  );
}

function GuideBody({
  type,
  technique,
  onClose,
}: {
  type: PuzzleType;
  technique: TechniqueId | null;
  onClose: () => void;
}) {
  const content = guideContent(type, technique);
  const [opened, setOpened] = useState(content.opened);
  const scroll = useRef<ScrollViewInstance>(null);
  // scroll to the technique asked about, once its place is known
  const scrolled = useRef(content.opened === null);
  const techniquesY = useRef(0);

  return (
    <View style={styles.backdrop}>
      <View style={styles.dialog} accessibilityRole="summary" testID="guide">
        <Text style={styles.title}>{content.title}</Text>
        <ScrollView ref={scroll} contentContainerStyle={styles.body}>
          <Text style={styles.text}>{content.goal}</Text>
          <View style={styles.section}>
            <Text style={styles.heading}>Rules</Text>
            {content.rules.map((rule) => (
              <Text key={rule} style={styles.text}>
                {`• ${rule}`}
              </Text>
            ))}
          </View>
          <View
            style={styles.section}
            onLayout={(event) => {
              techniquesY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.heading}>Techniques, easiest first</Text>
            {content.techniques.map((entry) => (
              <TechniqueEntry
                key={entry.id}
                entry={entry}
                open={opened === entry.id}
                onToggle={() => setOpened(toggleTechnique(opened, entry.id))}
                onLayout={(y) => {
                  if (scrolled.current || entry.id !== content.opened) return;
                  scrolled.current = true;
                  scroll.current?.scrollTo({ y: techniquesY.current + y, animated: false });
                }}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.buttons}>
          <Button label="Close" onPress={onClose} testID="guide-close" />
        </View>
      </View>
    </View>
  );
}

function TechniqueEntry({
  entry,
  open,
  onToggle,
  onLayout,
}: {
  entry: TechniqueGuide;
  open: boolean;
  onToggle: () => void;
  onLayout: (y: number) => void;
}) {
  return (
    <View
      style={[styles.entry, open && styles.entryOpen]}
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      testID={`technique-${entry.id}`}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        aria-expanded={open}
        accessibilityLabel={entry.name}
        style={styles.entryHeader}
      >
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
        <View style={styles.entryTitle}>
          <Text style={styles.name}>{entry.name}</Text>
          <Text style={styles.summary}>{entry.summary}</Text>
        </View>
      </Pressable>
      {open && (
        <View style={styles.entryBody}>
          {entry.steps.map((step) => (
            <Text key={step} style={styles.text}>
              {`• ${step}`}
            </Text>
          ))}
          {entry.example !== undefined && (
            <Text style={styles.example}>{`Example: ${entry.example}`}</Text>
          )}
        </View>
      )}
    </View>
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
    maxWidth: 560,
    maxHeight: '90%',
    width: '100%',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  body: { gap: 14 },
  section: { gap: 4 },
  heading: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  entry: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  entryOpen: { backgroundColor: COLORS.panel },
  entryHeader: { flexDirection: 'row', gap: 8, padding: 10 },
  chevron: { fontSize: 14, color: COLORS.muted, lineHeight: 20, width: 12 },
  entryTitle: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  summary: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
  entryBody: { gap: 4, paddingHorizontal: 30, paddingBottom: 10 },
  example: { fontSize: 13, color: COLORS.text, fontStyle: 'italic', lineHeight: 19 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
