import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
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
const TILE = 9; // metres per ripple-pattern repeat

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
      const dx = (height(u + e, v) - height(u - e, v)) * 14; // slope steepness: higher = choppier
      const dy = (height(u, v + e) - height(u, v - e)) * 14;
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

/**
 * Water surface: reflection that grows toward grazing angles, see-through when looking down, sun glints
 * off drifting ripples. Medium/High quality reflect the banks, trees and sky in a planar mirror (bent by
 * the ripples); Low reflects only the sky cube. One plane at `level`; the terrain decides where it shows.
 */
export function createWater(
  scene: Scene,
  size: number,
  level: number,
  skyCube: BaseTexture,
  reflects: (m: AbstractMesh) => boolean, // what the mirror shows (sky, ground, big props)
) {
  const water = CreateGround('water', { width: size, height: size }, scene);
  water.position.y = level;
  water.isPickable = false;

  const mat = new StandardMaterial('water', scene);
  mat.diffuseColor = new Color3(0.05, 0.14, 0.13);
  mat.specularColor = new Color3(0.9, 0.85, 0.75);
  mat.specularPower = 180;
  const bump = rippleNormals(scene);
  bump.uScale = bump.vScale = size / TILE;
  mat.bumpTexture = bump;
  const fresnel = new FresnelParameters({
    leftColor: Color3.White(), // grazing: mirror-like
    rightColor: new Color3(0.05, 0.05, 0.05), // looking straight down: mostly see-through
    power: 3,
  });
  mat.reflectionFresnelParameters = fresnel;
  mat.alpha = 0.85;
  mat.opacityFresnelParameters = new FresnelParameters({
    leftColor: Color3.White(),
    rightColor: new Color3(0.6, 0.6, 0.6),
    power: 2,
  });
  water.material = mat;
  water.freezeWorldMatrix();

  const mirror = new MirrorTexture('water_mirror', 512, scene, true);
  mirror.mirrorPlane = new Plane(0, -1, 0, level);
  mirror.renderListPredicate = (m) => m !== water && m.isEnabled() && reflects(m);
  mirror.level = 0.5; // water reflects ~half the light; full strength looks like a mirror
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
    bump.uOffset = (bump.uOffset + dt * 0.04) % 1;
    bump.vOffset = (bump.vOffset + dt * 0.012) % 1;
  });
  return water;
}
