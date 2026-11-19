// What the Rules dialog shows: the rules and techniques of a puzzle type, opened at a technique.
import { PUZZLE_TYPES, TECHNIQUE_GUIDE } from '@constraintpuzzler/core';

import { guideContent, techniqueLinkLabel, toggleTechnique } from './guide';

describe('guideContent', () => {
  it.each(Object.values(PUZZLE_TYPES))('$name: lists its rules and techniques', (type) => {
    const content = guideContent(type);
    expect(content.title).toContain(type.label);
    expect(content.rules).toEqual(type.guide.rules);
    expect(content.techniques.map((t) => t.id)).toEqual(type.guide.techniques);
    expect(content.opened).toBeNull();
  });

  it('opens at a technique the type uses', () => {
    expect(guideContent(PUZZLE_TYPES.sudoku, 'xWing').opened).toBe('xWing');
  });

  it('ignores a technique the type does not use', () => {
    expect(guideContent(PUZZLE_TYPES.nonogram, 'xWing').opened).toBeNull();
  });
});

describe('techniques in the list', () => {
  it('opens one at a time, and closes it again', () => {
    expect(toggleTechnique(null, 'overlap')).toBe('overlap');
    expect(toggleTechnique('overlap', 'reach')).toBe('reach');
    expect(toggleTechnique('reach', 'reach')).toBeNull();
  });

  it('names the technique in the link', () => {
    expect(techniqueLinkLabel('hiddenSingle')).toBe(
      `About this technique: ${TECHNIQUE_GUIDE.hiddenSingle.name}`,
    );
  });
});
