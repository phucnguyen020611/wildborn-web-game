export const SIM_DT = 1 / 60;
const MAX_FRAME = 0.25; // seconds; avoids a death spiral after a stalled tab

/** Fixed-timestep loop: `step` runs at SIM_DT, `render` gets alpha (0..1) for interpolation. */
export function createLoop(step: () => void, render: (alpha: number) => void) {
  let last = -1;
  let acc = 0;

  function tick(nowMs: number) {
    const now = nowMs / 1000;
    const frame = last < 0 ? 0 : Math.min(now - last, MAX_FRAME);
    last = now;
    acc += frame;
    while (acc >= SIM_DT) {
      step();
      acc -= SIM_DT;
    }
    render(acc / SIM_DT);
  }

  return { tick };
}
