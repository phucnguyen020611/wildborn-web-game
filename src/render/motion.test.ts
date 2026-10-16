import { describe, expect, it } from 'vitest';
import { createMotion } from './motion';
import type { PlayerState } from '../sim/player';

const still: PlayerState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true };
const running: PlayerState = { ...still, vz: 8 };

/** Runs ~1 s of frames and returns the largest camera dip seen. */
function maxDip(state: PlayerState, prev = state) {
  const m = createMotion();
  let dip = 0;
  for (let t = 0; t <= 1000; t += 16) dip = Math.min(dip, m.update(prev, state, 0, 0, t).camY);
  return dip;
}

describe('createMotion', () => {
  it('bobs while moving and stays still when standing', () => {
    expect(maxDip(still)).toBeCloseTo(0);
    expect(maxDip(running)).toBeLessThan(-0.02);
  });

  it('dips on landing, scaled by fall speed', () => {
    const m = createMotion();
    m.update(still, still, 0, 0, 0);
    const hard = m.update({ ...still, vy: -12, onGround: false }, still, 0, 0, 16).camY;
    expect(hard).toBeLessThan(-0.05);
  });

  it('weapon lags behind a fast turn', () => {
    const m = createMotion();
    m.update(still, still, 0, 0, 0);
    expect(m.update(still, still, 0.2, 0, 16).vmX).toBeLessThan(0); // turned right: weapon trails left
  });
});
