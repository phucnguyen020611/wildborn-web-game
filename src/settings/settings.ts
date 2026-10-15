export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  sensitivity: number; // multiplier on the base mouse speed
  invertY: boolean;
  fov: number; // horizontal degrees
  quality: Quality;
  shake: boolean;
  master: number; // 0..1
  sfx: number;
  ambience: number;
}

export const DEFAULTS: Settings = {
  sensitivity: 1,
  invertY: false,
  fov: 100,
  quality: 'medium',
  shake: true,
  master: 0.8,
  sfx: 0.8,
  ambience: 0.35,
};

const KEY = 'wildborn.settings';
const VERSION = 1; // bump and migrate in load() when the shape changes

/** Merges stored values over defaults, ignoring anything of the wrong type (old or hand-edited data). */
export function parse(raw: string | null): Settings {
  const out = { ...DEFAULTS };
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (data?.v !== VERSION) return out;
    for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      if (typeof data[k] === typeof DEFAULTS[k]) (out as Record<string, unknown>)[k] = data[k];
    }
    if (!['low', 'medium', 'high'].includes(out.quality)) out.quality = DEFAULTS.quality;
  } catch {
    // corrupt JSON: fall back to defaults
  }
  return out;
}

function load(): Settings {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULTS }; // storage blocked
  }
}

const current = load();
const listeners: ((s: Settings) => void)[] = [];

export function getSettings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(current, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...current }));
  } catch {
    // not persisted; still applies for this session
  }
  listeners.forEach((fn) => fn(current));
}

/** Calls `fn` now and on every change. */
export function onSettings(fn: (s: Settings) => void) {
  listeners.push(fn);
  fn(current);
}
