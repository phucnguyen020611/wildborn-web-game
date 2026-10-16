import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MapData } from '../maps/types';
import { groundAt } from '../sim/terrain';
import type { Vec3 } from '../sim/geometry';

const MAX_MARKS = 40; // oldest ground marks are reused first

/** Hit feedback in the world: blood spray, dust puffs, and marks left on the ground. */
export function createEffects(scene: Scene, map: MapData) {
  const dot = new DynamicTexture('fx_dot', 32, scene, false);
  const ctx = dot.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  dot.update();
  dot.hasAlpha = true;

  function burst(
    at: Vec3,
    color: Color4,
    count: number,
    speed: number,
    size: number,
    gravity: number,
  ) {
    const ps = new ParticleSystem('fx_burst', count, scene);
    ps.particleTexture = dot;
    ps.emitter = new Vector3(at.x, at.y, at.z);
    ps.minEmitBox.setAll(-0.05);
    ps.maxEmitBox.setAll(0.05);
    ps.color1 = color;
    ps.color2 = color.scale(0.75);
    ps.colorDead = new Color4(color.r, color.g, color.b, 0);
    ps.minSize = size * 0.5;
    ps.maxSize = size;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.6;
    ps.minEmitPower = speed * 0.4;
    ps.maxEmitPower = speed;
    ps.direction1 = new Vector3(-1, 0.4, -1);
    ps.direction2 = new Vector3(1, 1.2, 1);
    ps.gravity = new Vector3(0, -gravity, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.manualEmitCount = count;
    ps.targetStopDuration = 0.7;
    ps.disposeOnStop = true;
    ps.start();
  }

  const markMats = new Map<string, StandardMaterial>();
  const marks: Mesh[] = [];
  let next = 0;
  /** Flat splat on the ground; reuses the oldest once MAX_MARKS exist. */
  function mark(x: number, z: number, color: Color3, size: number) {
    const key = color.toHexString();
    if (!markMats.has(key)) {
      const m = new StandardMaterial(`fx_mark_${key}`, scene);
      m.diffuseColor = color;
      m.specularColor = Color3.Black();
      m.zOffset = -2; // draw over the ground it lies on
      markMats.set(key, m);
    }
    let disc = marks[next];
    if (!disc) {
      disc = CreateDisc('fx_mark', { radius: 1, tessellation: 9 }, scene);
      disc.rotation.x = Math.PI / 2;
      disc.isPickable = false;
      marks[next] = disc;
    }
    disc.setEnabled(true);
    disc.material = markMats.get(key)!;
    disc.position.set(x, groundAt(map, x, z) + 0.02, z);
    disc.scaling.set(size * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), 1);
    disc.rotation.y = Math.random() * Math.PI;
    next = (next + 1) % MAX_MARKS;
  }

  const BLOOD = new Color4(0.45, 0.04, 0.03, 1);
  const BLOOD_DARK = new Color3(0.28, 0.04, 0.03);
  const DUST = new Color4(0.55, 0.47, 0.36, 0.8);
  const DIRT = new Color3(0.24, 0.19, 0.13);

  return {
    /** A spear hit on a creature: spray at the wound, a few drops on the ground beneath. */
    blood(at: Vec3) {
      burst(at, BLOOD, 30, 3, 0.12, 9);
      for (let i = 0; i < 3; i++)
        mark(
          at.x + (Math.random() - 0.5) * 1.2,
          at.z + (Math.random() - 0.5) * 1.2,
          BLOOD_DARK,
          0.15,
        );
    },
    /** The thrown spear lands: a puff of earth and a scuff where it went in. */
    dust(at: Vec3) {
      burst(at, DUST, 18, 1.5, 0.35, 2);
      mark(at.x, at.z, DIRT, 0.22);
    },
    clear() {
      marks.forEach((m) => m.setEnabled(false));
    },
  };
}
