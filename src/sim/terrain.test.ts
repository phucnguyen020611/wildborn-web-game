import { describe, expect, it } from 'vitest';
import { bakeTerrain, heightAt } from './terrain';

describe('terrain', () => {
  const t = bakeTerrain(10, 10, (x, z) => x + 2 * z); // a plane: bilinear must reproduce it

  it('interpolates between samples and clamps outside the map', () => {
    expect(heightAt(t, 0, 0)).toBeCloseTo(0);
    expect(heightAt(t, 1.25, -2.5)).toBeCloseTo(1.25 - 5);
    expect(heightAt(t, 50, 0)).toBeCloseTo(5);
  });
});
