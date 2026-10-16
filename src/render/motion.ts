import { PLAYER } from '../config/player';
import type { PlayerState } from '../sim/player';

const STEP = 0.8; // metres per footstep; one bob dip per step
const CAM_BOB = 0.035; // camera height swing at full sprint (m)
const VM_BOB = 0.012; // weapon figure-eight at full sprint (m)
const SWAY = 0.06; // weapon lag per radian of look turned this frame (m)
const SWAY_MAX = 0.04;

/**
 * Presentation-only body motion: head bob and landing dip for the camera, and for the weapon a
 * step sway plus a lag behind fast mouse turns (inertia). Never touches the sim.
 */
export function createMotion() {
  let phase = 0;
  let amount = 0; // 0 standing .. 1 sprinting, eased so starting/stopping doesn't snap
  let dip = 0; // landing dip (m), springs back
  let lastYaw = 0;
  let lastPitch = 0;
  let lastTime = -1; // no frame yet
  const out = { camY: 0, camX: 0, vmX: 0, vmY: 0, vmRoll: 0 };

  return {
    out,
    update(prev: PlayerState, curr: PlayerState, yaw: number, pitch: number, now: number) {
      const dt = lastTime >= 0 ? Math.min(0.05, (now - lastTime) / 1000) : 0;
      lastTime = now;
      const speed = curr.onGround ? Math.hypot(curr.vx, curr.vz) : 0;
      amount += (Math.min(1, speed / PLAYER.sprintSpeed) - amount) * Math.min(1, dt * 8);
      phase += (speed * dt * Math.PI) / STEP;
      if (curr.onGround && !prev.onGround) dip = Math.min(0.12, -prev.vy * 0.008);
      dip *= Math.exp(-dt * 9);

      const step = Math.sin(phase); // one full cycle every two steps
      out.camY = -Math.abs(step) * CAM_BOB * amount - dip;
      out.camX = Math.cos(phase) * CAM_BOB * 0.4 * amount;

      // Look lag: the weapon trails the turn, then settles back.
      const dYaw = Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw));
      const dPitch = pitch - lastPitch;
      lastYaw = yaw;
      lastPitch = pitch;
      const lagX = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, -dYaw * SWAY * 10));
      const lagY = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, dPitch * SWAY * 10));
      const k = Math.min(1, dt * 12);
      out.vmX += (Math.cos(phase) * VM_BOB * amount + lagX - out.vmX) * k;
      out.vmY += (-Math.abs(step) * VM_BOB * amount + lagY - dip * 0.5 - out.vmY) * k;
      out.vmRoll += (lagX * 2 - out.vmRoll) * k;
      return out;
    },
  };
}
