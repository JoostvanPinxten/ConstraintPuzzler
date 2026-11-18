/**
 * Which cells to highlight, and in which colour. Every cell gets a role: e.g. the smaller and
 * the larger cell of a greater-than constraint, or the open and the solved cells of a group.
 * The role decides the colour, so the highlight shows how the cells take part in the
 * selection, not only which cells. (Ported from gui/highlighting.py of the former PySide6 app.)
 */
import { CellGreaterThanCellConstraint, type Cell, type Puzzle } from '@constraintpuzzler/core';

import { selectionCells, type Selection } from './tree';

/** How a cell takes part in the selection. A higher value wins when roles overlap. */
export const HighlightRole = {
  NONE: 0,
  /** shares a constraint group with the selected cell */
  PEER: 1,
  /** where a hint says to look */
  HINT: 2,
  /** cell of the selection without a value yet */
  OPEN: 3,
  /** cell of the selection that has a value */
  SOLVED: 4,
  /** the smaller cell of a greater-than constraint */
  LESSER: 5,
  /** the larger cell of a greater-than constraint */
  GREATER: 6,
  /** a placed number that leads to the hint's value (rules it out of the other cells) */
  REASON: 7,
  /** a value or notes that Check found to be wrong */
  WRONG: 8,
  /** the selected cell itself */
  SELECTED: 9,
} as const;
export type HighlightRole = (typeof HighlightRole)[keyof typeof HighlightRole];

/** [red, green, blue, alpha 0-255] per role, as in the desktop app */
const ROLE_RGBA: Record<HighlightRole, [number, number, number, number]> = {
  [HighlightRole.NONE]: [255, 255, 0, 0],
  [HighlightRole.PEER]: [255, 255, 0, 45],
  [HighlightRole.HINT]: [150, 110, 255, 80],
  [HighlightRole.OPEN]: [255, 255, 0, 110],
  [HighlightRole.SOLVED]: [90, 200, 90, 110],
  [HighlightRole.LESSER]: [70, 140, 255, 130],
  [HighlightRole.GREATER]: [255, 130, 30, 140],
  [HighlightRole.REASON]: [0, 170, 190, 120],
  [HighlightRole.WRONG]: [230, 40, 40, 120],
  [HighlightRole.SELECTED]: [255, 190, 0, 190],
};

export const ROLE_LABELS: Partial<Record<HighlightRole, string>> = {
  [HighlightRole.PEER]: 'shares a group with the cell',
  [HighlightRole.HINT]: 'where to look',
  [HighlightRole.OPEN]: 'open cell',
  [HighlightRole.SOLVED]: 'solved cell',
  [HighlightRole.LESSER]: 'smaller cell',
  [HighlightRole.GREATER]: 'larger cell',
  [HighlightRole.REASON]: 'rules the value out of the other cells',
  [HighlightRole.WRONG]: 'wrong according to Check',
  [HighlightRole.SELECTED]: 'selected cell',
};

/** The legend label of the hatched cells (see PuzzleSession.hintRuledOut). */
export const RULED_OUT_LABEL = 'value ruled out by a highlighted number';
/** The colour of the hatching. */
export const RULED_OUT_COLOR = '#4a5560';

/** The opaque colour (#rrggbb) a role shows on the white board. */
export function roleColor(role: HighlightRole): string {
  const [r, g, b, a] = ROLE_RGBA[role];
  const alpha = a / 255;
  const blend = (channel: number): string =>
    Math.round(channel * alpha + 255 * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${blend(r)}${blend(g)}${blend(b)}`;
}

function memberRoles(cells: Iterable<Cell>): Map<Cell, HighlightRole> {
  return new Map(
    [...cells].map((c) => [c, c.hasValue() ? HighlightRole.SOLVED : HighlightRole.OPEN]),
  );
}

/** The cells involved in a selection, with their role. */
export function highlightRoles(
  puzzle: Puzzle,
  selection: Selection | null,
): Map<Cell, HighlightRole> {
  if (selection === null) return new Map();
  switch (selection.kind) {
    case 'cell': {
      const roles = new Map<Cell, HighlightRole>();
      for (const group of selection.cell.constraintGroups) {
        for (const c of group.getCells()) roles.set(c, HighlightRole.PEER);
      }
      roles.set(selection.cell, HighlightRole.SELECTED);
      return roles;
    }
    case 'constraint': {
      const roles = memberRoles(selectionCells(puzzle, selection));
      const { constraint } = selection;
      if (constraint instanceof CellGreaterThanCellConstraint) {
        if (constraint.lesserCell) roles.set(constraint.lesserCell, HighlightRole.LESSER);
        if (constraint.greaterCell) roles.set(constraint.greaterCell, HighlightRole.GREATER);
      }
      return roles;
    }
    default:
      return memberRoles(selectionCells(puzzle, selection));
  }
}

/** Add cells with a role, keeping a stronger role a cell already has. */
export function mergeRole(
  roles: Map<Cell, HighlightRole>,
  cells: Iterable<Cell>,
  role: HighlightRole,
): void {
  for (const cell of cells) roles.set(cell, Math.max(role, roles.get(cell) ?? 0) as HighlightRole);
}

/** The legend for the roles in use, strongest first. */
export function legend(roles: Iterable<HighlightRole>): { color: string; label: string }[] {
  return [...new Set(roles)]
    .filter((role) => role !== HighlightRole.NONE)
    .sort((a, b) => b - a)
    .map((role) => ({ color: roleColor(role), label: ROLE_LABELS[role] ?? '' }));
}
