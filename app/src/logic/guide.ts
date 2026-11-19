/**
 * What the Rules dialog shows for a puzzle type: its goal and rules, and the techniques that
 * help to solve it (from the core's guide), with the one to open first, e.g. the technique
 * behind the hint the player asked about.
 */
import {
  TECHNIQUE_GUIDE,
  type PuzzleType,
  type TechniqueGuide,
  type TechniqueId,
} from '@constraintpuzzler/core';

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
    title: `${type.label}: rules and techniques`,
    goal,
    rules,
    techniques: techniques.map((id) => TECHNIQUE_GUIDE[id]),
    opened: technique !== null && techniques.includes(technique) ? technique : null,
  };
}

/** The link to a technique's explanation, e.g. "About this technique: Hidden single". */
export function techniqueLinkLabel(technique: TechniqueId): string {
  return `About this technique: ${TECHNIQUE_GUIDE[technique].name}`;
}

/** Open or close a technique in the list (one at a time). */
export function toggleTechnique(opened: TechniqueId | null, id: TechniqueId): TechniqueId | null {
  return opened === id ? null : id;
}
