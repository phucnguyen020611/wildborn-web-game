import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import type { MapData } from '../maps/types';
import { fbm, mulberry32 } from '../maps/scatter';
import { groundAt } from '../sim/terrain';
import { onSettings, type Quality } from '../settings/settings';
import { groundWeights } from './terrain';
import { addWind } from './wind';

const CHUNK = 16; // metres; chunks are culled and hidden by distance as a whole
const SPACING = 0.5; // one tuft per cell at most: up to 4 per m²
const DRAW: Record<Quality, number> = { low: 0, medium: 28, high: 42 }; // metres; 0 = off
const BLADES = 5;
const BASE = new Color3(0.13, 0.22, 0.07);
const TIP = new Color3(0.55, 0.62, 0.3);

/** One tuft: a few curved, tapering blades, dark at the root and sunlit at the tip. */
function tuft() {
  const rand = mulberry32(9);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let b = 0; b < BLADES; b++) {
    const a = rand() * Math.PI * 2; // blade faces this way
    const lean = 0.08 + rand() * 0.18; // how far the tip bends over
    const h = 0.35 + rand() * 0.35;
    const w = 0.025 + rand() * 0.02;
    const ox = (rand() - 0.5) * 0.2;
    const oz = (rand() - 0.5) * 0.2;
    const tint = 0.85 + rand() * 0.3;
    const first = positions.length / 3;
    for (let s = 0; s <= 3; s++) {
      const t = s / 3;
      const cx = ox + Math.cos(a) * lean * t * t;
      const cz = oz + Math.sin(a) * lean * t * t;
      const half = w * (1 - t) + 0.002;
      const sx = -Math.sin(a) * half; // across the blade
      const sz = Math.cos(a) * half;
      const c = Color3.Lerp(BASE, TIP, t).scale(tint);
      if (s < 3) {
        positions.push(cx - sx, h * t, cz - sz, cx + sx, h * t, cz + sz);
        colors.push(c.r, c.g, c.b, 1, c.r, c.g, c.b, 1);
      } else {
        positions.push(cx, h, cz); // single tip vertex
        colors.push(c.r, c.g, c.b, 1);
      }
    }
    for (let s = 0; s < 2; s++) {
      const i = first + s * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
    indices.push(first + 4, first + 5, first + 6);
  }
  const data = new VertexData();
  data.positions = positions;
  data.colors = colors;
  data.indices = indices;
  // Straight-up normals: tufts take the ground's lighting instead of flickering as the blades turn.
  data.normals = positions.map((_, i) => (i % 3 === 1 ? 1 : 0));
  return data;
}

/**
 * Dense ground cover where the ground is grass: GPU thin instances in CHUNK-sized patches, each one
 * draw call, shown only within the quality preset's draw distance. Patchy (noise) so it isn't a carpet.
 */
export function createGrass(scene: Scene, map: MapData, camera: Camera) {
  const blades = tuft();
  const mat = new StandardMaterial('grass_blades', scene);
  mat.backFaceCulling = false;
  mat.specularColor = Color3.Black();
  addWind(mat, 0.3);

  const half = map.size / 2;
  const m = new Matrix();
  const q = new Quaternion();
  const scale = new Vector3();
  const pos = new Vector3();
  /** Tuft transforms for one chunk, worked out the first time it comes in range (big maps load fast). */
  const tufts = (cx: number, cz: number) => {
    const rand = mulberry32(17 + Math.round(cx) * 7919 + Math.round(cz) * 104729); // same tufts every time
    // Solid props here (rocks, trunks, tents) keep grass from poking through them.
    const solids = map.boxes.filter(
      (b) =>
        Math.abs(b.x - (cx + CHUNK / 2)) < CHUNK / 2 + b.w &&
        Math.abs(b.z - (cz + CHUNK / 2)) < CHUNK / 2 + b.d,
    );
    const matrices: number[] = [];
    for (let z = cz; z < cz + CHUNK; z += SPACING)
      for (let x = cx; x < cx + CHUNK; x += SPACING) {
        const px = x + rand() * SPACING;
        const pz = z + rand() * SPACING;
        const patch =
          0.25 + 0.75 * Math.min(1, Math.max(0, (fbm(px / 14, pz / 14, 31) - 0.3) * 2.5));
        if (rand() > groundWeights(map, px, pz).grass * patch) continue;
        if (solids.some((b) => Math.abs(px - b.x) < b.w / 2 && Math.abs(pz - b.z) < b.d / 2))
          continue;
        const s = 0.7 + rand() * 0.7;
        scale.set(s, s * (0.8 + rand() * 0.5), s);
        Quaternion.RotationYawPitchRollToRef(rand() * Math.PI * 2, 0, 0, q);
        pos.set(px, groundAt(map, px, pz) - 0.02, pz);
        Matrix.ComposeToRef(scale, q, pos, m);
        matrices.push(...m.asArray());
      }
    return new Float32Array(matrices);
  };
  const chunks: { mesh: Mesh | null; empty: boolean; x: number; z: number }[] = [];
  for (let cz = -half; cz < half; cz += CHUNK)
    for (let cx = -half; cx < half; cx += CHUNK)
      chunks.push({ mesh: null, empty: false, x: cx + CHUNK / 2, z: cz + CHUNK / 2 });

  // A chunk's mesh is made the first time it comes within range, so loading doesn't pay for the whole map.
  const build = (c: (typeof chunks)[number]) => {
    const data = tufts(c.x - CHUNK / 2, c.z - CHUNK / 2);
    if (!data.length) {
      c.empty = true;
      return null;
    }
    // Own geometry per chunk (35 vertices): clones sharing one geometry drew with another chunk's
    // instance buffer ("vertex buffer is not big enough") and showed nothing.
    const mesh = new Mesh(`grass_${c.x}_${c.z}`, scene);
    blades.applyToMesh(mesh);
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.thinInstanceSetBuffer('matrix', data, 16, true);
    mesh.thinInstanceRefreshBoundingInfo(false);
    return mesh;
  };

  let draw = DRAW.medium;
  onSettings((st) => (draw = DRAW[st.quality]));
  const reach = CHUNK * 0.71; // chunk centre to corner
  scene.onBeforeRenderObservable.add(() => {
    const p = camera.globalPosition;
    let budget = 3; // chunks built per frame: walking into new ground never stalls a frame
    for (const c of chunks) {
      const near = draw > 0 && Math.hypot(c.x - p.x, c.z - p.z) - reach < draw;
      if (near && !c.mesh && !c.empty && budget-- > 0) c.mesh = build(c);
      c.mesh?.setEnabled(near);
    }
  });
  return chunks.length;
}
