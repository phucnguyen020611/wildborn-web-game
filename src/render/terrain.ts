import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import type { MapData } from '../maps/types';
import { distanceToPaths } from '../maps/paths';
import { fbm } from '../maps/scatter';
import { heightAt } from '../sim/terrain';

// Palette (docs/ART_GUIDE.md).
const GRASS = new Color3(0.36, 0.45, 0.23);
const GRASS_DRY = new Color3(0.5, 0.5, 0.27);
const DIRT = new Color3(0.45, 0.36, 0.24);
const ROCK = new Color3(0.44, 0.41, 0.37);
const MUD = new Color3(0.3, 0.27, 0.2);

const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Grey speckle tiled over the ground so large flat areas don't read as plastic. */
function detailTexture(scene: Scene) {
  const tex = new DynamicTexture('ground_detail', 128, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const v = 215 + Math.floor(fbm((i % 128) / 8, Math.floor(i / 128) / 8, 7, 3) * 40); // tiles: period 16
    img.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  tex.update();
  return tex;
}

/** Ground mesh: flat plane, or the map's heightfield painted by slope, trails and water line. */
export function createGround(scene: Scene, map: MapData) {
  const t = map.terrain;
  const ground = CreateGround(
    'ground',
    { width: map.size, height: map.size, subdivisions: t ? t.cells : 1 },
    scene,
  );
  const mat = new StandardMaterial('ground', scene);
  mat.specularColor = Color3.Black();
  ground.material = mat;
  ground.receiveShadows = true;
  ground.isPickable = false;
  if (!t) {
    mat.diffuseColor = GRASS;
    return ground;
  }

  const pos = ground.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(t, pos[i], pos[i + 2]);
  const indices = ground.getIndices()!;
  const normals: number[] = [];
  VertexData.ComputeNormals(pos, indices, normals);

  const colors = new Float32Array((pos.length / 3) * 4);
  const c = new Color3();
  for (let v = 0; v < pos.length / 3; v++) {
    const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    Color3.LerpToRef(GRASS, GRASS_DRY, smooth(0.4, 0.75, fbm(x / 25, z / 25, 3)), c);
    Color3.LerpToRef(c, DIRT, 1 - smooth(1, 2.2, distanceToPaths(map, x, z)), c);
    Color3.LerpToRef(c, ROCK, smooth(0.78, 0.6, normals[v * 3 + 1]), c); // steeper than ~40-50° -> bare rock
    if (map.water !== undefined) Color3.LerpToRef(c, MUD, 1 - smooth(0.2, 0.8, y - map.water), c);
    colors.set([c.r, c.g, c.b, 1], v * 4);
  }
  ground.setVerticesData(VertexBuffer.PositionKind, pos);
  ground.setVerticesData(VertexBuffer.NormalKind, normals);
  ground.setVerticesData(VertexBuffer.ColorKind, colors);
  ground.refreshBoundingInfo();

  const detail = detailTexture(scene);
  detail.uScale = detail.vScale = map.size / 4;
  mat.diffuseTexture = detail;
  ground.freezeWorldMatrix();

  if (map.water !== undefined) {
    const water = CreateGround('water', { width: map.size, height: map.size }, scene);
    water.position.y = map.water;
    const wm = new StandardMaterial('water', scene);
    wm.diffuseColor = new Color3(0.22, 0.38, 0.4);
    wm.specularColor = new Color3(0.5, 0.55, 0.5);
    wm.specularPower = 64;
    wm.alpha = 0.75;
    water.material = wm;
    water.isPickable = false;
    water.freezeWorldMatrix();
  }
  return ground;
}
