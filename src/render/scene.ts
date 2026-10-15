import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { onSettings, type Quality } from '../settings/settings';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PLAYER } from '../config/player';
import type { MapData } from '../maps/testArena';
import type { PlayerState } from '../sim/player';
import { createSpearViewmodel, createThrownSpear } from './viewmodel';

// Render resolution per preset: cap devicePixelRatio (Retina/4K) and optionally render below native.
const QUALITY: Record<Quality, { maxDpr: number; scale: number }> = {
  low: { maxDpr: 1, scale: 0.75 },
  medium: { maxDpr: 1.5, scale: 1 },
  high: { maxDpr: 2, scale: 1 },
};

/** Blockout scene. Reads sim state; never writes to it. */
export function createRenderer(canvas: HTMLCanvasElement, map: MapData) {
  const engine = new Engine(canvas, true, { stencil: false }, false);

  const scene = new Scene(engine);
  const sky = new Color3(0.55, 0.62, 0.58);
  scene.clearColor = Color4.FromColor3(sky);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.02;
  scene.fogColor = sky;

  const camera = new FreeCamera('eye', new Vector3(0, PLAYER.eyeHeight, 0), scene);
  camera.minZ = 0.05;
  camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED; // FOV setting means the same on any aspect ratio

  const skyLight = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  skyLight.intensity = 0.7;
  skyLight.groundColor = new Color3(0.35, 0.38, 0.28); // grass bounce; default black leaves undersides pitch dark
  new DirectionalLight('sun', new Vector3(-0.5, -1, 0.3), scene).intensity = 0.8;

  const groundMat = new StandardMaterial('ground', scene);
  groundMat.diffuseColor = new Color3(0.33, 0.4, 0.22);
  groundMat.specularColor = Color3.Black();
  CreateGround('ground', { width: map.size, height: map.size }, scene).material = groundMat;

  const rockMat = new StandardMaterial('rock', scene);
  rockMat.diffuseColor = new Color3(0.45, 0.4, 0.34);
  rockMat.specularColor = Color3.Black();
  for (const b of map.boxes) {
    if (b.hidden) continue;
    const box = CreateBox('box', { width: b.w, depth: b.d, height: b.h }, scene);
    box.position.set(b.x, b.h / 2, b.z);
    box.material = rockMat;
    box.freezeWorldMatrix();
  }

  const viewmodel = createSpearViewmodel(scene, camera);
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
  });

  /** Short camera shake on impact; off when disabled in settings or the OS asks for reduced motion. */
  function shake() {
    if (shakeEnabled && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      shakeUntil = performance.now() + SHAKE_MS;
  }

  return { engine, scene, camera, render, viewmodel, thrownSpear, shake };
}
