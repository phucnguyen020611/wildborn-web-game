import { describe, expect, it } from 'vitest';
import { daylight } from './daylight';

describe('daylight', () => {
  it('puts the sun high at noon, low and warm in the evening, and lets the moon light the night', () => {
    const noon = daylight(12);
    const evening = daylight(17.5);
    const night = daylight(23);
    expect(noon.toSun[1]).toBeGreaterThan(0.8);
    expect(evening.toSun[1]).toBeGreaterThan(0);
    expect(evening.toSun[1]).toBeLessThan(0.3);
    expect(evening.light[2]).toBeLessThan(noon.light[2]); // less blue: orange light
    expect(night.toSun[1]).toBeLessThan(0);
    expect(night.toLight[1]).toBeGreaterThan(0); // moon is up
    expect(night.lightIntensity).toBeLessThan(0.5);
  });
});
