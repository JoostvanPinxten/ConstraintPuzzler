/**
 * The tree that presents a puzzle: the puzzle holds the grid (with its cells) and the
 * constraint groups; each group holds its constraints and references to its cells. Selecting a
 * node selects a puzzle part, which the board highlights and the info panel describes.
 * (Ported from gui/puzzlemodel/puzzletreemodel.py of the former PySide6 app.)
 */
import type { Cell, Constraint, ConstraintGroup, Puzzle } from '@constraintpuzzler/core';

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
    type: 'Cell',
    selection: { kind: 'cell', cell },
    children: [],
  });
  const grid: TreeNode = {
    id: 'grid',
    label: 'Grid',
    type: 'Grid',
    selection: { kind: 'grid' },
    children: cells.map((cell, i) => cellNode(cell, `cell:${i}`)),
  };
  const groups = puzzle.getConstraintGroups().map((group, g): TreeNode => ({
    id: `group:${g}`,
    label: group.getName(),
    type: 'Constraint Group',
    selection: { kind: 'group', group },
    children: [
      ...group.getConstraints().map((constraint, k): TreeNode => ({
        id: `group:${g}/constraint:${k}`,
        label: constraint.summary(),
        type: constraint.getType(),
        selection: { kind: 'constraint', constraint },
        children: [],
      })),
      ...group.getCells().map((cell) => cellNode(cell, `group:${g}/cell:${cells.indexOf(cell)}`)),
    ],
  }));
  return {
    id: 'puzzle',
    label: puzzle.name,
    type: 'Puzzle',
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
  return `${cells.length} cells: ${filled} filled, ${cells.length - filled} open`;
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
    state = `Value: ${cell.getValue()} (${cell.getSource() ?? 'given'})`;
  } else if (!showHints) {
    state = 'Open';
  } else {
    state = `Candidates: ${[...cell.values].sort((a, b) => a - b).join(', ')}`;
  }
  const groups = cell.constraintGroups.map((g) => g.getName());
  return {
    title: `Cell ${cell.getName()}`,
    lines: groups.length > 0 ? [state, `In groups: ${groups.join(', ')}`] : [state],
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
          `${puzzle.getConstraintGroups().length} constraint groups`,
        ],
      };
    case 'grid':
      return { title: 'Grid', lines: [cellCounts(puzzle.getGrid().getCells())] };
    case 'cell':
      return describeCell(selection.cell, showHints);
    case 'group':
      return {
        title: selection.group.getName(),
        kind: 'constraint group',
        lines: [cellCounts(selection.group.getCells())],
        bullets: selection.group.getConstraints().map((c) => c.describe(showHints)),
      };
    case 'constraint': {
      const { constraint } = selection;
      const group = constraint.group;
      return {
        title: constraint.summary(),
        kind: constraint.getType(),
        lines: [
          constraint.describe(showHints),
          `Group ${group.getName()}: ${cellCounts(group.getCells())}`,
        ],
      };
    }
  }
}
