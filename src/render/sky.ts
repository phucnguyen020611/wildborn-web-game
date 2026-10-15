import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Gradient sky dome (zenith -> horizon -> ground haze). Unlit, ignores fog, always centred on the camera.
 * `stops` run from the top of the sky (0) to straight down (1), in CSS colours.
 */
export function createSky(scene: Scene, stops: [number, string][]) {
  const tex = new DynamicTexture('sky_gradient', { width: 4, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of stops) g.addColorStop(1 - at, color); // texture v runs bottom-up on the sphere
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  tex.update();
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;

  const mat = new StandardMaterial('sky', scene);
  mat.emissiveTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.fogEnabled = false;
  mat.diffuseColor = mat.specularColor = Color3.Black();

  const dome = CreateSphere('sky', { diameter: 900, segments: 16 }, scene);
  dome.material = mat;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  return dome;
}
