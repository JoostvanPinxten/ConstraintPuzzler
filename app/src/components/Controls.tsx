// Buttons and switches: the toolbar of a puzzle and the number pad.
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { PuzzleSession } from '../logic/session';
import { useSettings } from '../settings';
import { COLORS } from '../theme';
import { useSession } from '../useSession';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** drawn as pressed in (e.g. notes mode on) */
  readonly active?: boolean;
  readonly primary?: boolean;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  disabled,
  active,
  primary,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const highlighted = active || primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        highlighted && styles.buttonActive,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, highlighted && styles.buttonTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Toolbar({ session }: { session: PuzzleSession }) {
  useSession(session);
  const { settings, update } = useSettings();
  const busy = session.solving !== null;
  return (
    <View style={styles.row}>
      <Button label="Undo" onPress={() => session.undo()} disabled={!session.canUndo()} />
      <Button label="Redo" onPress={() => session.redo()} disabled={!session.canRedo()} />
      <Button
        label={session.hintLabel()}
        onPress={() => session.hint()}
        disabled={busy}
        testID="hint"
      />
      <Button
        label="Step"
        onPress={() => session.solveStep(settings)}
        disabled={busy}
        testID="step"
      />
      <Button
        label={session.solving === 'solve' ? 'Cancel' : 'Solve'}
        onPress={() => void session.solve(settings)}
        disabled={session.solving === 'check'}
        primary={session.solving === 'solve'}
        testID="solve"
      />
      <Button
        label={session.solving === 'check' ? 'Cancel' : 'Check'}
        onPress={() => (session.solving === 'check' ? session.cancel() : void session.check())}
        disabled={session.solving === 'solve'}
        testID="check"
      />
      <View style={styles.switches}>
        <Toggle
          label="Show hints"
          value={settings.showHints}
          onChange={(showHints) => update({ showHints })}
        />
        <Toggle
          label="Allow guessing"
          value={settings.allowGuessing}
          onChange={(allowGuessing) => update({ allowGuessing })}
        />
      </View>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
      <Text style={styles.toggleText}>{label}</Text>
    </View>
  );
}

/** The values of the puzzle, Clear and the notes switch, for touch screens (and mice). */
export function NumberPad({ session }: { session: PuzzleSession }) {
  useSession(session);
  const cell = session.selectedCell();
  const disabled = cell === null || cell.isGiven();
  return (
    <View style={styles.row}>
      {session.puzzle.getValues().map((value) => (
        <Button
          key={value}
          label={String(value)}
          onPress={() => session.typeDigit(value)}
          disabled={disabled}
          testID={`pad-${value}`}
        />
      ))}
      <Button label="Clear" onPress={() => session.clearSelected()} disabled={disabled} />
      <Button
        label="Notes"
        onPress={() => session.toggleNotesMode()}
        active={session.notesMode}
        accessibilityLabel={session.notesMode ? 'Notes mode on' : 'Notes mode off'}
        testID="notes"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  button: {
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: COLORS.text, fontSize: 15 },
  buttonTextActive: { color: COLORS.accentText },
  switches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginLeft: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { color: COLORS.text, fontSize: 14 },
});
