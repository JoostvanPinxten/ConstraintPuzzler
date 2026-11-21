// Native modules that do not exist under Jest: use the mocks the packages ship.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// SafeAreaProvider renders nothing until the native side reports the insets
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// the device language under Jest: English
jest.mock('expo-localization', () => {
  const locales = [{ languageTag: 'en-US', languageCode: 'en' }];
  return { getLocales: () => locales, useLocales: () => locales };
});
