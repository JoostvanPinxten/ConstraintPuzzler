// The solver settings shared by all open puzzles, remembered between runs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
