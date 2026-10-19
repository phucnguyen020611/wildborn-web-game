import { describe, expect, it } from 'vitest';
import { waterTint } from './water';

describe('waterTint', () => {
  it('is invisible on dry land, foamy at the waterline, clearer in the shallows than the deep', () => {
    expect(waterTint(-0.2)[3]).toBe(0);
    const foam = waterTint(0.1);
    const shallow = waterTint(0.3);
    const deep = waterTint(1.5);
    expect(foam[0]).toBeGreaterThan(shallow[0]); // pale
    expect(shallow[3]).toBeLessThan(deep[3]); // see-through
    expect(deep[0] + deep[1] + deep[2]).toBeLessThan(shallow[0] + shallow[1] + shallow[2]); // dark
  });
});
