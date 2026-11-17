// The puzzle tree, its descriptions and the highlight roles and legend.
import { CellGreaterThanCellConstraint } from '@constraintpuzzler/core';

import { openExample } from '../puzzles/open';
import { HighlightRole, highlightRoles, legend, mergeRole, roleColor } from './highlight';
import { buildPuzzleTree, describeCell, describeSelection } from './tree';

describe('puzzle tree', () => {
  const puzzle = openExample('sudoku').puzzle;
  const tree = buildPuzzleTree(puzzle);

  it('holds the grid and the groups', () => {
    expect(tree.children).toHaveLength(1 + 27);
    expect(tree.children[0]!.children).toHaveLength(81);
    const block = tree.children[1]!;
    expect(block.label).toBe('Block 1');
    expect(block.children.map((c) => c.type)).toEqual([
      'Exact cover constraint',
      ...Array(9).fill('Cell'),
    ]);
  });

  it('has unique ids', () => {
    const ids: string[] = [];
    const walk = (node: typeof tree) => {
      ids.push(node.id);
      node.children.forEach(walk);
    };
    walk(tree);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes the parts', () => {
    expect(describeSelection(puzzle, { kind: 'puzzle' }, true).lines[1]).toBe(
      '27 constraint groups',
    );
    expect(describeSelection(puzzle, { kind: 'grid' }, true).lines[0]).toMatch(
      /^81 cells: \d+ filled/,
    );
    const group = puzzle.getConstraintGroups()[0]!;
    const groupText = describeSelection(puzzle, { kind: 'group', group }, true);
    expect(groupText.kind).toBe('constraint group');
    expect(groupText.bullets?.[0]).toContain('Every value appears exactly once');
    const constraint = group.getConstraints()[0]!;
    expect(describeSelection(puzzle, { kind: 'constraint', constraint }, true).lines[1]).toContain(
      'Group Block 1',
    );
  });

  it('hides the candidates without hints', () => {
    const open = puzzle
      .getGrid()
      .getCells()
      .find((c) => !c.hasValue())!;
    expect(describeCell(open, true).lines[0]).toMatch(/^Candidates: /);
    expect(describeCell(open, false).lines[0]).toBe('Open');
    const given = puzzle
      .getGrid()
      .getCells()
      .find((c) => c.hasValue())!;
    expect(describeCell(given, false).lines[0]).toMatch(/^Value: \d \(given\)$/);
  });
});

describe('highlight roles', () => {
  it('colour the smaller and the larger cell of a greater-than', () => {
    const puzzle = openExample('futoshiki').puzzle;
    const constraint = puzzle
      .getConstraints()
      .find((c): c is CellGreaterThanCellConstraint => c instanceof CellGreaterThanCellConstraint)!;
    const roles = highlightRoles(puzzle, { kind: 'constraint', constraint });
    expect(roles.get(constraint.lesserCell!)).toBe(HighlightRole.LESSER);
    expect(roles.get(constraint.greaterCell!)).toBe(HighlightRole.GREATER);
  });

  it('let the strongest role win', () => {
    const puzzle = openExample('sudoku').puzzle;
    const cell = puzzle.getGrid().getCells()[0]!;
    const roles = highlightRoles(puzzle, { kind: 'cell', cell });
    mergeRole(roles, [cell], HighlightRole.HINT);
    expect(roles.get(cell)).toBe(HighlightRole.SELECTED);
    mergeRole(roles, [cell], HighlightRole.SELECTED);
    expect(highlightRoles(puzzle, null).size).toBe(0);
  });

  it('list the roles in use in the legend, strongest first', () => {
    const entries = legend([
      HighlightRole.PEER,
      HighlightRole.SELECTED,
      HighlightRole.NONE,
      HighlightRole.PEER,
    ]);
    expect(entries.map((e) => e.label)).toEqual(['selected cell', 'shares a group with the cell']);
  });

  it('blend the colours on white', () => {
    expect(roleColor(HighlightRole.NONE)).toBe('#ffffff');
    expect(roleColor(HighlightRole.SELECTED)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
