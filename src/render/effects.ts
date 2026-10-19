import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MapData } from '../maps/types';
import { groundAt, slopeAt } from '../sim/terrain';
import type { Vec3 } from '../sim/geometry';

const MAX_MARKS = 60; // oldest marks are reused first
type Surface = 'stone' | 'wood' | 'hide' | 'bone' | 'ground';

/** Small seeded random so every mark texture is the same between runs. */
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/** Draws a decal texture on a 128² canvas; transparent where nothing is drawn. Canvas top = mark's "up". */
function decalTexture(
  scene: Scene,
  name: string,
  draw: (c: CanvasRenderingContext2D, r: () => number) => void,
) {
  const tex = new DynamicTexture(name, 128, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  c.clearRect(0, 0, 128, 128);
  draw(c, rng(name.length * 7919));
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

const blob = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
) => {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
};

/** Irregular splat: overlapping lobes plus thrown droplets, for blood on the ground and on hides. */
function splatter(
  c: CanvasRenderingContext2D,
  r: () => number,
  wet: string,
  dark: string,
  spread = 1,
) {
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 34 * spread;
    blob(c, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + r() * 6, 3 + r() * 6, wet);
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 14;
    blob(c, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 10 + r() * 12, 8 + r() * 10, dark);
  }
  blob(c, 64, 64, 16, 14, dark);
}

/**
 * Hit feedback in the world: blood spray and splats, a blood trail from wounded animals, and the
 * mark a spear thrust leaves on whatever stops it (chipped stone, a gash in wood, a hole in the earth).
 */
