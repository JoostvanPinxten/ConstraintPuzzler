// One open puzzle: the board with the toolbar and number pad, and the list of puzzle parts with
// the info panel. Side by side on wide screens, stacked on phones.
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { PuzzleSession } from '../logic/session';
import { COLORS } from '../theme';
import { useSession } from '../useSession';
import { useSettings } from '../settings';
import { Board } from './Board';
import { Confetti } from './Confetti';
import { ConstraintTree } from './ConstraintTree';
import { Button, NumberPad, Toolbar } from './Controls';
import { HelpDialog } from './HelpDialog';
import { InfoPanel } from './InfoPanel';
import { NoticeDialog } from './NoticeDialog';
import { ProgressBar } from './ProgressBar';

/** Typing on a hardware keyboard (web and desktop): values, notes, arrows, undo and redo. */
function useKeyboard(session: PuzzleSession, active: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target !== null && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (session.notice !== null) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (ctrl && (key === 'y' || (key === 'z' && event.shiftKey))) {
        session.redo();
      } else if (ctrl && key === 'z') {
        session.undo();
      } else if (!session.pressKey(event.key, ctrl)) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [session, active]);
}

export function PuzzleScreen({
  session,
  active = true,
}: {
  session: PuzzleSession;
  active?: boolean;
}) {
  useSession(session);
  const [showParts, setShowParts] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  useKeyboard(session, active && !showHelp);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const help = <HelpDialog visible={showHelp} onClose={() => setShowHelp(false)} />;

  const board = (
    <View style={wide ? styles.boardWide : styles.boardNarrow}>
      <Board session={session} />
    </View>
  );
  const { settings } = useSettings();
  const progress = <ProgressBar session={session} />;
  const confetti = <Confetti burst={session.finishedCount} enabled={settings.celebrate} />;
  const controls = (
    <View style={styles.controls}>
      <Toolbar session={session} onHelp={() => setShowHelp(true)} />
      <NumberPad session={session} />
    </View>
  );

  if (wide) {
    return (
      <View style={styles.wide}>
        <View style={styles.main}>
          {controls}
          {progress}
          {board}
        </View>
        <View style={styles.side}>
          <InfoPanel session={session} />
          <ConstraintTree session={session} />
        </View>
        {confetti}
        <NoticeDialog session={session} />
        {help}
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.narrow}>
        {progress}
        {board}
        {controls}
        <InfoPanel session={session} />
        <Button
          label={showParts ? 'Hide groups and rules' : 'Show groups and rules'}
          onPress={() => setShowParts(!showParts)}
        />
        {showParts && (
          <View style={styles.treeNarrow}>
            <ConstraintTree session={session} />
          </View>
        )}
        <Text style={styles.footer}>{session.title}</Text>
      </ScrollView>
      {confetti}
      <NoticeDialog session={session} />
      {help}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wide: { flex: 1, flexDirection: 'row', gap: 12, padding: 12 },
  main: { flex: 3, gap: 10 },
  side: { flex: 2, maxWidth: 420, gap: 10 },
  controls: { gap: 8 },
  boardWide: { flex: 1, minHeight: 300 },
  boardNarrow: { width: '100%', aspectRatio: 1 },
  narrow: { padding: 12, gap: 10 },
  treeNarrow: { height: 360 },
  footer: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
});
