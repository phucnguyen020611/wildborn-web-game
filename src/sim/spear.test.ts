import { describe, expect, it } from 'vitest';
import { createSpear, stepSpear } from './spear';
import { WEAPONS } from '../config/weapons';

const DT = 1 / 60;
const cfg = WEAPONS.spear;

function run(s: ReturnType<typeof createSpear>, steps: number, attackAt: number[] = []) {
  for (let i = 0; i < steps; i++) stepSpear(s, cfg, attackAt.includes(i), false, DT);
}

describe('stepSpear', () => {
  it('goes windup -> active -> recover -> ready', () => {
    const s = createSpear();
    run(s, 1, [0]);
    expect(s.phase).toBe('windup');
    run(s, Math.ceil(cfg.windup / DT));
    expect(s.phase).toBe('active');
    run(s, Math.ceil(cfg.active / DT));
    expect(s.phase).toBe('recover');
    run(s, Math.ceil(cfg.recover / DT) + 1);
    expect(s.phase).toBe('ready');
  });

  it('buffers a press made shortly before recovery ends', () => {
    const s = createSpear();
    const total = Math.ceil((cfg.windup + cfg.active + cfg.recover) / DT);
    run(s, total - 3, [0, total - 6]); // second press lands during recover
    run(s, 6);
    expect(s.phase).toBe('windup');
  });

  it('ignores a press made long before recovery ends', () => {
    const s = createSpear();
    run(s, 60, [0, 3]); // second press during windup, buffer expires before ready
    expect(s.phase).toBe('ready');
  });

  it('throws after the windup and stops attacking while not held', () => {
    const s = createSpear();
    let released = false;
    for (let i = 0; i < 30 && !released; i++) released = stepSpear(s, cfg, false, i === 0, DT);
    expect(released).toBe(true);
    expect(s.held).toBe(false);
    run(s, 5, [0]);
    expect(s.phase).toBe('ready');
  });
});
