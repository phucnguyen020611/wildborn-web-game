import { describe, expect, it } from 'vitest';
import vi from './vi.json';
import en from './en.json';

describe('locales', () => {
  it('vi and en have the same keys and no empty strings', () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
    for (const dict of [vi, en]) for (const v of Object.values(dict)) expect(v.trim()).not.toBe('');
  });
});
