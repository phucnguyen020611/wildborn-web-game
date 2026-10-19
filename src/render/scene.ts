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
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { createSky } from './sky';
import { daylight } from './daylight';
import { createGround } from './terrain';
import { createGrass } from './grass';
import { PLAYER } from '../config/player';
import type { MapData } from '../maps/types';
import type { PlayerState } from '../sim/player';
import { createSpearViewmodel, createThrownSpear } from './viewmodel';
import { createMotion } from './motion';
import { createEffects } from './effects';
import { createLandmarks } from './landmarks';

// Per preset: cap devicePixelRatio (Retina/4K), optionally render below native, and sun shadow cascades
// (0 = no shadows): more cascades keep near shadows sharp while still covering the distance.
const QUALITY: Record<Quality, { maxDpr: number; scale: number; cascades: number }> = {
  low: { maxDpr: 1, scale: 0.75, cascades: 0 },
  medium: { maxDpr: 1.5, scale: 1, cascades: 2 },
  high: { maxDpr: 2, scale: 1, cascades: 3 },
};

/** World scene: sky, light, ground, viewmodel. Reads sim state; never writes to it. */
export function createRenderer(canvas: HTMLCanvasElement, map: MapData) {
  const engine = new Engine(canvas, true, { stencil: false }, false);

  // Hour of day: the map's, or `?time=18` to preview another (spec: one fixed time per act for now).
  const param = Number(new URLSearchParams(location.search).get('time'));
  const day = daylight(param > 0 && param <= 24 ? param : (map.time ?? 10));
  const horizon = new Color3(...day.horizon);

  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(horizon);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.014;
  scene.fogColor = horizon; // haze matches the horizon, so distant trees fade into the sky
  const sky = createSky(scene, day);
  scene.environmentTexture = sky.reflection; // soft sky light on PBR models
  scene.environmentIntensity = 0.4 + 0.4 * day.skyIntensity;

  const camera = new FreeCamera('eye', new Vector3(0, PLAYER.eyeHeight, 0), scene);
  camera.minZ = 0.05;
  camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED; // FOV setting means the same on any aspect ratio

  const skyLight = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  skyLight.intensity = day.skyIntensity;
  skyLight.diffuse = new Color3(...day.sky);
  // Grass bounce; the default black leaves undersides pitch dark.
  skyLight.groundColor = new Color3(0.4, 0.43, 0.32).scale(day.skyIntensity / 0.65);
  const sun = new DirectionalLight('sun', new Vector3(...day.toLight).scale(-1), scene);
  sun.intensity = day.lightIntensity;
  sun.diffuse = new Color3(...day.light);
  sun.position = sun.direction.scale(-60);

  // One shadow-casting light (spec 12.1), in cascades: trees, rocks and creatures cast, the ground receives.
  const shadows = new CascadedShadowGenerator(2048, sun);
  shadows.shadowMaxZ = 90; // beyond this the fog does the work
  shadows.lambda = 0.85; // split mostly logarithmically: detail goes near the player
  shadows.stabilizeCascades = true; // no shimmering edges while turning
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.004;
  shadows.normalBias = 0.03;
  // Casters are kept here and only those near the camera go into the shadow map: on a big map, walking
  // thousands of trees through every cascade each frame costs more than drawing them. Animals (skinned,
  // they move) always cast.
  const casters: AbstractMesh[] = [];
  const castShadow = (m: AbstractMesh) => casters.push(m);
  const SHADOW_RANGE = 70; // metres; shadowMaxZ is 90, and the fog thins what is left
  let lastX = Infinity;
  let lastZ = Infinity;
  let lastCount = 0;
  scene.onBeforeRenderObservable.add(() => {
    const p = camera.globalPosition;
    if (Math.hypot(p.x - lastX, p.z - lastZ) < 4 && casters.length === lastCount) return;
    lastX = p.x;
    lastZ = p.z;
    lastCount = casters.length;
    const list = shadows.getShadowMap()!.renderList!;
    list.length = 0;
    for (const m of casters) {
      const s = m.getBoundingInfo().boundingSphere;
      if (
        m.skeleton ||
        Math.hypot(s.centerWorld.x - p.x, s.centerWorld.z - p.z) < SHADOW_RANGE + s.radiusWorld
      )
        list.push(m);
    }
  });

  createGround(scene, map, sky.reflection);
  createGrass(scene, map, camera);
  createLandmarks(scene, map);

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
  const effects = createEffects(scene, map);

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
    sun.shadowEnabled = q.cascades > 0;
    if (q.cascades) shadows.numCascades = q.cascades;
  });

  // Camera shake and head bob: off when disabled in settings or the OS asks for reduced motion.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bobEnabled = () => shakeEnabled && !reduced.matches;

  /** Short camera shake on impact. */
  function shake() {
    if (bobEnabled()) shakeUntil = performance.now() + SHAKE_MS;
  }

  return {
    engine,
    scene,
    camera,
    render,
    viewmodel,
    thrownSpear,
    effects,
    shake,
    castShadow,
    sky,
    motion: motion.out,
  };
}
