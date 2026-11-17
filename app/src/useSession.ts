import { useSyncExternalStore } from 'react';

import type { PuzzleSession } from './logic/session';

/** Render again whenever the session changes; returns the session's version. */
export function useSession(session: PuzzleSession): number {
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.version,
  );
}
