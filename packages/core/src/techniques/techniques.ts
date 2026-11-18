import { Jellyfish, Swordfish, XWing } from './fish';
import { IntersectionRemoval } from './intersection';
import type { TechniqueClass } from './technique';

/** The techniques the solver uses by default, easiest first. */
export const TECHNIQUES: readonly TechniqueClass[] = [
  IntersectionRemoval,
  XWing,
  Swordfish,
  Jellyfish,
];
