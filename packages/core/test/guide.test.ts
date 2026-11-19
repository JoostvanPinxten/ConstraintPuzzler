// The rules and techniques explained for players: every puzzle type has a guide, and every
// technique it names is explained.
import { describe, expect, it } from 'vitest';

import { TECHNIQUE_GUIDE, type TechniqueId } from '../src/guide/techniques';
import { PUZZLE_TYPES } from '../src/puzzletypes';

const TYPES = Object.values(PUZZLE_TYPES);

describe('technique guide', () => {
  it('is keyed by the technique ids', () => {
    for (const [id, entry] of Object.entries(TECHNIQUE_GUIDE)) expect(entry.id).toBe(id);
  });

  it.each(Object.values(TECHNIQUE_GUIDE))('$id: has a name, summary and steps', (entry) => {
    expect(entry.name).not.toBe('');
    expect(entry.summary).not.toBe('');
    expect(entry.steps.length).toBeGreaterThan(0);
  });

  it('lists every technique for some puzzle type', () => {
    const used = new Set<TechniqueId>(TYPES.flatMap((t) => t.guide.techniques));
    expect([...used].sort()).toEqual(Object.keys(TECHNIQUE_GUIDE).sort());
  });
});

describe('puzzle guides', () => {
  it.each(TYPES)('$name: has a goal, rules and known techniques', (type) => {
    const { goal, rules, techniques } = type.guide;
    expect(goal).not.toBe('');
    expect(rules.length).toBeGreaterThan(0);
    expect(techniques.length).toBeGreaterThan(0);
    expect(new Set(techniques).size).toBe(techniques.length);
    for (const id of techniques) expect(TECHNIQUE_GUIDE[id]).toBeDefined();
  });
});
