import type { MeleeConfig, ThrowConfig } from '../config/weapons';

export type SpearPhase = 'ready' | 'windup' | 'active' | 'recover' | 'throw';

export interface SpearState {
  phase: SpearPhase;
  t: number; // seconds in the current phase
  buffered: number; // seconds left on a queued attack press
  hit: boolean; // this thrust already connected (one hit per thrust)
  held: boolean; // false while the spear is thrown or lying on the ground
}

export function createSpear(): SpearState {
  return { phase: 'ready', t: 0, buffered: 0, hit: false, held: true };
}

/**
 * Advances the thrust/throw state machine. `attack`/`throwIt` = pressed this step.
 * Returns true on the step the spear leaves the hand.
 */
export function stepSpear(
  s: SpearState,
  cfg: MeleeConfig & ThrowConfig,
  attack: boolean,
  throwIt: boolean,
  dt: number,
) {
  if (!s.held) return false;
  s.buffered = attack ? cfg.buffer : Math.max(0, s.buffered - dt);
  s.t += dt;
  if (s.phase === 'throw') {
    if (s.t < cfg.throwWindup) return false;
    next(s, 'ready');
    s.held = false;
    s.buffered = 0;
    return true;
  }
  if (throwIt && s.phase === 'ready') {
    next(s, 'throw');
    return false;
  }
  if (s.phase === 'windup' && s.t >= cfg.windup) next(s, 'active');
  else if (s.phase === 'active' && s.t >= cfg.active) next(s, 'recover');
  else if (s.phase === 'recover' && s.t >= cfg.recover) next(s, 'ready');

  if (s.phase === 'ready' && s.buffered > 0) {
    next(s, 'windup');
    s.buffered = 0;
    s.hit = false;
  }
  return false;
}

function next(s: SpearState, phase: SpearPhase) {
  s.phase = phase;
  s.t = 0;
}
