/**
 * The picture of a nonogram hint: the line as it is now, then the placements of its blocks
 * that explain the hint (see RunsConstraint.placementDiagram). This is the text above it.
 */
import { BLANK, type PlacementDiagram, type Value } from '@constraintpuzzler/core';

import { i18n } from '../i18n';

/**
 * What the picture shows, e.g. "The column now, then every place block 1 can go: each covers
 * the outlined cell." `valueName` names a colour (Puzzle.valueName).
 */
export function placementsCaption(
  diagram: PlacementDiagram,
  valueName: (value: Value) => string,
): string {
  const line = i18n.t(diagram.vertical ? 'placements.column' : 'placements.row');
  if (diagram.block !== null) {
    const others = diagram.rows.some((row, r) => {
      const span = diagram.spans?.[r];
      return (
        span !== undefined &&
        row.some((v, j) => v !== null && v !== BLANK && (j < span[0] || j > span[1]))
      );
    });
    return i18n.t(others ? 'placements.blockOthers' : 'placements.block', {
      line,
      block: diagram.block + 1,
    });
  }
  const shown = diagram.rows.length;
  const total = diagram.total;
  const ways =
    total === 1
      ? i18n.t('placements.waysOnly')
      : shown < total
        ? i18n.t('placements.waysSome', { shown, total })
        : i18n.t('placements.waysAll', { total });
  const outcome =
    diagram.value !== null
      ? i18n.t('placements.makes', { count: total, value: valueName(diagram.value) })
      : i18n.t('placements.excludes', { count: total });
  return i18n.t('placements.ways', { line, ways, outcome });
}
