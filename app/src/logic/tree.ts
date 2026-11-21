/**
 * The tree that presents a puzzle: the puzzle holds the grid (with its cells) and the
 * constraint groups; each group holds its constraints and references to its cells. Selecting a
 * node selects a puzzle part, which the board highlights and the info panel describes.
 * (Ported from gui/puzzlemodel/puzzletreemodel.py of the former PySide6 app.)
 */
import {
  msg,
  type Cell,
  type Constraint,
  type ConstraintGroup,
  type Puzzle,
} from '@constraintpuzzler/core';

import { formatCore, i18n, type AppKey } from '../i18n';

/** The names of the kinds of constraints (Constraint.getType) in the catalog. */
const CONSTRAINT_TYPES: Readonly<Record<string, AppKey>> = {
  'Unique Value Constraint': 'type.unique',
  'Exact cover constraint': 'type.exactCover',
  'Total Sum Value Constraint': 'type.sum',
  'Cell Greater Than Cell Constraint': 'type.greater',
  'Runs Constraint': 'type.runs',
};

/** The kind of a constraint in the player's language, e.g. "Unique Value Constraint". */
export function constraintType(constraint: Constraint): string {
  const key = CONSTRAINT_TYPES[constraint.getType()];
  return key === undefined ? constraint.getType() : i18n.t(key);
}

/** A value as the player sees it: its name (e.g. a colour) or the number. */
function valueName(puzzle: Puzzle, value: number): string {
  const name = puzzle.valueNameMessage(value);
  return typeof name === 'object' ? formatCore(name) : String(name);
}

export type Selection =
  | { readonly kind: 'puzzle' }
  | { readonly kind: 'grid' }
  | { readonly kind: 'cell'; readonly cell: Cell }
  | { readonly kind: 'group'; readonly group: ConstraintGroup }
  | { readonly kind: 'constraint'; readonly constraint: Constraint };

export interface TreeNode {
  /** unique within the tree */
  readonly id: string;
  readonly label: string;
  /** what kind of part it is, e.g. "Cell" or "Unique Value Constraint" */
  readonly type: string;
  readonly selection: Selection;
  readonly children: readonly TreeNode[];
}

export function buildPuzzleTree(puzzle: Puzzle): TreeNode {
  const cells = puzzle.getGrid().getCells();
  const cellNode = (cell: Cell, id: string): TreeNode => ({
    id,
    label: cell.getName(),
    type: i18n.t('tree.cell'),
    selection: { kind: 'cell', cell },
    children: [],
  });
  const grid: TreeNode = {
    id: 'grid',
    label: i18n.t('tree.grid'),
    type: i18n.t('tree.grid'),
    selection: { kind: 'grid' },
    children: cells.map((cell, i) => cellNode(cell, `cell:${i}`)),
  };
  const groups = puzzle.getConstraintGroups().map((group, g): TreeNode => ({
    id: `group:${g}`,
    label: formatCore(group.nameMessage()),
    type: i18n.t('tree.group'),
    selection: { kind: 'group', group },
    children: [
      ...group.getConstraints().map((constraint, k): TreeNode => ({
        id: `group:${g}/constraint:${k}`,
        label: formatCore(constraint.summaryMessage()),
        type: constraintType(constraint),
        selection: { kind: 'constraint', constraint },
        children: [],
      })),
      ...group.getCells().map((cell) => cellNode(cell, `group:${g}/cell:${cells.indexOf(cell)}`)),
    ],
  }));
  return {
    id: 'puzzle',
    label: puzzle.name,
    type: i18n.t('tree.puzzle'),
    selection: { kind: 'puzzle' },
    children: [grid, ...groups],
  };
}

/** The cells a selection is about. */
export function selectionCells(puzzle: Puzzle, selection: Selection): Cell[] {
  switch (selection.kind) {
    case 'puzzle':
      return [];
    case 'grid':
      return puzzle.getGrid().getCells();
    case 'cell':
      return [selection.cell];
    case 'group':
      return selection.group.getCells();
    case 'constraint':
      return selection.constraint.group.getCells();
  }
}

/** E.g. "9 cells: 4 filled, 5 open". */
export function cellCounts(cells: readonly Cell[]): string {
  const filled = cells.filter((c) => c.hasValue()).length;
  return i18n.t('tree.cellCounts', {
    total: cells.length,
    filled,
    open: cells.length - filled,
  });
}

export interface Description {
  readonly title: string;
  /** e.g. "(constraint group)" after the title */
  readonly kind?: string;
  readonly lines: readonly string[];
  /** listed below the lines, e.g. the rules of a group */
  readonly bullets?: readonly string[];
}

/** The value or the candidates of a cell and its groups (no candidates without hints). */
export function describeCell(cell: Cell, showHints: boolean): Description {
  let state: string;
  if (cell.hasValue()) {
    const puzzle = cell.getGrid().getPuzzle();
    state = i18n.t('tree.value', {
      value: valueName(puzzle, cell.getValue() as number),
      source: i18n.t(`source.${cell.getSource() ?? 'given'}`),
    });
  } else if (!showHints) {
    state = i18n.t('tree.open');
  } else {
    const values = cell.getGrid().getPuzzle().valueList(cell.values);
    state = i18n.t('tree.candidates', { values: formatCore(msg('values.list', { values })) });
  }
  const groups = cell.constraintGroups.map((g) => formatCore(g.nameMessage()));
  return {
    title: i18n.t('tree.cellTitle', { cell: cell.getName() }),
    lines:
      groups.length > 0 ? [state, i18n.t('tree.inGroups', { groups: groups.join(', ') })] : [state],
  };
}

export function describeSelection(
  puzzle: Puzzle,
  selection: Selection,
  showHints: boolean,
): Description {
  switch (selection.kind) {
    case 'puzzle':
      return {
        title: puzzle.name,
        lines: [
          cellCounts(puzzle.getGrid().getCells()),
          i18n.t('tree.groupCount', { total: puzzle.getConstraintGroups().length }),
        ],
      };
    case 'grid':
      return { title: i18n.t('tree.grid'), lines: [cellCounts(puzzle.getGrid().getCells())] };
    case 'cell':
      return describeCell(selection.cell, showHints);
    case 'group':
      return {
        title: formatCore(selection.group.nameMessage()),
        kind: i18n.t('tree.groupKind'),
        lines: [cellCounts(selection.group.getCells())],
        bullets: selection.group
          .getConstraints()
          .map((c) => formatCore(c.describeMessage(showHints))),
      };
    case 'constraint': {
      const { constraint } = selection;
      const group = constraint.group;
      return {
        title: formatCore(constraint.summaryMessage()),
        kind: constraintType(constraint),
        lines: [
          formatCore(constraint.describeMessage(showHints)),
          i18n.t('tree.groupLine', {
            group: formatCore(group.nameMessage()),
            counts: cellCounts(group.getCells()),
          }),
        ],
      };
    }
  }
}
