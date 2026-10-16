import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Scene } from '@babylonjs/core/scene';
import { TerrainMaterial } from '@babylonjs/materials/terrain/terrainMaterial';
import type { MapData } from '../maps/types';
import { distanceToPaths } from '../maps/paths';
import { groundAt, heightAt, slopeAt } from '../sim/terrain';
import { createWater } from './water';
import grassUrl from '../assets/textures/ter_grass_ground_diff.ktx2?url';
import grassNorUrl from '../assets/textures/ter_grass_ground_nor.ktx2?url';
import dirtUrl from '../assets/textures/ter_forest_ground_04_diff.ktx2?url';
import dirtNorUrl from '../assets/textures/ter_forest_ground_04_nor.ktx2?url';
import rockUrl from '../assets/textures/ter_rocky_terrain_02_diff.ktx2?url';
import rockNorUrl from '../assets/textures/ter_rocky_terrain_02_nor.ktx2?url';

const TILE = 7; // metres per texture repeat: the photo textures read as noise when tiled smaller
const MIX = 512; // mix map resolution over the whole map

const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** How much grass, dirt (trails, mud by the water) and bare rock (steep slopes) covers (x, z); sums to 1. */
export function groundWeights(map: MapData, x: number, z: number) {
  const g = slopeAt(map, x, z);
  const up = 1 / Math.hypot(1, g.x, g.z); // normal's y: 1 flat, ~0.7 at 45°
  const rock = smooth(0.8, 0.65, up);
  let dirt = 1 - smooth(1, 2.2, distanceToPaths(map, x, z));
  if (map.water !== undefined)
    dirt = Math.max(dirt, 1 - smooth(0.2, 0.9, groundAt(map, x, z) - map.water));
  dirt *= 1 - rock;
  return { grass: Math.max(0, 1 - rock - dirt), dirt, rock };
}

/** Mix map for TerrainMaterial: red = grass, green = dirt, blue = rock. Canvas top row is the map's +z edge. */
function mixTexture(scene: Scene, map: MapData) {
  const tex = new DynamicTexture('ground_mix', MIX, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(MIX, MIX);
  for (let py = 0; py < MIX; py++)
    for (let px = 0; px < MIX; px++) {
      const w = groundWeights(map, (px / MIX - 0.5) * map.size, (0.5 - py / MIX) * map.size);
      img.data.set([w.grass * 255, w.dirt * 255, w.rock * 255, 255], (py * MIX + px) * 4);
    }
  ctx.putImageData(img, 0, 0);
  tex.update();
  tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

/** Ground mesh (flat, or the map's heightfield) textured with grass, forest floor and rock, blended by a mix map. */
export function createGround(scene: Scene, map: MapData, reflection: BaseTexture) {
  const t = map.terrain;
  const ground = CreateGround(
    'ground',
    { width: map.size, height: map.size, subdivisions: t ? t.cells : 1 },
    scene,
  );
  ground.receiveShadows = true;
  ground.isPickable = false;
  if (t) {
    const pos = ground.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(t, pos[i], pos[i + 2]);
    const normals: number[] = [];
    VertexData.ComputeNormals(pos, ground.getIndices()!, normals);
    ground.setVerticesData(VertexBuffer.PositionKind, pos);
    ground.setVerticesData(VertexBuffer.NormalKind, normals);
    ground.refreshBoundingInfo();
  }

  const mat = new TerrainMaterial('ground', scene);
  mat.mixTexture = mixTexture(scene, map);
  const tiled = (url: string) => {
    const tex = new Texture(url, scene);
    tex.uScale = tex.vScale = map.size / TILE;
    return tex;
  };
  mat.diffuseTexture1 = tiled(grassUrl);
  mat.diffuseTexture2 = tiled(dirtUrl);
  mat.diffuseTexture3 = tiled(rockUrl);
  mat.bumpTexture1 = tiled(grassNorUrl);
  mat.bumpTexture2 = tiled(dirtNorUrl);
  mat.bumpTexture3 = tiled(rockNorUrl);
  mat.specularColor = Color3.Black();
  ground.material = mat;
  ground.freezeWorldMatrix();

  if (map.water !== undefined) {
    // The mirror shows the sky, the ground and the big shapes along the banks (not grass or flowers).
    const big = /^(sky|ground|tree_|rock_|tent|log|bones)/;
    createWater(scene, map.size, map.water, reflection, (m) => big.test(m.name));
  }
  return ground;
}
