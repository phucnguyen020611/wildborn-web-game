/** Lighting for an hour of the day (0-24), shared by the sky, lights and fog. Pure: no Babylon objects. */
export interface Daylight {
  toSun: [number, number, number]; // unit vector toward the sun (for the sky), +z north, +x east
  toLight: [number, number, number]; // toward the light that casts shadows: the sun, or the moon at night
  light: [number, number, number]; // its colour (linear 0..1)
  lightIntensity: number;
  sky: [number, number, number]; // hemispheric fill colour
  skyIntensity: number;
  horizon: [number, number, number]; // fog and clear colour, close to the sky's horizon
}

type RGB = [number, number, number];
// Keyed on the sun's elevation in degrees; values in between are blended.
const KEYS: { elev: number; light: RGB; li: number; sky: RGB; si: number; horizon: RGB }[] = [
  {
    elev: -12,
    light: [0.45, 0.55, 0.8],
    li: 0.3,
    sky: [0.3, 0.38, 0.58],
    si: 0.28,
    horizon: [0.06, 0.08, 0.13],
  }, // night, moonlit
  {
    elev: -4,
    light: [0.75, 0.45, 0.4],
    li: 0.15,
    sky: [0.48, 0.42, 0.58],
    si: 0.32,
    horizon: [0.3, 0.25, 0.32],
  }, // dusk
  {
    elev: 3,
    light: [1, 0.52, 0.28],
    li: 0.8,
    sky: [0.72, 0.58, 0.6],
    si: 0.45,
    horizon: [0.7, 0.56, 0.5],
  }, // sunset
  {
    elev: 12,
    light: [1, 0.76, 0.52],
    li: 1.1,
    sky: [0.82, 0.84, 0.92],
    si: 0.58,
    horizon: [0.78, 0.74, 0.68],
  }, // golden hour
  {
    elev: 35,
    light: [1, 0.94, 0.82],
    li: 1.25,
    sky: [0.88, 0.93, 1],
    si: 0.65,
    horizon: [0.76, 0.83, 0.86],
  }, // day
  {
    elev: 62,
    light: [1, 0.97, 0.9],
    li: 1.3,
    sky: [0.9, 0.95, 1],
    si: 0.7,
    horizon: [0.78, 0.85, 0.9],
  }, // noon
];

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Direction toward a body that rises in the east at `hour` 6 and sets in the west at 18. */
function arc(hour: number): RGB {
  const a = (Math.PI * (hour - 6)) / 12; // 0 at sunrise, π at sunset
  const elev = ((62 * Math.PI) / 180) * Math.sin(a);
  return [Math.cos(a) * Math.cos(elev), Math.sin(elev), -Math.sin(a) * Math.cos(elev) * 0.8 - 0.2];
}

export function daylight(hour: number): Daylight {
  const toSun = normalize(arc(hour));
  const elev = (Math.asin(toSun[1]) * 180) / Math.PI;
  let i = KEYS.findIndex((k) => k.elev > elev);
  if (i < 0) i = KEYS.length - 1;
  const lo = KEYS[Math.max(0, i - 1)];
  const hi = KEYS[i];
  const t = hi === lo ? 0 : Math.max(0, Math.min(1, (elev - lo.elev) / (hi.elev - lo.elev)));
  const moon = elev < -4; // below dusk the moon (opposite the sun) takes over as the shadow caster
  return {
    toSun,
    toLight: moon ? normalize(arc(hour + 12)) : toSun,
    light: mix(lo.light, hi.light, t),
    lightIntensity: lo.li + (hi.li - lo.li) * t,
    sky: mix(lo.sky, hi.sky, t),
    skyIntensity: lo.si + (hi.si - lo.si) * t,
    horizon: mix(lo.horizon, hi.horizon, t),
  };
}

function normalize(v: RGB): RGB {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
