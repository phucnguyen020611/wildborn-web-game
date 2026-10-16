import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { onSettings, type Quality } from '../settings/settings';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { createSky } from './sky';
import { createGround } from './terrain';
import { PLAYER } from '../config/player';
import type { MapData } from '../maps/types';
import type { PlayerState } from '../sim/player';
import { createSpearViewmodel, createThrownSpear } from './viewmodel';
import { createMotion } from './motion';

// Per preset: cap devicePixelRatio (Retina/4K), optionally render below native, and toggle sun shadows.
const QUALITY: Record<Quality, { maxDpr: number; scale: number; shadows: boolean }> = {
  low: { maxDpr: 1, scale: 0.75, shadows: false },
  medium: { maxDpr: 1.5, scale: 1, shadows: true },
  high: { maxDpr: 2, scale: 1, shadows: true },
};

// Palette (docs/ART_GUIDE.md): soft daylight, horizon haze doubles as fog so distant trees fade into the sky.
const HORIZON = new Color3(0.78, 0.84, 0.78);

/** World scene: sky, light, ground, viewmodel. Reads sim state; never writes to it. */
export function createRenderer(canvas: HTMLCanvasElement, map: MapData) {
  const engine = new Engine(canvas, true, { stencil: false }, false);

  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(HORIZON);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.014;
  scene.fogColor = HORIZON;
  createSky(scene, [
    [0, '#5f97c4'], // zenith
    [0.42, '#a9c6d8'],
    [0.5, HORIZON.toHexString()], // horizon
    [1, HORIZON.toHexString()],
  ]);

  const camera = new FreeCamera('eye', new Vector3(0, PLAYER.eyeHeight, 0), scene);
  camera.minZ = 0.05;
  camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED; // FOV setting means the same on any aspect ratio

  const skyLight = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  skyLight.intensity = 0.65;
  skyLight.diffuse = new Color3(0.88, 0.93, 1); // cool skylight
  skyLight.groundColor = new Color3(0.35, 0.38, 0.28); // grass bounce; default black leaves undersides pitch dark
  const sun = new DirectionalLight('sun', new Vector3(-0.55, -0.75, 0.4), scene);
  sun.intensity = 1.25;
  sun.diffuse = new Color3(1, 0.94, 0.82); // warm sunlight
  sun.position = sun.direction.scale(-60);
  sun.autoCalcShadowZBounds = true; // fit depth range to the casters; the camera's 10 km range would swamp the bias

  // One shadow-casting light (spec 12.1): creatures and boulders cast, the ground receives.
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;
  const castShadow = (m: AbstractMesh) => shadows.addShadowCaster(m, false);

  createGround(scene, map);

  const rockMat = new StandardMaterial('rock', scene);
  rockMat.diffuseColor = new Color3(0.45, 0.4, 0.34);
  rockMat.specularColor = Color3.Black();
  for (const b of map.boxes) {
    if (b.hidden) continue;
    const box = CreateBox('box', { width: b.w, depth: b.d, height: b.h }, scene);
    box.position.set(b.x, (b.y ?? 0) + b.h / 2, b.z);
    box.material = rockMat;
    box.freezeWorldMatrix();
  }

  const motion = createMotion();
  const viewmodel = createSpearViewmodel(scene, camera, motion.out);
  const thrownSpear = createThrownSpear(scene);

  let shakeUntil = 0;
  const SHAKE_MS = 150;
  const SHAKE_M = 0.035;

  window.addEventListener('resize', () => engine.resize());

  /** Interpolates position between the last two sim states; look is applied unsmoothed for zero added latency. */
  function render(prev: PlayerState, curr: PlayerState, alpha: number, yaw: number, pitch: number) {
    camera.position.set(
      prev.x + (curr.x - prev.x) * alpha,
      prev.y + (curr.y - prev.y) * alpha + PLAYER.eyeHeight,
      prev.z + (curr.z - prev.z) * alpha,
    );
    camera.rotation.set(pitch, yaw, 0);
    const m = motion.update(prev, curr, yaw, pitch, performance.now());
    if (bobEnabled()) {
      // Bob along the view's right vector, so it sways sideways whichever way you face.
      camera.position.x += Math.cos(yaw) * m.camX;
      camera.position.z -= Math.sin(yaw) * m.camX;
      camera.position.y += m.camY;
    }
    const shake = Math.max(0, shakeUntil - performance.now()) / SHAKE_MS; // 1 -> 0
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * SHAKE_M * shake;
      camera.position.y += (Math.random() - 0.5) * SHAKE_M * shake;
    }
    scene.render();
  }

  let shakeEnabled = true;
  onSettings((st) => {
    camera.fov = (st.fov * Math.PI) / 180;
    const q = QUALITY[st.quality];
    engine.setHardwareScalingLevel(1 / (Math.min(window.devicePixelRatio, q.maxDpr) * q.scale));
    shakeEnabled = st.shake;
    sun.shadowEnabled = q.shadows;
  });

  // Camera shake and head bob: off when disabled in settings or the OS asks for reduced motion.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bobEnabled = () => shakeEnabled && !reduced.matches;

  /** Short camera shake on impact. */
  function shake() {
    if (bobEnabled()) shakeUntil = performance.now() + SHAKE_MS;
  }

  return { engine, scene, camera, render, viewmodel, thrownSpear, shake, castShadow };
}
