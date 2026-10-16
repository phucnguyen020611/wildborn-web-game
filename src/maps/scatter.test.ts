import { describe, expect, it } from 'vitest';
import { colliderFor, scatter } from './scatter';

describe('scatter', () => {
  it('turns non-square footprints with quarter turns and sits boxes on the prop', () => {
    const log = { id: 'log' as const, x: 0, y: 2, z: 0, scale: 1 };
    expect(colliderFor({ ...log, rot: 0 })).toMatchObject({ w: 4.8, d: 0.7, y: 2 });
    expect(colliderFor({ ...log, rot: Math.PI / 2 })).toMatchObject({ w: 0.7, d: 4.8 });
  });

  it('is deterministic and keeps solid props apart', () => {
    const rule = { ids: ['rock_1' as const], count: 20, gap: 1.2, where: () => true };
    const a = scatter(40, () => 0, [], [rule], 3);
    expect(scatter(40, () => 0, [], [rule], 3)).toEqual(a);
    for (const [i, p] of a.solids.entries())
      for (const q of a.solids.slice(i + 1))
        expect(Math.abs(p.x - q.x) > (p.w + q.w) / 2 || Math.abs(p.z - q.z) > (p.d + q.d) / 2).toBe(
          true,
        );
  });
});
