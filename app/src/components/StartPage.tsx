// The start page: open an example or a puzzle file of every type, and what the app is.
import { PUZZLE_TYPES } from '@constraintpuzzler/core';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PuzzleSession } from '../logic/session';
import { openErrorMessage, openExample, pickPuzzleFile } from '../puzzles/open';
import { useSettings } from '../settings';
import { COLORS } from '../theme';
import { Button, Toggle } from './Controls';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

export function StartPage({ onOpen }: { onOpen: (session: PuzzleSession) => void }) {
  const [error, setError] = useState<string | null>(null);
  const { settings, update } = useSettings();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title} accessibilityRole="header">
        ConstraintPuzzler
      </Text>
      <Text style={styles.intro}>
        Solve number puzzles yourself, with hints that explain the next step, or let the solver do
        it. Pick a puzzle to start.
      </Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {Object.values(PUZZLE_TYPES).map((type) => (
        <View key={type.name} style={styles.type}>
          <Text style={styles.typeTitle}>{type.label}</Text>
          <View style={styles.buttons}>
            {Object.keys(type.examples).map((label) => (
              <Button
                key={label}
                label={label}
                primary={label === type.defaultExample}
                onPress={() => {
                  setError(null);
                  onOpen(openExample(type.name, label));
                }}
                testID={`open-${type.name}-${label}`}
              />
            ))}
            <Button
              label="Open file…"
              onPress={() => {
                setError(null);
                pickPuzzleFile(type)
                  .then((session) => session !== null && onOpen(session))
                  .catch((e: unknown) => setError(openErrorMessage(e)));
              }}
            />
          </View>
        </View>
      ))}
      <View style={styles.type}>
        <Text style={styles.typeTitle}>Settings</Text>
        <Toggle
          label="Confetti when you finish a puzzle"
          value={settings.celebrate}
          onChange={(celebrate) => update({ celebrate })}
        />
      </View>
      <Text style={styles.about}>
        {`Version ${appVersion()} · Puzzles are described as constraints over a grid of cells, and solved by propagating them.`}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  intro: { fontSize: 16, color: COLORS.text, lineHeight: 23 },
  error: { color: COLORS.danger, fontSize: 14 },
  type: {
    gap: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#ffffff',
  },
  typeTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  about: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
});
