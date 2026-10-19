import type { PlayerCommand } from '../sim/player';
import { getSettings } from '../settings/settings';

const BASE_SENSITIVITY = 0.002; // radians per mouse count at sensitivity 1
const PITCH_LIMIT = Math.PI / 2 - 0.01;

/** Keyboard (by physical `code`, so WASD works on any layout) + pointer-locked mouse look. */
export function createInput(canvas: HTMLCanvasElement, onInventory: () => void) {
  const keys = new Set<string>();
  const look = { yaw: 0, pitch: 0 };
  let attackPressed = false; // latched until the next sim step reads it
  let throwPressed = false;
  let interactPressed = false;
  let healPressed = false;
  let slotPressed = 0; // 1-5 pressed since the last step (Tribal War weapon keys)
  let leftDown = false; // held: the bow draws while it is

  window.addEventListener('keydown', (e) => {
    if (!isLocked()) return;
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE') interactPressed = true;
    if (e.code === 'KeyQ') healPressed = true;
    if (/^Digit[1-5]$/.test(e.code)) slotPressed = Number(e.code.slice(5));
    if (e.code === 'Tab') {
      e.preventDefault(); // keep focus off the browser chrome
      onInventory();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('pointerlockchange', () => {
    if (isLocked()) return;
    keys.clear();
    leftDown = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!isLocked()) return;
    if (e.button === 0) {
      attackPressed = true;
      leftDown = true;
    }
    if (e.button === 2) throwPressed = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) leftDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('mousemove', (e) => {
    if (!isLocked()) return;
    const { sensitivity, invertY } = getSettings();
    const k = BASE_SENSITIVITY * sensitivity;
    look.yaw += e.movementX * k;
    look.pitch = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, look.pitch + e.movementY * k * (invertY ? -1 : 1)),
    );
  });

  function isLocked() {
    return document.pointerLockElement === canvas;
  }

  /** Must be called from a user gesture. Rejects if the browser refuses (e.g. re-lock cooldown right after Esc). */
  async function lock() {
    try {
      // Raw mouse input (no OS acceleration) where supported.
      await canvas.requestPointerLock({ unadjustedMovement: true });
    } catch (err) {
      if ((err as DOMException).name !== 'NotSupportedError') throw err;
      await canvas.requestPointerLock();
    }
  }

  function command(): PlayerCommand & { attackHeld: boolean; slot: number } {
    const attack = attackPressed;
    const throwIt = throwPressed;
    const interact = interactPressed;
    const heal = healPressed;
    const slot = slotPressed;
    attackPressed = throwPressed = interactPressed = healPressed = false;
    slotPressed = 0;
    const axis = (pos: string, neg: string) => (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
    return {
      moveX: axis('KeyD', 'KeyA'),
      moveZ: axis('KeyW', 'KeyS'),
      jump: keys.has('Space'),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      yaw: look.yaw,
      pitch: look.pitch,
      attack,
      throw: throwIt,
      interact,
      heal,
      attackHeld: leftDown,
      slot, // 0 = no switch
    };
  }

  return { look, lock, isLocked, command };
}
