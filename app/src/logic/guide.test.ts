// What the Rules dialog shows: the rules and techniques of a puzzle type, opened at a technique.
import { parseExampleBoard, PUZZLE_TYPES, TECHNIQUE_GUIDE } from '@constraintpuzzler/core';

import { i18n } from '../i18n';
import { exampleBoardLayout, guideContent, techniqueLinkLabel, toggleTechnique } from './guide';

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

describe('exampleBoardLayout', () => {
  it('places the cells in a grid with box lines', () => {
    const board = TECHNIQUE_GUIDE.intersection.board!;
    const layout = exampleBoardLayout(board, parseExampleBoard(board));
    expect(layout.width).toBe(9);
    expect(layout.height).toBe(3);
    expect(layout.cells).toHaveLength(27);
    expect(layout.cells[10]).toMatchObject({ x: 1, y: 1 });
    // the frame, and the lines between the three boxes (no row lines in three rows)
    expect(layout.thickLines).toHaveLength(4 + 2);
    expect(layout.labels).toEqual([]);
  });

  it('leaves room for the row labels', () => {
    const board = TECHNIQUE_GUIDE.wholeLine.board!;
    const layout = exampleBoardLayout(board, parseExampleBoard(board));
    const left = layout.cells[0]!.x;
    expect(left).toBeGreaterThan(0);
    expect(layout.width).toBe(left + 6);
    expect(layout.labels).toEqual([{ x: left - 0.15, y: 0.5, text: '3 2' }]);
  });
});

describe('the guide in Dutch', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('shows the rules, techniques and example captions in the chosen language', async () => {
    await i18n.changeLanguage('nl');
    const content = guideContent(PUZZLE_TYPES.sudoku, 'hiddenSingle');
    expect(content.title).toBe('Sudoku: regels en technieken');
    expect(content.goal).toBe('Vul het rooster met de cijfers 1 tot en met 9.');
    const hidden = content.techniques.find((entry) => entry.id === 'hiddenSingle');
    expect(hidden?.name).toBe('Verborgen single');
    expect(hidden?.board?.caption).toMatch(/^De rij mist/);
    expect(techniqueLinkLabel('overlap')).toBe('Over deze techniek: Overlap');
  });
});
