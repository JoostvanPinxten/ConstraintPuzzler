# ConstraintPuzzler

A TypeScript / React Native app that solves number puzzles (Sudoku, Kakuro, Futoshiki, Jidoku, Sumbrero and Nonogram) by describing them as constraints over a grid of cells and then propagating those constraints. It runs on the web, as a desktop app (Windows, macOS, Linux) and on Android (iOS needs an Apple developer account). It was a PySide6 (Python) app until v0.2.0; `doc/react-native-migration.md` describes the move.

## Layout
An npm workspace with three packages:
- `packages/core/` (`@constraintpuzzler/core`): the puzzle engine, with no UI. **`src/` must only use relative imports** (no React / React Native / Node APIs; a test checks this).
  - `src/structure/`: the model. `Puzzle` holds a `Grid` of `Cell`s, and every `Cell` tracks its possible values (`values`, a `Set`). Positions are `Position` (use `key()` for Maps/Sets). Cells notify observers via the synchronous `Signal` (`valueChanged`, `possibleValuesChanged`); exceptions thrown in callbacks propagate, which the solver relies on. Each cell records where its value came from (`ValueSource`: given, entered, deduced, guessed). `game.ts`'s `Game` is the play state on top of a puzzle: the user's entries and mistakes (`entries.ts`), the user's notes (`toggleNote`/`notesOf`, apart from the solver's candidates) and an undo/redo history of snapshots; `subscribe()`/`revision` tell a UI about changes. `Game.check(solution)` compares the shown values and notes with a solution (`CheckResult`); the solution is cached in `Game.solution`. `PuzzleState` (from `saveState()`) is a plain object; compare with `statesEqual`/`stateKey`.
  - `src/constraints/`: the `Constraint` base class plus implementations (unique value, exact cover, total sum, greater-than, and runs: the blocks of a nonogram line, whose values are colours with 0 as blank). `ConstraintGroup` groups constraints over sets of cells. A constraint that detects an unsolvable state throws `ContradictionError`.
  - `src/techniques/`: deductions over several constraint groups, which a single constraint cannot make: the `Technique` base class, `IntersectionRemoval` (pointing / box-line) and the fish `XWing`, `Swordfish`, `Jellyfish`, all over the groups with an `ExactCoverConstraint`; `TECHNIQUES` lists the defaults. A technique only removes candidates, one finding per `apply()`, and is the `cause` of its deductions (`Cause = Constraint | Technique`).
  - `src/solver/solver.ts`: repeats deduction until nothing changes; after the first pass it only re-applies the constraint groups of the cells that changed. When the constraints change nothing, it tries the techniques (easiest first, `applyTechnique()`); `new Solver(puzzle, guessing, [])` uses the constraints only (as the fixture tests do). With `allowGuessing` it backtracks, restoring the puzzle with `saveState()`/`restoreState()` on a contradiction. The long-running parts are generators that yield where they may stop: `solve()`/`findSolution()` run them synchronously (optional `shouldStop`), `solveAsync()`/`findSolutionAsync()` in slices with an `AbortSignal`; cancelling throws `SolveCancelled` and restores the puzzle. Every change is recorded in `solver.log` as a `Deduction` (cell, removed candidates or value, causing constraint, `reason()`), via `puzzle.recording(log, fn)`/`causedBy(constraint, fn)`. `hint()` returns the next deducible value without changing the puzzle, `solveStep(preferred)` fills in one (`lastStep`); both pick one of the easiest of `deducibleValues()` (`Deduction.difficulty()`: a single candidate left, else the cause's `difficultyOf(deduction)`, by default its static `difficulty`). **Those values must follow directly from the current state** (a single candidate, or one constraint applied on its own), so their explanation holds for what the user sees; a whole pass is not used for them, as it relies on candidates removed earlier in the same pass (issue #32). When no value follows directly, `solveStep` keeps the removals of a pass up to its first value, or, when the pass changes nothing, applies one technique. `countSolutions(limit)` checks uniqueness. Constraints explain their changes with `explain(deduction)`. `src/solver/hints.ts`'s `HintSession` reveals a hint in levels: the region, the cell, then the value and why.
  - `src/parsers/`: one module per type, each with `parse<Type>Lines(lines, filename?)` returning a `Puzzle`; `common.ts` holds `PuzzleFileError` and the `parseRange`/`parsePosition`/`parseIndex` helpers; `sumbrero.ts` also holds the hexagon line geometry.
  - `src/puzzletypes.ts`: the registry of puzzle types (`PUZZLE_TYPES`: name, label, `parseLines`, file extensions, examples, default example) and `parsePuzzle(type, text)`. The app, the tests and the bundled examples all read it. `src/puzzlefactory.ts` builds puzzles (empty Sudoku, empty Futoshiki, example Kakuro, single-constraint test puzzles).
  - `fixtures/`: the results of the original Python engine for every example (frozen); `test/fixtures.test.ts` keeps the engine honest against them.
- `app/` (`@constraintpuzzler/app`): the Expo (SDK 58) React Native app for iOS, Android and the web. **Expo changes between SDKs: read `app/AGENTS.md` and the versioned Expo docs before using an Expo API, and add packages with `npx expo install`.**
  - `src/logic/`: the screen behaviour without UI, tested without rendering. `session.ts`'s `PuzzleSession` is one open puzzle: selection, `pressKey`/`typeDigit`, notes mode, undo/redo, hint levels, Step, and Solve/Check in the background on a detached copy (re-parsed from the source, then `Game.applySolution`), cancellable; dialogs are data (`notice`). Every change while playing goes through it (and so through a `Game` action); components never mutate the puzzle. `layout.ts` is the board geometry per puzzle type (`LAYOUTS`: cells as polygons with a hint area, plus decorations); `highlight.ts` the highlight roles (selection, hint region, Check marks) and legend; `tree.ts` the list of groups and rules and their descriptions.
  - `src/components/`: React components that render a session (`useSession` subscribes to it); `Board.tsx` draws with react-native-svg. `src/settings.tsx`: Show hints / Allow guessing, shared by all tabs, kept with AsyncStorage. `App.tsx`: start page plus one tab per open puzzle.
  - `src/puzzles/examples.generated.ts`: the example files, bundled; regenerate with `npm run examples -w @constraintpuzzler/app` (a test checks it is current).
  - `app.config.ts`: the Expo config; the version comes from the root `package.json`, `EXPO_BASE_URL` sets the web base path.
- `desktop/` (`@constraintpuzzler/desktop`): a Tauri v2 shell around `app/dist` (needs Rust; no puzzle logic in Rust).
- `e2e/`: Playwright tests of the web export (desktop and phone sizes); `e2e/serve.mjs` serves `app/dist`.
- `puzzles/`: the example puzzle files. `doc/`: the constraint and file format docs.

## Tooling
Node 22+ and npm workspaces (`package.json` + `package-lock.json`). Don't use yarn or pnpm.
```
npm ci                                       # install everything
npm run web -w @constraintpuzzler/app        # the app in a browser (android / ios: Expo)
npm run dev -w @constraintpuzzler/desktop    # the desktop window (needs Rust)
npm run export:web -w @constraintpuzzler/app # static web build in app/dist
npm version patch --no-git-tag-version       # bump the version (root package.json)
```
- The version is only defined in the root `package.json`; the app config and `tauri.conf.json` read it. Never hard-code version strings.
- Releases: pushing a tag `vX.Y.Z` (must equal the version) runs `.github/workflows/release.yml`, which calls `app-builds.yml` (web export + Playwright, Pages artifact, Tauri installers for Windows/macOS/Linux with a Linux smoke test, debug-signed Android APK) and publishes a GitHub Release plus GitHub Pages.

## Checks (what CI runs)
```
npm run typecheck     # tsc, every workspace
npm run lint          # ESLint (typescript-eslint strict) + prettier --check; `npm run format` fixes
npm test              # vitest (packages/core, coverage thresholds in vitest.config.ts) + jest (app)
npm run export:web -w @constraintpuzzler/app && npx playwright test   # app-builds.yml
```
- Tests: engine tests in `packages/core/test/**/*.test.ts` (vitest), app tests next to the code in `app/src/**/*.test.ts(x)` (jest-expo; Testing Library 14, where `render` and `fireEvent` are async), browser tests in `e2e/`.
- Fix lint findings rather than disabling rules. TypeScript is strict (core also uses `noUncheckedIndexedAccess`): narrow `T | null` / `T | undefined` before use.

## Skills (slash commands)
- `/test`: run all checks like CI and summarise.
- `/new-constraint <Name> <rule>`: scaffold a `Constraint` subclass with tests.
- `/new-puzzle <name>`: scaffold a new puzzle type (parser, example file, layout, tests).

## Conventions
- camelCase method names, as in the original code base (`getValue()`, `applyConstraint()`); keep that style.
- `null` for "no value" in the engine (not `undefined`). Iterate candidate sets in a fixed order (`sortedValues(...)`), so the solver is deterministic.
- Keep UI logic in `app/src/logic/` (plain TypeScript, tested without rendering) and keep components thin.
- Prefer `Pressable`, `react-native-svg` and Expo modules that work on all platforms; check web (`npm run web`) and a narrow (phone) window when changing the UI.

## Review focus
When reviewing changes, prioritise: correctness of constraint propagation and possible-value bookkeeping, solver termination and cancellation (the puzzle must be restored), grid coordinate off-by-ones, deterministic ordering, the engine staying free of platform imports, React state that bypasses `PuzzleSession`/`Game`, platform differences (web, Android, iOS, desktop), and missing tests.
