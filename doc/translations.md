# Languages and translations

The app is available in English and Dutch. It starts in the device's (or browser's) language
when it has it, and in English otherwise; the start page has a *Language* setting (device
language, English, Nederlands) that is remembered with the other settings.

## Where the texts are

All texts are in JSON catalogs in the [i18next](https://www.i18next.com/) format, one file per
language and part:

| File | What |
|---|---|
| `packages/core/src/i18n/locales/<language>/core.json` | the engine: explanations of deductions, hints, group names, descriptions of rules, Check results, errors |
| `packages/core/src/i18n/locales/<language>/guide.json` | the guide: the rules of every puzzle type and the techniques |
| `app/src/i18n/locales/<language>/app.json` | the app: buttons, dialogs, the start page, the legend, session messages |

Keys are flat, with dots in them (`"hint.cell": "Look at cell {{cell}}."`). The English catalogs
are the reference: every other language has exactly the same keys and placeholders, which the
tests check (`catalogProblems` in `packages/core/src/i18n/message.ts`).

Not translated: puzzle files and their keywords, the names in puzzle files (e.g. nonogram
colours), the names of the puzzle types and examples, `doc/`, and errors that only developers see.

## The syntax a text may use

The engine has no dependencies, so it formats English itself, with a formatter that supports
only part of the i18next syntax. A test compares it with i18next for every English text.

- `{{name}}` placeholders, filled in from the message's parameters. No spaces inside the
  braces, no formats (`{{value, number}}`) and no nesting (`$t(...)`).
- Plurals: `key_one` and `key_other` (and the other CLDR forms a language needs, e.g. `key_few`),
  chosen by the `count` parameter.

## Adding a language

1. Add it to `LANGUAGES` in `packages/core/src/i18n/message.ts` (code and its own name, e.g.
   `{ code: 'de', name: 'Deutsch' }`).
2. Copy the three English catalogs to `<code>/` and translate them; import them next to the
   others in `packages/core/src/i18n/message.ts` (`CORE_RESOURCES`) and `app/src/i18n/index.ts`
   (`APP_RESOURCES`).
3. Run `npm test`: the catalog tests list every missing or extra key and every placeholder that
   does not match.

## Adding a text

- **App**: add the key to `app/src/i18n/locales/*/app.json`. Components use
  `const { t } = useTranslation()` and `t('key', params)`, so they render again when the language
  changes; plain modules in `app/src/logic/` use `i18n.t`. Keys are type-checked.
- **Session messages** (notices, hints, input messages) are data, `UiMessage`s
  (`app/src/logic/messages.ts`), formatted with `formatUi` when shown.
- **Engine**: add the key to `packages/core/src/i18n/locales/*/core.json` and build a `Message`
  with `msg('key', params)`. Parameters can be numbers, plain text, other messages (e.g. a
  group's `nameMessage()`), value lists (`valueList`) and word lists (`andList`, `orList`,
  `commaList`, `semicolonList`). A constraint describes itself with `explainMessage`,
  `summaryMessage` and `describeMessage`; the string methods (`explain()`, `summary()`, ...)
  format those in English, for the solver log and the tests. Errors a player can see extend
  `MessageError`. The app formats engine messages with `formatCore`.
