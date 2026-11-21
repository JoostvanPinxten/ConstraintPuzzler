# Plan: multiple languages (English + Dutch)

Done in a stack of seven PRs (#63–#69); how to add texts and languages is in
[translations.md](translations.md). This is the plan as it was made.

## What has to be translated

| Where | What | How it is built today |
|---|---|---|
| `app/App.tsx`, `app/src/components/*` | buttons, labels, dialogs, start page, help, legend | string literals in JSX |
| `app/src/logic/session.ts` | `Notice` titles/texts, hint/step messages, input errors | English strings stored in session state |
| `app/src/logic/tree.ts`, `highlight.ts`, `guide.ts` | group/rule descriptions, legend, Rules dialog | English strings |
| `packages/core/src/constraints/*`, `techniques/*` | `explain()`, `summary()`, `Finding.reason` | template strings with interpolated values and group names |
| `packages/core/src/structure/deduction.ts`, `solver/hints.ts` | `reason()`, hint `message()` | composed from the above |
| `packages/core/src/parsers/*`, puzzlefactory | group names (`Row 3`, `Box 2`, `Line`, `Relativity`), `PuzzleFileError` messages | English strings in the model |
| `ContradictionError` | contradiction messages (shown in the "cannot be solved" notice) | English strings |
| `packages/core/src/guide/rules.ts`, `techniques.ts` | goals, rules, technique names, summaries, steps | long English prose |
| `puzzletypes.ts` | type labels | mostly proper names; same in Dutch |

About 90 explain/summary/error sites in core and a few hundred UI literals. The hard part is not the
volume but that the **engine builds finished English sentences**, including the group names it
puts in them, so translation has to start by turning those into data.

Not translated: puzzle file formats and their keywords, `doc/`, example puzzle files, developer
logs and `toString()` debug output (`UVC[1,2]`).

## Decisions (recommended)

1. **JSON catalogs in i18next format, i18next in the app, no library in core.** More languages
   will follow, so translations live in plain JSON files (`locales/<lang>/<namespace>.json`) that
   translators and platforms such as Weblate or Crowdin can edit, rather than in TypeScript.
   - The app formats with `i18next` + `react-i18next` (CLDR plurals, interpolation, fallback to
     English, lazy loading per language).
   - Core may only use relative imports, so it does not depend on i18next: it emits `Message`s
     (id + params) and holds the English catalog as a relative JSON import, with a tiny English-only
     formatter for logs, `Error.message` and the existing tests.
   - The English formatter does not duplicate any text: it reads the same `en` JSON as i18next.
     To keep the two formatters from drifting, the catalogs may only use a small subset of the
     i18next syntax (`{{param}}` and `_one`/`_other` plural keys; no `$t()` nesting, no format
     functions), and a core test (tests may import i18next; only `src/` may not) formats every
     `en` message with sample parameters through both formatters and requires identical output.
   - Keys are type-checked by generating a TypeScript type from `en` JSON (i18next's
     `CustomTypeOptions`); a test checks every other language has the same keys and placeholders.
2. **`expo-localization`** in the app only, to pick the device language on first start
   (`npx expo install expo-localization`).
3. **Engine returns messages, not strings.** A `Message = { id, params }` where params may be
   numbers, value lists or other messages (e.g. a group name). Rendering happens at display time
   with `formatMessage(message, locale)`, so switching language re-renders existing hints and
   notices instead of leaving them in the old language. The existing string methods stay as thin
   English wrappers (`explain(d)` → `formatMessage(explainMessage(d), 'en')`) so tests, the
   solver log and fixtures do not churn.
4. **Group names become structured**: `GroupName = { kind: 'row' | 'column' | 'box' | 'line' | 'across' | 'down' | ..., index?: number }`
   on `ConstraintGroup`, with the current `name` string derived from it in English.
5. **Guide prose in the same JSON catalogs** (a `guide` namespace: rules + technique texts);
   `ExampleBoard`s and the technique id lists stay in TypeScript, shared. Missing translations
   fall back to English at runtime, but the completeness test requires every shipped language to
   be complete.
7. **Puzzle-type labels are deferred**: they are proper names (Sudoku, Kakuro, …) and stay as
   they are; translating them is a later, separate step.
6. **Language setting** next to Show hints / Allow guessing in `app/src/settings.tsx`:
   *System* (default), *English*, *Nederlands*; kept in AsyncStorage like the others.

## Phases

Each phase is its own PR, green on `npm run typecheck && npm run lint && npm test` and Playwright.

### 1. Infrastructure (core)
- `packages/core/src/i18n/`: `Message`, `MessageId` (typed from `en` JSON), the English-only
  formatter, list joining ("1, 2 and 3" / "1, 2 en 3" via i18next's `formatList` or
  `Intl.ListFormat` in the app); `locales/en/*.json` and `locales/nl/*.json`.
- `i18next` as a dev dependency of core, only for the test that compares the formatters.
- Test: every language has the same keys and placeholders as `en`.

### 2. App UI chrome + language setting
- `app/src/i18n/`: an i18next instance with `react-i18next` (`useTranslation`), loading the core
  catalogs (namespace `core`) and the app's own (`app`); `formatMessage(m, t)` for engine messages.
- Language setting in `settings.tsx` + `expo-localization` default; set `<html lang>` on web.
- Replace literals in `App.tsx` and `components/*` (StartPage, Controls, InfoPanel, HelpDialog,
  GuideDialog, ConstraintTree, PuzzleScreen, legend in `highlight.ts`).
- Jest: render one screen in Dutch; existing tests stay on English.

### 3. Session messages
- `Notice.title/text`, `stepMessage`, `inputMessage` become `Message`s; components format them.
- `session.ts` is a known refactor hotspot: split the notice/message building out (e.g.
  `logic/messages.ts`) while touching it.

### 4. Engine explanations (largest phase; can be split per constraint family)
- Structured group names in parsers and `puzzlefactory` (sudoku, jidoku, kakuro, futoshiki,
  sumbrero, nonogram); `tree.ts` formats them.
- `explainMessage()` / `summaryMessage()` on `Constraint` and the techniques; `Finding.reason`,
  `Deduction.reasonMessage()`, `HintSession.message()` return `Message`s.
- `runsconstraint.ts` (the other hotspot, ~630 lines) has most of the nonogram texts: split its
  explanation code into its own module first.
- Fixture tests must stay identical (they compare English output).

### 5. Errors
- `ContradictionError` and `PuzzleFileError` carry a `Message` (plus the English `message` for
  `Error`); the open-file and "cannot be solved" notices show them translated.

### 6. Guide content in Dutch
- Move the prose of `rules.ts` and `techniques.ts` into `locales/en/guide.json`, translate it
  into `locales/nl/guide.json`; `guideContent(type)` reads through i18next.
- Agree on a glossary first (below), so the guide, hints and UI use the same words.

### 7. Finish
- Playwright: one Dutch smoke test (switch language, open an example, take a hint).
- README / CLAUDE.md: how to add a string and a new language; app store/Tauri names unchanged.

## Draft Dutch glossary (to review)

| English | Dutch |
|---|---|
| cell / row / column / box | vakje / rij / kolom / blok |
| candidate, notes | kandidaat, notities |
| given, clue | gegeven, aanwijzing |
| hint, step, solve, check, undo, redo | hint, stap, oplossen, controleren, ongedaan maken, opnieuw |
| naked single / hidden single | enige kandidaat / verborgen single |
| naked pair/subset, hidden subset | naakt paar / naakte groep, verborgen groep |
| pointing / box-line (intersection) | wijzende paren / blok-lijn |
| X-Wing, Swordfish, Jellyfish | X-Wing, Swordfish, Jellyfish (gangbaar onvertaald) |
| run (kakuro), block (nonogram) | reeks, blok |
| contradiction, guess | tegenspraak, gok |

## Settled
- More languages will follow → JSON catalogs + i18next (decision 1).
- Puzzle-type labels and example names: deferred (decision 7).
