import { describe, expect, it } from 'vitest';
import { segmentDistance } from './geometry';

const v = (x: number, y: number, z: number) => ({ x, y, z });

describe('segmentDistance', () => {
  it('handles crossing, parallel, disjoint and degenerate segments', () => {
    expect(segmentDistance(v(-1, 0, 0), v(1, 0, 0), v(0, 1, -1), v(0, 1, 1))).toBeCloseTo(1);
    expect(segmentDistance(v(0, 0, 0), v(1, 0, 0), v(0, 2, 0), v(1, 2, 0))).toBeCloseTo(2);
    expect(segmentDistance(v(0, 0, 0), v(1, 0, 0), v(3, 0, 0), v(4, 0, 0))).toBeCloseTo(2);
    expect(segmentDistance(v(0, 0, 0), v(0, 0, 0), v(0, 3, 0), v(0, 3, 0))).toBeCloseTo(3);
  });
});
