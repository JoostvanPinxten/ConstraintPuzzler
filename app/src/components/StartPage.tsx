// The start page: what the app is, then a card per puzzle type (a preview of its example, its
// rule, and buttons to open an example or a file), the settings and the version.
import { PUZZLE_TYPES, type PuzzleType, type PuzzleTypeName } from '@constraintpuzzler/core';
import Constants from 'expo-constants';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { PuzzleSession } from '../logic/session';
import { openErrorMessage, openExample, pickPuzzleFile } from '../puzzles/open';
import { useSettings } from '../settings';
import { BRAND, COLORS } from '../theme';
import icon from '../../assets/icon.png';
import { BoardPreview } from './BoardPreview';
import { Button, Toggle } from './Controls';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

/** The rule of each puzzle type, in one line. */
export const PUZZLE_RULES: Readonly<Record<PuzzleTypeName, string>> = {
  sudoku: '1 to 9 once in every row, column and 3×3 box.',
  kakuro: 'Fill the runs so they add up to their clues, without repeating a digit.',
  futoshiki: 'A Latin square: every row and column once, and every < and > holds.',
  jidoku: 'Sudoku without given numbers: only < and > between neighbours in a box.',
  sumbrero:
    "Follow each clue's triangle: the hexagons in that direction add up to the clue, without repeating a digit.",
  nonogram:
    'Fill in cells so every row and column has blocks of the lengths of its clue, in that order.',
};

const FEATURES = ['Hints that explain why', 'Solve step by step', 'Create your own puzzles'];

export function StartPage({ onOpen }: { onOpen: (session: PuzzleSession) => void }) {
  const [error, setError] = useState<string | null>(null);
  const { settings, update } = useSettings();
  // a phone: a smaller header, so the name fits on one line
  const compact = useWindowDimensions().width < 480;
  const openFile = (type: PuzzleType) => {
    setError(null);
    pickPuzzleFile(type)
      .then((session) => session !== null && onOpen(session))
      .catch((e: unknown) => setError(openErrorMessage(e)));
  };
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={styles.heroInner}>
          <Image
            source={icon}
            style={[styles.mark, compact && styles.markCompact]}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.heroText}>
            <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
              Constraint<Text style={styles.titleAccent}>Puzzler</Text>
            </Text>
            <Text style={[styles.tagline, compact && styles.taglineCompact]}>
              Solve number puzzles by deduction, with hints that explain the next step, or watch the
              solver do it.
            </Text>
          </View>
        </View>
        <View style={[styles.heroInner, styles.features]}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.feature}>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.page}>
        <Text style={styles.sectionTitle}>Pick a puzzle</Text>
        {error !== null && <Text style={styles.error}>{error}</Text>}
        <View style={styles.grid}>
          {Object.values(PUZZLE_TYPES).map((type) => (
            <PuzzleCard
              key={type.name}
              type={type}
              onOpenExample={(label) => {
                setError(null);
                onOpen(openExample(type.name, label));
              }}
              onOpenFile={() => openFile(type)}
            />
          ))}
        </View>

        <View style={styles.settings}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Toggle
            label="Confetti when you finish a puzzle"
            value={settings.celebrate}
            onChange={(celebrate) => update({ celebrate })}
          />
        </View>
        <Text style={styles.about}>
          {`Version ${appVersion()} · Puzzles are described as constraints over a grid of cells, and solved by propagating them.`}
        </Text>
      </View>
    </ScrollView>
  );
}

function PuzzleCard({
  type,
  onOpenExample,
  onOpenFile,
}: {
  type: PuzzleType;
  onOpenExample: (label: string) => void;
  onOpenFile: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpenExample(type.defaultExample)}
        accessibilityRole="button"
        accessibilityLabel={`Play ${type.label} (${type.defaultExample})`}
        style={({ pressed }) => [styles.preview, pressed && styles.previewActive]}
      >
        <BoardPreview type={type} height={150} />
      </Pressable>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{type.label}</Text>
        <Text style={styles.rule}>{PUZZLE_RULES[type.name]}</Text>
        <View style={styles.buttons}>
          {Object.keys(type.examples).map((label) => (
            <Button
              key={label}
              label={label}
              primary={label === type.defaultExample}
              onPress={() => onOpenExample(label)}
              testID={`open-${type.name}-${label}`}
            />
          ))}
          <Button label="Open file…" onPress={onOpenFile} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  hero: { backgroundColor: BRAND.navy, paddingVertical: 28, paddingHorizontal: 20, gap: 18 },
  heroInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  markCompact: { width: 48, height: 48, borderRadius: 11 },
  heroText: { flex: 1, gap: 6 },
  title: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  titleCompact: { fontSize: 24 },
  titleAccent: { color: BRAND.amber },
  tagline: { fontSize: 16, lineHeight: 23, color: BRAND.mist },
  taglineCompact: { fontSize: 14, lineHeight: 20 },
  features: { flexWrap: 'wrap', gap: 8 },
  feature: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  featureText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  page: { padding: 20, gap: 14, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  error: { color: COLORS.danger, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    maxWidth: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  preview: {
    backgroundColor: COLORS.panel,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  previewActive: { backgroundColor: '#e8edf8' },
  cardBody: { padding: 14, gap: 8, flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  rule: { fontSize: 14, lineHeight: 20, color: COLORS.muted, flexGrow: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  settings: {
    gap: 8,
    padding: 14,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#ffffff',
  },
  about: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
});
