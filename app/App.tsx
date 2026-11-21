// ConstraintPuzzler: a start page and one tab per open puzzle (like the desktop launcher).
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { PuzzleScreen } from './src/components/PuzzleScreen';
import { StartPage } from './src/components/StartPage';
import type { PuzzleSession } from './src/logic/session';
import { SettingsProvider } from './src/settings';
import { COLORS } from './src/theme';

export default function App() {
  const [sessions, setSessions] = useState<PuzzleSession[]>([]);
  // the open tab: an index into sessions, or -1 for the start page
  const [active, setActive] = useState(-1);

  const open = (session: PuzzleSession) => {
    setSessions((current) => [...current, session]);
    setActive(sessions.length);
  };
  const close = (index: number) => {
    sessions[index]?.cancel();
    setSessions((current) => current.filter((_, i) => i !== index));
    setActive((current) => (current === index ? -1 : current > index ? current - 1 : current));
  };
  const current = active >= 0 ? sessions[active] : undefined;
  const { t } = useTranslation();

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SafeAreaView style={styles.app}>
          <ScrollView horizontal style={styles.tabBar} contentContainerStyle={styles.tabs}>
            <Tab label={t('tabs.puzzles')} selected={active === -1} onPress={() => setActive(-1)} />
            {sessions.map((session, index) => (
              <Tab
                key={index}
                label={session.title}
                selected={index === active}
                onPress={() => setActive(index)}
                onClose={() => close(index)}
              />
            ))}
          </ScrollView>
          <View style={styles.content}>
            {current !== undefined ? (
              <PuzzleScreen key={active} session={current} />
            ) : (
              <StartPage onOpen={open} />
            )}
          </View>
          <StatusBar style="dark" />
        </SafeAreaView>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function Tab({
  label,
  selected,
  onPress,
  onClose,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.tab, selected && styles.tabSelected]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        style={styles.tabLabel}
      >
        <Text style={[styles.tabText, selected && styles.tabTextSelected]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      {onClose !== undefined && (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.close', { title: label })}
          style={styles.close}
        >
          <Text style={styles.tabText}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.panel },
  tabBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#ffffff',
  },
  tabs: { paddingHorizontal: 8, gap: 4, alignItems: 'flex-end' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    maxWidth: 240,
  },
  tabSelected: { borderBottomColor: COLORS.accent },
  tabLabel: { paddingHorizontal: 10, paddingVertical: 10 },
  tabText: { color: COLORS.muted, fontSize: 14 },
  tabTextSelected: { color: COLORS.text, fontWeight: '600' },
  close: { paddingHorizontal: 8, paddingVertical: 10 },
  content: { flex: 1 },
});
