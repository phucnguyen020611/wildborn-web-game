import { describe, expect, it } from 'vitest';
import { createLoop } from './loop';

describe('createLoop', () => {
  it('runs fixed steps regardless of frame rate and clamps long frames', () => {
    let steps = 0;
    let alpha = -1;
    const loop = createLoop(
      () => steps++,
      (a) => (alpha = a),
    );
    loop.tick(0);
    expect(steps).toBe(0);
    loop.tick(1000); // 1s real time -> clamped to 0.25s = 15 steps
    expect(steps).toBe(15);
    loop.tick(1000 + 1000 / 120); // half a step
    expect(steps).toBe(15);
    expect(alpha).toBeCloseTo(0.5);
  });
});
