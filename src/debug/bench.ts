import type { PlayerState } from '../sim/player';

const WARMUP_MS = 2000; // skip shader compilation hitches at start
const DURATION_MS = 20000;
const RADIUS = 18;

export interface BenchStats {
  frames: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  fps: number;
}

export function summarize(frameMs: number[]): BenchStats {
  const sorted = [...frameMs].sort((a, b) => a - b);
  const pct = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const avg = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
  return {
    frames: sorted.length,
    avgMs: avg,
    p95Ms: pct(0.95),
    p99Ms: pct(0.99),
    maxMs: sorted[sorted.length - 1] ?? 0,
    fps: avg ? 1000 / avg : 0,
  };
}

/** `?bench`: camera circles the arena on a fixed path, then reports frame-time stats. */
export function createBench(onDone: (stats: BenchStats) => void) {
  const frames: number[] = [];
  const pose: PlayerState & { yaw: number } = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
    yaw: 0,
  };
  let start = -1;
  let last = -1;
  let running = true;

  return {
    get running() {
      return running;
    },
    tick(now: number) {
      if (start < 0) start = now;
      else if (now - start > WARMUP_MS) frames.push(now - last);
      last = now;
      const a = ((now - start) / DURATION_MS) * Math.PI * 2;
      pose.x = Math.sin(a) * RADIUS;
      pose.z = Math.cos(a) * RADIUS;
      pose.yaw = a + Math.PI / 2; // look along the circle's tangent
      if (now - start >= WARMUP_MS + DURATION_MS) {
        running = false;
        onDone(summarize(frames));
      }
      return pose;
    },
  };
}