export function createEffects(scene: Scene, map: MapData) {
  const dot = decalTexture(scene, 'fx_dot', (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });

  function burst(
    at: Vec3,
    color: Color4,
    count: number,
    speed: number,
    size: number,
    gravity: number,
    dir?: Vector3, // main direction (spray), else all around and upward
    stretched = false,
  ) {
    const ps = new ParticleSystem('fx_burst', count, scene);
    ps.particleTexture = dot;
    ps.emitter = new Vector3(at.x, at.y, at.z);
    ps.minEmitBox.setAll(-0.04);
    ps.maxEmitBox.setAll(0.04);
    ps.color1 = color;
    ps.color2 = new Color4(color.r * 0.6, color.g * 0.6, color.b * 0.6, color.a);
    ps.colorDead = new Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 0);
    ps.minSize = size * 0.4;
    ps.maxSize = size;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.minEmitPower = speed * 0.3;
    ps.maxEmitPower = speed;
    if (dir) {
      ps.direction1 = dir.add(new Vector3(-0.5, 0.1, -0.5));
      ps.direction2 = dir.add(new Vector3(0.5, 0.8, 0.5));
    } else {
      ps.direction1 = new Vector3(-1, 0.4, -1);
      ps.direction2 = new Vector3(1, 1.2, 1);
    }
    if (stretched) ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED; // streaks along their flight
    ps.gravity = new Vector3(0, -gravity, 0);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.manualEmitCount = count;
    ps.targetStopDuration = 0.9;
    ps.disposeOnStop = true;
    ps.start();
  }

  const mats = new Map<string, StandardMaterial>();
  function decalMaterial(
    key: string,
    draw: (c: CanvasRenderingContext2D, r: () => number) => void,
  ) {
    let m = mats.get(key);
    if (!m) {
      m = new StandardMaterial(`fx_${key}`, scene);
      m.diffuseTexture = decalTexture(scene, `fx_${key}_tex`, draw);
      m.useAlphaFromDiffuseTexture = true;
      m.specularColor = new Color3(0.05, 0.05, 0.05);
      m.backFaceCulling = false;
      m.zOffset = -2; // draw over the surface it lies on
      mats.set(key, m);
    }
    return m;
  }

  const BLOOD_MAT = () =>
    decalMaterial('blood', (c, r) => splatter(c, r, 'rgba(110,8,6,0.95)', 'rgba(70,4,4,0.97)'));
  const DROPS_MAT = () =>
    decalMaterial('drops', (c, r) => {
      for (let i = 0; i < 7; i++)
        blob(c, 30 + r() * 68, 30 + r() * 68, 2 + r() * 5, 2 + r() * 5, 'rgba(90,6,5,0.95)');
    });
  const MARK: Record<Surface, () => StandardMaterial> = {
    ground: () =>
      decalMaterial('hole_ground', (c, r) => {
        for (let i = 0; i < 18; i++) {
          const a = r() * Math.PI * 2;
          const d = 18 + r() * 26;
          blob(
            c,
            64 + Math.cos(a) * d,
            64 + Math.sin(a) * d,
            3 + r() * 6,
            2 + r() * 4,
            'rgba(88,66,44,0.9)',
          );
        }
        blob(c, 64, 64, 20, 16, 'rgba(48,34,22,0.95)');
        blob(c, 64, 62, 11, 8, 'rgba(18,12,8,1)');
      }),
    stone: () =>
      decalMaterial('chip_stone', (c, r) => {
        c.strokeStyle = 'rgba(40,40,40,0.8)';
        c.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const a = r() * Math.PI * 2;
          c.beginPath();
          c.moveTo(64, 64);
          c.lineTo(64 + Math.cos(a) * (14 + r() * 24), 64 + Math.sin(a) * (14 + r() * 24));
          c.stroke();
        }
        for (let i = 0; i < 6; i++)
          blob(c, 54 + r() * 20, 54 + r() * 20, 5 + r() * 7, 4 + r() * 5, 'rgba(205,200,190,0.85)'); // fresh chipped face
        blob(c, 64, 64, 5, 4, 'rgba(30,30,30,0.95)');
      }),
    wood: () =>
      decalMaterial('gash_wood', (c, r) => {
        // Vertical split along the grain: pale fresh wood with a dark slot, splinters at the ends.
        blob(c, 64, 64, 11, 34, 'rgba(214,176,120,0.95)');
        for (let i = 0; i < 8; i++)
          blob(c, 58 + r() * 12, 26 + r() * 76, 2, 6 + r() * 6, 'rgba(230,196,140,0.9)');
        blob(c, 64, 64, 4, 26, 'rgba(40,24,12,1)');
      }),
    hide: () =>
      decalMaterial('slit_hide', (c) => {
        blob(c, 64, 64, 4, 18, 'rgba(30,18,10,1)');
        blob(c, 64, 64, 8, 22, 'rgba(70,46,28,0.6)');
      }),
    bone: () =>
      decalMaterial('chip_bone', (c, r) => {
        for (let i = 0; i < 5; i++)
          blob(c, 56 + r() * 16, 56 + r() * 16, 4 + r() * 5, 3 + r() * 4, 'rgba(120,108,88,0.8)');
        blob(c, 64, 64, 4, 3, 'rgba(50,44,36,1)');
      }),
  };

  const marks: Mesh[] = [];
  let next = 0;
  const up = new Vector3(0, 1, 0);
  /** Square decal at `at` facing out along `normal`, its top toward world up; reuses the oldest one. */
  function decal(at: Vector3, normal: Vector3, size: number, mat: StandardMaterial, spin = 0) {
    let plane = marks[next];
    if (!plane) {
      plane = CreatePlane('fx_mark', { size: 1 }, scene);
      plane.isPickable = false;
      plane.rotationQuaternion = new Quaternion();
      marks[next] = plane;
    }
    next = (next + 1) % MAX_MARKS;
    const n = normal.normalizeToNew();
    let top = up.subtract(n.scale(Vector3.Dot(up, n)));
    if (top.lengthSquared() < 1e-4) top = new Vector3(Math.cos(spin), 0, Math.sin(spin)); // flat ground: any way round
    top.normalize();
    const forward = n.negate(); // the plane's front face looks down -z, so +z goes into the surface
    const right = Vector3.Cross(top, forward);
    Quaternion.RotationQuaternionFromAxisToRef(right, top, forward, plane.rotationQuaternion!);
    plane.position.copyFrom(at.add(n.scale(0.015)));
    plane.scaling.setAll(size);
    plane.material = mat;
    plane.setEnabled(true);
    return plane;
  }

  const groundNormal = (x: number, z: number) => {
    const g = slopeAt(map, x, z);
    return new Vector3(-g.x, 1, -g.z).normalize();
  };
  function groundDecal(x: number, z: number, size: number, mat: StandardMaterial) {
    decal(
      new Vector3(x, groundAt(map, x, z), z),
      groundNormal(x, z),
      size,
      mat,
      Math.random() * Math.PI * 2,
    );
  }

  const BLOOD = new Color4(0.42, 0.03, 0.02, 1);
  const MIST = new Color4(0.5, 0.06, 0.05, 0.45);
  const DUST = new Color4(0.55, 0.47, 0.36, 0.8);
  const CHIPS = new Color4(0.62, 0.6, 0.56, 1);
  const SPLINTERS = new Color4(0.7, 0.55, 0.36, 1);

  const surfaceOf = (material: string): Surface =>
    /rock|stone|pebble|path/i.test(material)
      ? 'stone'
      : /bark|wood|char|log|stump|tree/i.test(material)
        ? 'wood'
        : /hide|leather/i.test(material)
          ? 'hide'
          : /bone|ivory/i.test(material)
            ? 'bone'
            : 'stone';

  return {
    /**
     * A spear hit on a creature, struck from `from` (the camera): blood sprays out of the far side and
     * back toward the hunter in streaks, a red mist hangs a moment, and splats land on the ground beyond.
     */
    blood(at: Vec3, from: Vector3) {
      const dir = new Vector3(at.x - from.x, 0, at.z - from.z).normalize();
      burst(at, BLOOD, 40, 4, 0.07, 9.8, dir, true);
      burst(at, BLOOD, 14, 2, 0.06, 9.8, dir.scale(-1), true);
      burst(at, MIST, 10, 0.6, 0.35, 0.5);
      for (let i = 0; i < 4; i++) {
        const d = 0.4 + Math.random() * 1.4;
        const s = (Math.random() - 0.5) * 0.9;
        groundDecal(
          at.x + dir.x * d - dir.z * s,
          at.z + dir.z * d + dir.x * s,
          0.45 + Math.random() * 0.45,
          BLOOD_MAT(),
        );
      }
    },
    /** One drop of the trail a wounded animal leaves as it moves. */
    drip(x: number, z: number) {
      groundDecal(x, z, 0.3 + Math.random() * 0.2, DROPS_MAT());
    },
    /** The thrown spear lands: a puff of earth and a hole where it went in. */
    dust(at: Vec3) {
      burst(at, DUST, 18, 1.5, 0.35, 2);
      groundDecal(at.x, at.z, 0.6, MARK.ground());
    },
    /**
     * A thrust stopped by the ground or a prop. The sim's colliders are boxes, so the mark goes where the
     * hunter was looking (camera ray), else toward the sim's contact point; no surface found, no mark.
     */
    strike(at: Vec3, ground: boolean, from: Vector3, look: Vector3) {
      if (ground) {
        burst(at, DUST, 16, 1.4, 0.3, 3);
        groundDecal(at.x, at.z, 0.6, MARK.ground());
        return;
      }
      const props = (m: AbstractMesh) => m.getClassName() === 'InstancedMesh' && m.isEnabled();
      const target = new Vector3(at.x, at.y, at.z);
      const toward = target.subtract(from);
      const hit =
        scene.pickWithRay(new Ray(from, look.normalizeToNew(), toward.length() + 0.8), props) ??
        scene.pickWithRay(new Ray(from, toward.normalizeToNew(), toward.length() + 0.8), props);
      if (!hit?.pickedPoint) {
        burst(at, DUST, 8, 0.8, 0.25, 1);
        return;
      }
      const point = hit.pickedPoint;
      const normal = hit.getNormal(true) ?? toward.normalizeToNew().negate();
      const surface = surfaceOf(hit.pickedMesh?.material?.name ?? '');
      decal(point, normal, surface === 'wood' ? 0.55 : 0.45, MARK[surface]());
      const out = normal.scale(1.5);
      if (surface === 'wood') burst(point, SPLINTERS, 14, 2.2, 0.05, 9, out, true);
      else if (surface === 'stone' || surface === 'bone')
        burst(point, CHIPS, 12, 2.5, 0.05, 9, out);
      burst(point, DUST, 8, 0.8, 0.25, 1);
    },
    clear() {
      marks.forEach((m) => m.setEnabled(false));
    },
  };
}
