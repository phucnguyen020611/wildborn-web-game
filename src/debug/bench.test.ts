import { describe, expect, it } from 'vitest';
import { summarize } from './bench';

describe('summarize', () => {
  it('computes average, percentiles and fps', () => {
    const frames = [...Array(98).fill(10), 50, 100];
    const s = summarize(frames);
    expect(s.frames).toBe(100);
    expect(s.avgMs).toBeCloseTo(11.3);
    expect(s.p95Ms).toBe(10);
    expect(s.p99Ms).toBe(100);
    expect(s.maxMs).toBe(100);
    expect(s.fps).toBeCloseTo(1000 / 11.3);
  });

  it('handles no frames', () => {
    expect(summarize([]).fps).toBe(0);
  });
});
