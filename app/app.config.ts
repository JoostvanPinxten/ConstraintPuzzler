// The Expo app config. The version comes from the root package.json (the single source of the
// version); EXPO_BASE_URL sets the path the web build is served from (e.g. /ConstraintPuzzler
// on GitHub Pages; the desktop build and local runs use /).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';

const rootPackage = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')) as {
  version: string;
};

const config: ExpoConfig = {
  name: 'ConstraintPuzzler',
  slug: 'constraintpuzzler',
  version: rootPackage.version,
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#f5f6f8',
  ios: { supportsTablet: true, bundleIdentifier: 'io.github.joostvanpinxten.constraintpuzzler' },
  android: {
    package: 'io.github.joostvanpinxten.constraintpuzzler',
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#22306b' },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', output: 'single', name: 'ConstraintPuzzler' },
  experiments: process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {},
};

export default config;
