import { describe, expect, it } from 'vitest';
import { DEFAULTS, parse } from './settings';

describe('parse settings', () => {
  it('keeps valid stored values and defaults the rest', () => {
    const s = parse(
      JSON.stringify({ v: 1, fov: 90, invertY: true, quality: 'high', master: 'loud' }),
    );
    expect(s).toEqual({ ...DEFAULTS, fov: 90, invertY: true, quality: 'high' });
  });

  it('falls back to defaults for missing, corrupt or old-version data', () => {
    expect(parse(null)).toEqual(DEFAULTS);
    expect(parse('{not json')).toEqual(DEFAULTS);
    expect(parse(JSON.stringify({ v: 0, fov: 90 }))).toEqual(DEFAULTS);
    expect(parse(JSON.stringify({ v: 1, quality: 'ultra' })).quality).toBe(DEFAULTS.quality);
  });
});
