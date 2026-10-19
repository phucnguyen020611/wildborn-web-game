import { describe, expect, it } from 'vitest';
import { parseBag, parseProgress } from './progress';

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

describe('parseBag', () => {
  it('keeps valid counts, clamps the spear tier and drops junk', () => {
    const bag = parseBag(
      JSON.stringify({
        v: 1,
        inventory: { herb: 3, bone: -2, hide: 1.5, x: 9 },
        spearTier: 7,
        camp: 1,
      }),
    );
    expect(bag).toMatchObject({ spearTier: 2, camp: 1 });
    expect(bag!.inventory).toMatchObject({ herb: 3, bone: 0, hide: 0 });
    expect(parseBag('nope')).toBeNull();
    expect(parseBag(JSON.stringify({ v: 2 }))).toBeNull();
  });
});
