import { describe, expect, it } from 'vitest';
import { parseProgress } from './progress';

describe('parseProgress', () => {
  it('reads known acts in order and ignores bad data', () => {
    expect(parseProgress(JSON.stringify({ v: 1, done: ['act2', 'act1', 'nope'] }))).toEqual([
      'act1',
      'act2',
    ]);
    expect(parseProgress(null)).toEqual([]);
    expect(parseProgress('{oops')).toEqual([]);
    expect(parseProgress(JSON.stringify({ v: 9, done: ['act1'] }))).toEqual([]);
  });
});
