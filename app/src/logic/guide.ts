/**
 * What the Rules dialog shows for a puzzle type: its goal and rules, and the techniques that
 * help to solve it (from the core's guide), with the one to open first, e.g. the technique
 * behind the hint the player asked about.
 */
import {
  TECHNIQUE_GUIDE,
  type ExampleBoard,
  type ExampleCell,
  type PuzzleType,
  type TechniqueGuide,
  type TechniqueId,
} from '@constraintpuzzler/core';

import { i18n } from '../i18n';

export interface GuideContent {
  readonly title: string;
  readonly goal: string;
  readonly rules: readonly string[];
  /** easiest first */
  readonly techniques: readonly TechniqueGuide[];
  /** the technique shown opened (and scrolled to); null for none */
  readonly opened: TechniqueId | null;
}

/** The Rules dialog for a puzzle type, opened at `technique` when the type uses it. */
export function guideContent(type: PuzzleType, technique: TechniqueId | null = null): GuideContent {
  const { goal, rules, techniques } = type.guide;
  return {
    title: i18n.t('guide.title', { type: type.label }),
    goal,
    rules,
    techniques: techniques.map((id) => TECHNIQUE_GUIDE[id]),
    opened: technique !== null && techniques.includes(technique) ? technique : null,
  };
}

/** The link to a technique's explanation, e.g. "About this technique: Hidden single". */
export function techniqueLinkLabel(technique: TechniqueId): string {
  return i18n.t('guide.link', { technique: TECHNIQUE_GUIDE[technique].name });
}

/** Open or close a technique in the list (one at a time). */
export function toggleTechnique(opened: TechniqueId | null, id: TechniqueId): TechniqueId | null {
  return opened === id ? null : id;
}

export interface ExampleBoardLayout {
  /** in cell units, including the labels */
  readonly width: number;
  readonly height: number;
  /** the top left corner of every cell */
  readonly cells: readonly { readonly x: number; readonly y: number; readonly cell: ExampleCell }[];
  /** the frame and the box lines */
  readonly thickLines: readonly {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  }[];
  /** the row labels, right-aligned at x and centred on y */
  readonly labels: readonly { readonly x: number; readonly y: number; readonly text: string }[];
}

/** Where the cells, lines and labels of an example board go (one unit per cell). */
export function exampleBoardLayout(
  board: ExampleBoard,
  rows: readonly (readonly ExampleCell[])[],
): ExampleBoardLayout {
  const columns = Math.max(0, ...rows.map((r) => r.length));
  const longest = Math.max(0, ...(board.rowLabels ?? []).map((l) => l.length));
  const left = longest > 0 ? 0.3 * longest + 0.3 : 0;
  const cells = rows.flatMap((row, y) => row.map((cell, x) => ({ x: left + x, y, cell })));
  const right = left + columns;
  const bottom = rows.length;
  const thickLines = [
    { x1: left, y1: 0, x2: right, y2: 0 },
    { x1: left, y1: bottom, x2: right, y2: bottom },
    { x1: left, y1: 0, x2: left, y2: bottom },
    { x1: right, y1: 0, x2: right, y2: bottom },
  ];
  const box = board.box;
  if (box !== undefined && box > 0) {
    for (let x = box; x < columns; x += box) {
      thickLines.push({ x1: left + x, y1: 0, x2: left + x, y2: bottom });
    }
    for (let y = box; y < rows.length; y += box) {
      thickLines.push({ x1: left, y1: y, x2: right, y2: y });
    }
  }
  const labels = (board.rowLabels ?? []).map((text, y) => ({ x: left - 0.15, y: y + 0.5, text }));
  return { width: right, height: bottom, cells, thickLines, labels };
}
