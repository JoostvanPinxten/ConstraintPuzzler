// Type-checks the keys of the app's catalog: t('toolbar.undo') compiles, a typo does not.
import 'i18next';

import type en from './locales/en/app.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'app';
    keySeparator: false;
    nsSeparator: false;
    resources: { app: typeof en };
  }
}
