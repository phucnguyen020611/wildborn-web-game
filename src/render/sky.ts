import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';
import type { Daylight } from './daylight';

/**
 * Physically based sky dome (Preetham scattering) lit by the sun of `day`, always centred on the camera.
 * Also renders it once into a small cube map: image-based light for PBR materials and the water's reflection.
 */
export function createSky(scene: Scene, day: Daylight) {
  const mat = new SkyMaterial('sky', scene);
  mat.backFaceCulling = false;
  mat.useSunPosition = true;
  mat.sunPosition = new Vector3(...day.toSun).scale(100);
  mat.turbidity = 6; // a little haze, matches the fog
  mat.rayleigh = 1.6;
  mat.mieCoefficient = 0.004;
  mat.mieDirectionalG = 0.85;
  mat.luminance = 1;

  const dome = CreateSphere('sky', { diameter: 900, segments: 16 }, scene);
  dome.material = mat;
  dome.infiniteDistance = true;
  dome.isPickable = false;

  const probe = new ReflectionProbe('sky_probe', 128, scene);
  probe.renderList!.push(dome);
  probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  return { dome, reflection: probe.cubeTexture };
}
