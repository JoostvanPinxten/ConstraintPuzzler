# Moving from PySide6 to React Native

The goal is one code base that runs on iOS, Android, the web, Windows, macOS and Linux. React
Native cannot run Python, so the puzzle engine (`structure/`, `constraints/`, `solver/`,
`parsers/`, `utility/puzzletypes.py`) is ported to TypeScript in `packages/core`. The PySide6
app stays in the repository, and in CI, until the React Native app does everything it does; then
the Python code is removed.

## Decisions

- **Engine:** a 1:1 TypeScript port in `packages/core`, with the same class and method names, so
  the Python file is the specification. It imports no React / React Native (a test checks that
  `src/` only has relative imports), like the Python engine imports no PySide6.
- **App:** Expo (React Native) for iOS, Android and the web, with the board drawn with
  `react-native-svg`.
- **Desktop:** the Expo web build in a Tauri shell (Windows, macOS, Linux), not
  react-native-windows/macos: those need bare React Native, have no Linux, and lag behind React
  Native releases.
- **Solving in the background:** instead of a `QThread`, the solver's search is written as
  generators that yield where Python calls `_checkStop()`. `solve()`/`findSolution()` run them to
  the end; `solveAsync()`/`findSolutionAsync()` yield to the event loop every few milliseconds
  and stop on an `AbortSignal` (the puzzle is restored, as with `shouldStop`).

## Phases

| Phase | What | Status |
| --- | --- | --- |
| 0 | npm workspaces, TypeScript/ESLint/Prettier/vitest, Node CI job | done |
| 1 | Engine port with the Python tests ported, plus golden fixtures | done |
| 2 | Expo app shell and Sudoku end to end (board, input, notes, undo, hints, solve, check) | done |
| 3 | Kakuro, Futoshiki and Sumbrero boards | done |
| 4 | Packaging: web (GitHub Pages), Tauri desktop, Android APK on each GitHub Release (`app-builds.yml`, called by `release.yml`) | done; iOS still needs an Apple developer account (EAS) |
| 5 | Parity sign-off; remove the Python code, PyInstaller, the PySide6 Android build and uv; update CLAUDE.md and skills | done (branch `feature/react-native-remove-python`; the examples moved to `puzzles/`) |

## The app

- `app/`: the Expo (React Native) app. `src/logic/` is plain TypeScript, tested without
  rendering: `session.ts` (`PuzzleSession`: selection, typing, notes, undo, hints, Step,
  Solve/Check in the background on a detached copy, dialogs as `notice`), `layout.ts` (the board
  geometry per puzzle type), `highlight.ts` and `tree.ts`. `src/components/` renders them
  (`Board.tsx` with react-native-svg). The example puzzles are bundled in
  `src/puzzles/examples.generated.ts` (`npm run examples -w @constraintpuzzler/app` after
  changing one; a test checks it). Settings are kept with AsyncStorage.
- `desktop/`: Tauri v2 shell that shows `app/dist`. Needs Rust; `npm run build -w
  @constraintpuzzler/desktop` exports the web build and makes the installers.
- `e2e/`: Playwright tests of the web export (desktop and phone sizes).

Running it: `npm run web -w @constraintpuzzler/app` (browser), `npm run android|ios -w
@constraintpuzzler/app` (Expo Go or a development build), `npm run dev -w
@constraintpuzzler/desktop` (desktop window). Testing: `npm test` (vitest + jest), and
`npm run export:web -w @constraintpuzzler/app && npx playwright test`.

### Parity checklist (phase 5 gate)

On web, one desktop build and one phone: all 4 types load (examples and files); enter, clear and
notes; mistakes and broken rules in red; undo/redo; Solve with cancel; hint levels; Step; Check
with marks; Show hints; Allow guessing; the list of groups and rules with descriptions; version.
The Playwright tests cover this on the web build (Chromium, desktop and phone sizes); the desktop
installers and the APK are built in CI, but have to be tried by hand.

## Removing the Python app (phase 5)

Once the parity checklist passes, remove the PySide6 app and everything that builds it:

- the Python code: `gui/`, the `*Main.py` entry points, `structure/`, `constraints/`, `solver/`,
  `parsers/`, `utility/` and their tests (keep `packages/core/fixtures/` as regression data, and
  `tools/export_fixtures.py` goes with the Python engine);
- the PyInstaller build: `constraintpuzzler.spec` and the `build` job of `release.yml`;
- **the PySide6 Android build** (merged from main for v0.2.0): the `android/` folder
  (`build_apk.sh`, `main.py`, `slim_wheel.py`, tests), the `android` job of `release.yml` (and
  `needs: [build, android]` of the publish job), the `ANDROID_DEBUG_KEYSTORE` repository secret,
  `"android"` in pyright's `include` in `pyproject.toml`, and the `project-metadata.toml` fallback
  in `utility/version.py`. Its replacement is the EAS Android build of phase 4, which must also
  attach a sideloadable APK to every GitHub Release, so releases keep an Android download;
- uv: `pyproject.toml`, `uv.lock`, the Python CI jobs, `.pre-commit-config.yaml`'s ruff hooks and
  `.claude/hooks/ruff_on_edit.py`;
- docs: the README's download section (the Windows/Linux/macOS archives and the Android APK
  become the Tauri installers and the EAS APK), CLAUDE.md, and the `/test`, `/new-constraint` and
  `/new-puzzle` skills, rewritten for the TypeScript code base.

Until then the PySide6 Android build keeps shipping, so releases are never without an Android
download.

Still open from phase 0: moving the example `*.txt` files to a `puzzles/` folder (when the app
needs to bundle them) and running ESLint/Prettier from pre-commit.

## Golden fixtures

`tools/export_fixtures.py` records what the Python engine makes of every example puzzle in
`packages/core/fixtures/*.json`: the parsed structure, the values one deduction pass determines
(with their difficulty and cause), the fixpoint of propagation without guessing, and the solution
with its uniqueness. `packages/core/test/fixtures.test.ts` checks that the TypeScript engine
reaches the same results. Only order-independent facts are recorded, because the Python solver
iterates cells hashed by identity, so the order of its deduction log differs between runs.

Since phase 5 the Python engine and `tools/export_fixtures.py` are gone (see the git history up
to v0.2.0), so the fixtures are frozen regression data. If a deliberate change to the engine or an
example changes a result, update the fixture by hand and explain why in the commit.

## Porting conventions

- `None` becomes `null`; Python sets of cells become `Set<Cell>`, dicts keyed by cells `Map`s.
- Where Python iterates a set of small numbers (which CPython does in ascending order), the
  TypeScript code iterates `sortedValues(...)`, so both engines take the same order.
- Context managers (`Puzzle.recording`, `causedBy`) take a callback; `beginRecording()` returns
  the function that ends it, for the generator-based solver.
- `PuzzleState` is a plain object (`cells` with sorted candidates, `constraints`); compare
  states with `statesEqual()`/`stateKey()`.
- `Game` also has `subscribe()` and a `revision` counter, for the React UI
  (`useSyncExternalStore`), instead of the per-cell Qt signal wiring.
