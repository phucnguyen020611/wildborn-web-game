import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { MapData } from '../maps/types';
import { groundAt, slopeAt } from '../sim/terrain';

function canvasTexture(scene: Scene, name: string, draw: (c: CanvasRenderingContext2D) => void) {
  const tex = new DynamicTexture(name, 128, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  c.clearRect(0, 0, 128, 128);
  draw(c);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/**
 * Way-finding without arrows: a smoke column over every camp fire (seen over the trees from far off),
 * and the boss's footprints pressed into the last stretch of each route to its arena.
 */
export function createLandmarks(scene: Scene, map: MapData) {
  const puff = canvasTexture(scene, 'smoke_puff', (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  for (const f of map.camps ?? []) {
    const ps = new ParticleSystem('camp_smoke', 90, scene);
    ps.particleTexture = puff;
    ps.emitter = new Vector3(f.x, groundAt(map, f.x, f.z) + 0.4, f.z);
    ps.minEmitBox = new Vector3(-0.2, 0, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 0, 0.2);
    ps.color1 = new Color4(0.62, 0.6, 0.58, 0.5);
    ps.color2 = new Color4(0.5, 0.48, 0.46, 0.4);
    ps.colorDead = new Color4(0.7, 0.7, 0.7, 0);
    ps.minSize = 0.8;
    ps.maxSize = 1.6;
    ps.addSizeGradient(0, 0.6);
    ps.addSizeGradient(1, 5); // billows out as it rises
    ps.minLifeTime = 7;
    ps.maxLifeTime = 10;
    ps.emitRate = 9;
    ps.minEmitPower = 1.6;
    ps.maxEmitPower = 2.4;
    ps.direction1 = new Vector3(0.1, 1, 0);
    ps.direction2 = new Vector3(0.35, 1, 0.15); // drifts a little downwind
    ps.gravity = new Vector3(0.05, 0, 0.02);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.preWarmCycles = 120; // already a column when the act starts
    ps.start();
  }

  const tracks = map.tracks ?? [];
  if (!tracks.length) return;
  // Mammoth print: a broad round pad pressed into the earth, with a rim of pushed-up soil and toe marks.
  const mat = new StandardMaterial('mammoth_track', scene);
  mat.diffuseTexture = canvasTexture(scene, 'mammoth_track_tex', (c) => {
    const blob = (x: number, y: number, rx: number, ry: number, fill: string) => {
      c.fillStyle = fill;
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    };
    blob(64, 66, 52, 56, 'rgba(110,86,58,0.55)'); // pushed-up rim
    blob(64, 68, 44, 48, 'rgba(40,30,20,0.85)'); // the print
    blob(64, 70, 34, 38, 'rgba(30,22,15,0.9)');
    for (const x of [36, 52, 76, 92]) blob(x, 24, 7, 5, 'rgba(25,18,12,0.95)'); // toenails, forward
  });
  mat.useAlphaFromDiffuseTexture = true;
  mat.specularColor = Color3.Black();
  mat.zOffset = -2;
  const plane = CreateGround('mammoth_tracks', { width: 0.9, height: 1 }, scene);
  plane.material = mat;
  plane.isPickable = false;
  const data = new Float32Array(tracks.length * 16);
  const m = new Matrix();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  tracks.forEach((t, i) => {
    const g = slopeAt(map, t.x, t.z);
    const n = new Vector3(-g.x, 1, -g.z).normalize();
    Quaternion.FromUnitVectorsToRef(up, n, q); // lie on the slope
    q.multiplyInPlace(Quaternion.RotationAxis(up, t.rot)); // toes toward the arena
    Matrix.ComposeToRef(Vector3.One(), q, new Vector3(t.x, groundAt(map, t.x, t.z) + 0.03, t.z), m);
    m.copyToArray(data, i * 16);
  });
  plane.thinInstanceSetBuffer('matrix', data, 16, true);
  plane.thinInstanceRefreshBoundingInfo(false);
}
