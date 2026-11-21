// Buttons and switches: the toolbar of a puzzle and the number pad.
import { paletteOf } from '@constraintpuzzler/core';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Polygon } from 'react-native-svg';

import { textColorOn } from '../logic/layout';
import { colorSymbols, hasSeveralColors, symbolPoints, type ColorSymbol } from '../logic/symbols';

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
  /** a colour shown in the button, next to the label (the colours of a nonogram) */
  readonly swatch?: string;
  /** the colour-blind friendly shape drawn on the swatch */
  readonly swatchSymbol?: ColorSymbol;
}

const SWATCH = 18;

/** A colour square, with the shape of the colour on it when colour symbols are on. */
function Swatch({ color, symbol }: { color: string; symbol: ColorSymbol | undefined }) {
  return (
    <View style={[styles.swatch, { backgroundColor: color }]}>
      {symbol !== undefined && (
        <Svg width={SWATCH - 2} height={SWATCH - 2} viewBox={`0 0 ${SWATCH - 2} ${SWATCH - 2}`}>
          <Polygon
            points={symbolPoints(
              symbol,
              { x: (SWATCH - 2) / 2, y: (SWATCH - 2) / 2 },
              SWATCH * 0.55,
            )
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill={textColorOn(color)}
          />
        </Svg>
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  active,
  primary,
  testID,
  accessibilityLabel,
  swatch,
  swatchSymbol,
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
      <View style={styles.buttonContent}>
        {swatch !== undefined && <Swatch color={swatch} symbol={swatchSymbol} />}
        <Text style={[styles.buttonText, highlighted && styles.buttonTextActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Toolbar({
  session,
  onHelp,
  onRules,
}: {
  session: PuzzleSession;
  onHelp: () => void;
  onRules: () => void;
}) {
  useSession(session);
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const busy = session.solving !== null;
  return (
    <View style={styles.row}>
      <Button
        label={t('toolbar.undo')}
        onPress={() => session.undo()}
        disabled={!session.canUndo()}
      />
      <Button
        label={t('toolbar.redo')}
        onPress={() => session.redo()}
        disabled={!session.canRedo()}
      />
      <Button
        label={session.hintLabel()}
        onPress={() => session.hint(settings)}
        disabled={busy}
        testID="hint"
      />
      <Button
        label={t('toolbar.step')}
        onPress={() => session.solveStep(settings)}
        disabled={busy}
        testID="step"
      />
      <Button
        label={t(session.solving === 'solve' ? 'toolbar.cancel' : 'toolbar.solve')}
        onPress={() => void session.solve(settings)}
        disabled={session.solving === 'check'}
        primary={session.solving === 'solve'}
        testID="solve"
      />
      <Button
        label={t(session.solving === 'check' ? 'toolbar.cancel' : 'toolbar.check')}
        onPress={() => (session.solving === 'check' ? session.cancel() : void session.check())}
        disabled={session.solving === 'solve'}
        testID="check"
      />
      <View style={styles.switches}>
        <Toggle
          label={t('toolbar.showHints')}
          value={settings.showHints}
          onChange={(showHints) => update({ showHints })}
        />
        <Toggle
          label={t('toolbar.allowGuessing')}
          value={settings.allowGuessing}
          onChange={(allowGuessing) => update({ allowGuessing })}
        />
        {hasSeveralColors(paletteOf(session.puzzle)) && (
          <Toggle
            label={t('toolbar.colorSymbols')}
            value={settings.colorSymbols}
            onChange={(colorSymbols) => update({ colorSymbols })}
          />
        )}
        <Button
          label={t('toolbar.rules')}
          onPress={onRules}
          accessibilityLabel={t('toolbar.rulesOf', { type: session.type.label })}
          testID="guide-open"
        />
        <Button
          label="?"
          onPress={onHelp}
          accessibilityLabel={t('toolbar.help')}
          testID="help-open"
        />
      </View>
    </View>
  );
}

export function Toggle({
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
  const { t } = useTranslation();
  const cell = session.selectedCell();
  const disabled = cell === null || cell.isGiven();
  // a nonogram: a swatch per colour, with its digit (for the keyboard) and name
  const palette = paletteOf(session.puzzle);
  const { settings } = useSettings();
  const symbols = settings.colorSymbols ? colorSymbols(palette) : undefined;
  return (
    <View style={styles.row}>
      {session.puzzle.getValues().map((value) => {
        const color = palette?.find((c) => c.value === value);
        return (
          <Button
            key={value}
            label={String(value)}
            onPress={() => session.typeDigit(value)}
            disabled={disabled}
            testID={`pad-${value}`}
            {...(color === undefined
              ? {}
              : {
                  swatch: color.hex,
                  accessibilityLabel: `${color.name} (${value})`,
                  ...(symbols?.has(value) ? { swatchSymbol: symbols.get(value) } : {}),
                })}
          />
        );
      })}
      <Button label={t('pad.clear')} onPress={() => session.clearSelected()} disabled={disabled} />
      <Button
        label={t('pad.notes')}
        onPress={() => session.toggleNotesMode()}
        active={session.notesMode}
        accessibilityLabel={t(session.notesMode ? 'pad.notesOn' : 'pad.notesOff')}
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
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: COLORS.text, fontSize: 15 },
  buttonTextActive: { color: COLORS.accentText },
  switches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginLeft: 6,
    // wrap the switches on a narrow (phone) screen instead of running off it
    flexShrink: 1,
    maxWidth: '100%',
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { color: COLORS.text, fontSize: 14 },
});
