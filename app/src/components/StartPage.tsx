// The start page: what the app is, then a card per puzzle type (a preview of its example, its
// rule, and buttons to open an example or a file, or to read its rules), the settings and the version.
import { LANGUAGES, PUZZLE_TYPES, type PuzzleType } from '@constraintpuzzler/core';
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
import { useTranslation } from 'react-i18next';

import type { PuzzleSession } from '../logic/session';
import { openErrorMessage, openExample, pickPuzzleFile } from '../puzzles/open';
import { useSettings } from '../settings';
import { BRAND, COLORS } from '../theme';
import icon from '../../assets/icon.png';
import { BoardPreview } from './BoardPreview';
import { GuideDialog } from './GuideDialog';
import { Button, Toggle } from './Controls';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

const FEATURES = ['start.featureHints', 'start.featureSteps', 'start.featureOwn'] as const;

export function StartPage({ onOpen }: { onOpen: (session: PuzzleSession) => void }) {
  const [error, setError] = useState<string | null>(null);
  // the puzzle type whose rules are shown
  const [guide, setGuide] = useState<PuzzleType | null>(null);
  const { settings, update } = useSettings();
  const { t } = useTranslation();
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
              {t('start.tagline')}
            </Text>
          </View>
        </View>
        <View style={[styles.heroInner, styles.features]}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.feature}>
              <Text style={styles.featureText}>{t(feature)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.page}>
        <Text style={styles.sectionTitle}>{t('start.pick')}</Text>
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
              onRules={() => setGuide(type)}
            />
          ))}
        </View>

        <View style={styles.settings}>
          <Text style={styles.sectionTitle}>{t('start.settings')}</Text>
          <Toggle
            label={t('start.celebrate')}
            value={settings.celebrate}
            onChange={(celebrate) => update({ celebrate })}
          />
          <View style={styles.languages} accessibilityRole="radiogroup">
            <Text style={styles.languageLabel}>{t('start.language')}</Text>
            {(['system', ...LANGUAGES.map((language) => language.code)] as const).map((code) => (
              <Button
                key={code}
                label={
                  code === 'system'
                    ? t('start.languageSystem')
                    : (LANGUAGES.find((language) => language.code === code)?.name ?? code)
                }
                active={settings.language === code}
                onPress={() => update({ language: code })}
                testID={`language-${code}`}
              />
            ))}
          </View>
        </View>
        <Text style={styles.about}>{t('start.about', { version: appVersion() })}</Text>
      </View>
      <GuideDialog type={guide} onClose={() => setGuide(null)} />
    </ScrollView>
  );
}

function PuzzleCard({
  type,
  onOpenExample,
  onOpenFile,
  onRules,
}: {
  type: PuzzleType;
  onOpenExample: (label: string) => void;
  onOpenFile: () => void;
  onRules: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpenExample(type.defaultExample)}
        accessibilityRole="button"
        accessibilityLabel={t('start.play', { type: type.label, example: type.defaultExample })}
        style={({ pressed }) => [styles.preview, pressed && styles.previewActive]}
      >
        <BoardPreview type={type} height={150} />
      </Pressable>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{type.label}</Text>
        <Text style={styles.rule}>{t(`rule.${type.name}`)}</Text>
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
          <Button label={t('start.openFile')} onPress={onOpenFile} />
          <Button
            label={t('toolbar.rules')}
            onPress={onRules}
            accessibilityLabel={t('toolbar.rulesOf', { type: type.label })}
            testID={`rules-${type.name}`}
          />
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
  languages: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  languageLabel: { color: COLORS.text, fontSize: 14, marginRight: 4 },
  about: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
});
