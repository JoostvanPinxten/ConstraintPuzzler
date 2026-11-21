// The settings shared by all open puzzles (solver switches, language), remembered between runs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { i18n } from './i18n';
import { resolveLanguage } from './logic/language';
import { DEFAULT_SETTINGS, type Settings } from './logic/session';

const KEY = 'constraintpuzzler.settings';

interface SettingsContextValue {
  readonly settings: Settings;
  readonly update: (changes: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (stored !== null)
          setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<Settings>) });
      })
      .catch(() => {}); // e.g. no storage: keep the defaults
  }, []);

  // the language: the chosen one or the device's (which can change while the app runs)
  const locales = useLocales();
  const language = resolveLanguage(
    settings.language,
    locales.map((locale) => locale.languageTag),
  );
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update: (changes) =>
        setSettings((current) => {
          const next = { ...current, ...changes };
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          return next;
        }),
    }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
