// The bundled examples must match the example files (run `npm run examples` after a change).
import { exampleFiles } from '@constraintpuzzler/core';
import { readFileSync } from 'fs';
import { join } from 'path';

import { EXAMPLES } from './examples.generated';

describe('bundled examples', () => {
  it('are the registered example files, unchanged', () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual(exampleFiles().sort());
    for (const file of exampleFiles()) {
      const text = readFileSync(
        join(__dirname, '..', '..', '..', 'puzzles', file),
        'utf-8',
      ).replace(/\r\n/g, '\n');
      expect(EXAMPLES[file]).toBe(text);
    }
  });
});
