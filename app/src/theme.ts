// Colours, as in the former PySide6 app (gui/puzzlerepresentation/cellpiece.py, in the git history).
export const COLORS = {
  /** a value that is part of the puzzle as it was loaded */
  given: '#0000ff',
  /** a value the solver filled in */
  solver: '#000000',
  /** a value the user typed in */
  entered: '#00783c',
  /** a value that breaks a rule of the puzzle */
  violation: '#dc0000',
  /** the small values of an open cell: a note of the user, a candidate of the solver */
  note: '#00783c',
  candidate: '#6e6e6e',
  board: '#ffffff',
  text: '#1d1d1f',
  muted: '#5f6368',
  border: '#d0d4da',
  panel: '#f5f6f8',
  accent: '#2f6fde',
  accentText: '#ffffff',
  danger: '#c00000',
} as const;

// The colours of the logo (doc/logo): a navy badge with an amber piece.
export const BRAND = {
  navy: '#1f2a5c',
  amber: '#ffb43a',
  /** light text on navy */
  mist: '#c9d2f0',
} as const;
