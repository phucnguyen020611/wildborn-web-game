import { describe, expect, it } from 'vitest';
import { onLoadProgress, track, type LoadProgress } from './loading';

describe('loading tracker', () => {
  it('counts tracked promises, including failures, and notifies listeners', async () => {
    let last: LoadProgress | null = null;
    onLoadProgress((p) => (last = p));
    const ok = track(Promise.resolve(1));
    const bad = track(Promise.reject(new Error('nope')));
    expect(last).toEqual({ done: 0, total: 2, failed: 0 });
    await ok;
    await bad.catch(() => {});
    expect(last).toEqual({ done: 2, total: 2, failed: 1 });
  });
});
