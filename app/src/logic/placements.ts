/**
 * The picture of a nonogram hint: the line as it is now, then the placements of its blocks
 * that explain the hint (see RunsConstraint.placementDiagram). This is the text above it.
 */
import type { PlacementDiagram, Value } from '@constraintpuzzler/core';

/**
 * What the picture shows, e.g. "The column now, then every place block 1 can go: each covers
 * the outlined cell." `valueName` names a colour (Puzzle.valueName).
 */
export function placementsCaption(
  diagram: PlacementDiagram,
  valueName: (value: Value) => string,
): string {
  const line = diagram.vertical ? 'column' : 'row';
  const now = `The ${line} now (grey: open), then`;
  if (diagram.block !== null) {
    return `${now} every place block ${diagram.block + 1} can go: each covers the outlined cell.`;
  }
  const shown = diagram.rows.length;
  const ways =
    diagram.total === 1
      ? 'the only way its blocks fit'
      : shown < diagram.total
        ? `${shown} of the ${diagram.total} ways its blocks fit`
        : `the ${diagram.total} ways its blocks fit`;
  const outcome =
    diagram.value !== null
      ? `${diagram.total === 1 ? 'it makes' : 'every one makes'} the outlined cell ${valueName(diagram.value)}`
      : `${diagram.total === 1 ? 'it does not give' : 'none gives'} the outlined cell the removed colour`;
  return `${now} ${ways}: ${outcome}.`;
}
