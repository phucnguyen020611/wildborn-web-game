import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { MapData } from '../maps/types';
import { groundAt } from '../sim/terrain';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Scene } from '@babylonjs/core/scene';
import { MirrorTexture } from '@babylonjs/core/Materials/Textures/mirrorTexture';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { onSettings } from '../settings/settings';

const N = 256;
const TILE = 5; // metres per ripple-pattern repeat
const CELL = 0.5; // water mesh resolution: fine enough for a soft shoreline

/** Seamless ripple normal map: a sum of sine waves with whole-number frequencies across the tile. */
function rippleNormals(scene: Scene) {
  const waves = [
    [3, 1, 0.5, 0],
    [-2, 4, 0.35, 1.3],
    [5, -3, 0.2, 2.1],
    [1, 7, 0.12, 0.7],
    [-8, 2, 0.08, 4.2],
  ];
  const height = (u: number, v: number) =>
    waves.reduce((h, [ku, kv, a, p]) => h + a * Math.sin(2 * Math.PI * (ku * u + kv * v) + p), 0);
  const tex = new DynamicTexture('water_ripples', N, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(N, N);
  const e = 1 / N;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const dx = (height(u + e, v) - height(u - e, v)) * 22; // slope steepness: higher = choppier
      const dy = (height(u, v + e) - height(u, v - e)) * 22;
      const l = Math.hypot(dx, dy, 1);
      img.data.set(
        [(-dx / l) * 127 + 128, (-dy / l) * 127 + 128, (1 / l) * 127 + 128, 255],
        (y * N + x) * 4,
      );
    }
  ctx.putImageData(img, 0, 0);
  tex.update();
  return tex;
}

/** Colour and opacity by depth: foam at the waterline, clear and bed-tinted in the shallows, dark when deep. */
export function waterTint(depth: number): [number, number, number, number] {
  if (depth <= 0) return [0.7, 0.72, 0.68, 0];
  if (depth < 0.15) return [0.78, 0.8, 0.76, 0.6 * (depth / 0.15) + 0.2]; // foam line
  const k = Math.min(1, (depth - 0.15) / 0.85); // 0 shallow .. 1 deep
  const mix = (a: number, b: number) => a + (b - a) * k;
  return [mix(0.3, 0.02), mix(0.33, 0.08), mix(0.22, 0.07), mix(0.38, 0.94)];
}

/** Flat water mesh at `level` covering only where the ground dips below it, coloured by depth. */
function waterMesh(scene: Scene, map: MapData, level: number) {
  const half = map.size / 2;
  const n = Math.round(map.size / CELL);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const index = new Map<number, number>();
  const vertex = (i: number, j: number) => {
    const key = i * (n + 1) + j;
    let v = index.get(key);
    if (v === undefined) {
      const x = -half + i * CELL;
      const z = -half + j * CELL;
      v = positions.length / 3;
      positions.push(x, 0, z);
      uvs.push(x / map.size + 0.5, z / map.size + 0.5);
      colors.push(...waterTint(level - groundAt(map, x, z)));
      index.set(key, v);
    }
    return v;
  };
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = -half + (i + 0.5) * CELL;
      const z = -half + (j + 0.5) * CELL;
      if (groundAt(map, x, z) > level + CELL) continue; // dry land: no water here
      const a = vertex(i, j),
        b = vertex(i + 1, j),
        c = vertex(i + 1, j + 1),
        d = vertex(i, j + 1);
      indices.push(a, b, c, a, c, d);
    }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  data.uvs = uvs;
  data.normals = positions.map((_, i) => (i % 3 === 1 ? 1 : 0));
  const mesh = new Mesh('water', scene);
  data.applyToMesh(mesh);
  mesh.hasVertexAlpha = true;
  return mesh;
}

/**
 * Water surface: clear in the shallows (the bed shows through), dark when deep, a pale foam line along
 * the banks; reflection grows toward grazing angles and sun glints off drifting ripples. Medium/High
 * quality reflect the banks, trees and sky in a planar mirror (bent by the ripples); Low only the sky.
 */
export function createWater(
  scene: Scene,
  map: MapData,
  level: number,
  skyCube: BaseTexture,
  reflects: (m: AbstractMesh) => boolean, // what the mirror shows (sky, ground, big props)
) {
  const size = map.size;
  const water = waterMesh(scene, map, level);
  water.position.y = level;
  water.isPickable = false;

  const mat = new StandardMaterial('water', scene);
  mat.diffuseColor = Color3.White(); // the vertex colours carry the depth tint
  mat.specularColor = new Color3(0.9, 0.85, 0.75);
  mat.specularPower = 180;
  const bump = rippleNormals(scene);
  bump.uScale = bump.vScale = size / TILE;
  bump.level = 1.5; // ripples read from walking height
  mat.bumpTexture = bump;
  const fresnel = new FresnelParameters({
    leftColor: Color3.White(), // grazing: mirror-like
    rightColor: new Color3(0.05, 0.05, 0.05), // looking straight down: mostly see-through
    power: 4,
  });
  mat.reflectionFresnelParameters = fresnel;
  mat.alpha = 0.999; // < 1 so it blends: the per-vertex alpha does the rest
  water.material = mat;
  water.freezeWorldMatrix();

  const mirror = new MirrorTexture('water_mirror', 512, scene, true);
  mirror.mirrorPlane = new Plane(0, -1, 0, level);
  // The predicate runs over every mesh every refresh, so whether a mesh is worth reflecting (the right
  // kind, and standing near the water) is worked out once per mesh.
  const worth = new Map<number, boolean>();
  const nearWater = (m: AbstractMesh) => {
    if (m.getClassName() !== 'InstancedMesh') return true; // sky dome, ground
    const p = m.getAbsolutePosition();
    return [
      [0, 0],
      [12, 0],
      [-12, 0],
      [0, 12],
      [0, -12],
    ].some(([dx, dz]) => groundAt(map, p.x + dx, p.z + dz) < level + 0.3);
  };
  mirror.renderListPredicate = (m) => {
    let ok = worth.get(m.uniqueId);
    if (ok === undefined) worth.set(m.uniqueId, (ok = m !== water && reflects(m) && nearWater(m)));
    return ok && m.isEnabled();
  };
  mirror.level = 0.35; // water reflects part of the light; full strength looks like a mirror
  onSettings((st) => {
    const planar = st.quality !== 'low';
    mat.reflectionTexture = planar ? mirror : skyCube;
    mirror.refreshRate = st.quality === 'high' ? 1 : 2; // Medium redraws the reflection every other frame
    // The HDR sky alone is far brighter than reflected banks, so it gets dimmed more.
    fresnel.leftColor = planar ? Color3.White() : new Color3(0.3, 0.32, 0.32);
  });

  // Ripples drift downstream (the creek runs roughly along x).
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    bump.uOffset = (bump.uOffset + dt * 0.08) % 1;
    bump.vOffset = (bump.vOffset + dt * 0.02) % 1;
  });
  return water;
}
