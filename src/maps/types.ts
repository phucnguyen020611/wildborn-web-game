import type { PropId } from '../config/props';
import type { CreatureKind } from '../config/creatures';
import type { Terrain } from '../sim/terrain';

/** Box standing on y (default 0): center (x, z), size (w, d), height h. */
export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y?: number; // base height (on terrain)
  hidden?: boolean; // collision only (e.g. a tree trunk); not drawn as a blockout box
}

export interface Prop {
  id: PropId;
  variant?: number; // index into PROPS[id].nodes (default 0)
  x: number;
  y?: number; // ground height under it (default 0)
  z: number;
  rot: number;
  scale: number;
}

export interface CreatureSpawn {
  kind: CreatureKind;
  waypoints: { x: number; z: number }[]; // spawns at the first, then patrols the loop
}

export interface MapData {
  size: number; // square arena edge length, centered on origin
  spawn: { x: number; z: number };
  boxes: Box[];
  creatures: CreatureSpawn[];
  props?: Prop[];
  terrain?: Terrain; // flat ground at y = 0 when absent
  water?: number; // water surface height, if the map has any
  paths?: { x: number; z: number }[][]; // trodden trails (polylines), painted as dirt
  time?: number; // hour of day 0-24 (default 10): sun position, light colour, fog
}
