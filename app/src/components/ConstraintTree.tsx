// The puzzle as a collapsible list: the grid with its cells, the constraint groups with their
// rules and cells. Selecting an entry highlights its cells and describes it.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PuzzleSession } from '../logic/session';
import { buildPuzzleTree, type Selection, type TreeNode } from '../logic/tree';
import { COLORS } from '../theme';
import { useSession } from '../useSession';

function sameSelection(a: Selection | null, b: Selection): boolean {
  if (a === null || a.kind !== b.kind) return false;
  switch (b.kind) {
    case 'cell':
      return a.kind === 'cell' && a.cell === b.cell;
    case 'group':
      return a.kind === 'group' && a.group === b.group;
    case 'constraint':
      return a.kind === 'constraint' && a.constraint === b.constraint;
    default:
      return true;
  }
}

export function ConstraintTree({ session }: { session: PuzzleSession }) {
  useSession(session);
  const tree = useMemo(() => buildPuzzleTree(session.puzzle), [session]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['puzzle']));
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows: { node: TreeNode; depth: number }[] = [];
  const walk = (node: TreeNode, depth: number) => {
    rows.push({ node, depth });
    if (expanded.has(node.id)) for (const child of node.children) walk(child, depth + 1);
  };
  walk(tree, 0);

  return (
    <ScrollView style={styles.list} testID="tree">
      {rows.map(({ node, depth }) => {
        const selected = sameSelection(session.selection, node.selection);
        const open = expanded.has(node.id);
        return (
          <View
            key={node.id}
            style={[styles.row, { paddingLeft: 4 + depth * 14 }, selected && styles.selected]}
          >
            {node.children.length > 0 ? (
              <Pressable
                onPress={() => toggle(node.id)}
                accessibilityRole="button"
                accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
                style={styles.chevron}
              >
                <Text style={styles.chevronText}>{open ? '▾' : '▸'}</Text>
              </Pressable>
            ) : (
              <View style={styles.chevron} />
            )}
            <Pressable
              onPress={() => session.select(node.selection)}
              style={styles.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={styles.labelText} numberOfLines={1}>
                {node.label}
                <Text style={styles.type}>{`  ${node.type}`}</Text>
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 30 },
  selected: { backgroundColor: '#ffe9a8' },
  chevron: { width: 26, height: 30, alignItems: 'center', justifyContent: 'center' },
  chevronText: { color: COLORS.muted, fontSize: 14 },
  label: { flex: 1, paddingVertical: 4, paddingRight: 8 },
  labelText: { color: COLORS.text, fontSize: 14 },
  type: { color: COLORS.muted, fontSize: 12 },
});
