import { loadContainer } from './loaders';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { CreatureConfig } from '../config/creatures';
import type { CreatureMode, CreatureState } from '../sim/creature';
import type { Vec3 } from '../sim/geometry';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

const MAX_WOUNDS = 8;

const urls = import.meta.glob<string>('../assets/creatures/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const FLASH = new Color3(0.9, 0.15, 0.1);
const TELEGRAPH = new Color3(0.85, 0.5, 0.05); // amber: about to attack (shown even when the model has an attack clip)
const ONE_SHOT: CreatureMode[] = ['attack', 'dead']; // play once and hold the last pose

/** Spear wound: dark puncture, wet red rim, blood running down (canvas bottom = down) and a few flecks. */
function woundTexture(scene: Scene, name: string) {
  const tex = new DynamicTexture(`${name}_wound_tex`, 128, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  const blob = (x: number, y: number, rx: number, ry: number, fill: string) => {
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  c.clearRect(0, 0, 128, 128);
  // Runs: tapering streaks down from the wound, ending in a drop.
  for (const [x, len, w] of [
    [58, 50, 5],
    [67, 36, 4],
    [72, 22, 3],
  ]) {
    c.fillStyle = 'rgba(95,6,5,0.95)';
    c.beginPath();
    c.moveTo(x - w, 52);
    c.quadraticCurveTo(x - w * 0.4, 52 + len * 0.7, x, 52 + len);
    c.quadraticCurveTo(x + w * 0.4, 52 + len * 0.7, x + w, 52);
    c.fill();
    blob(x, 52 + len, w * 0.8, w, 'rgba(95,6,5,0.95)');
  }
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4;
    blob(
      64 + Math.cos(a) * (20 + (i % 3) * 7),
      44 + Math.sin(a) * (16 + (i % 4) * 5),
      2 + (i % 3),
      2 + (i % 2),
      'rgba(120,10,8,0.9)',
    );
  }
  blob(64, 44, 19, 15, 'rgba(120,10,8,0.95)');
  blob(64, 44, 11, 8, 'rgba(60,3,3,1)');
  blob(64, 44, 5, 3.5, 'rgba(15,0,0,1)');
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/** Loads a rigged glTF and drives position + animation from creature sim state. */
export async function loadCreature(
  scene: Scene,
  cfg: CreatureConfig,
  castShadow: (m: AbstractMesh) => void,
) {
  const url = urls[`../assets/creatures/${cfg.model}.glb`];
  if (!url) throw new Error(`Missing src/assets/creatures/${cfg.model}.glb (run npm run assets?)`);
  const container = await loadContainer(url, scene);
  container.addAllToScene();

  // Parent the glTF root instead of transforming it: __root__ carries the right-to-left-handed flip.
  const node = new TransformNode(cfg.model, scene);
  node.scaling.setAll(cfg.scale);
  container.meshes[0].parent = node;
  container.meshes.forEach(castShadow);

  const byName = (name?: string) => {
    if (!name) return null;
    const g = container.animationGroups.find((a) => a.name === name);
    if (!g) throw new Error(`Animation "${name}" missing in ${cfg.model}`);
    return g;
  };
  const a = cfg.animations;
  const anims: Record<CreatureMode, AnimationGroup | null> = {
    idle: byName(a.idle),
    walk: byName(a.walk),
    flee: byName(a.run),
    chase: byName(a.run),
    // shortcut: models without an attack/death clip fall back to idle + amber glow / rolling onto the side.
    attack: byName(a.attack) ?? byName(a.idle),
    dead: byName(a.death),
  };
  const hitAnim = byName(a.hit);
  container.animationGroups.forEach((g) => g.stop());
  let playing: AnimationGroup | null = null;

  const materials = container.materials as PBRMaterial[];
  let flashUntil = 0;
  const glow = new Color3(); // per creature: materials keep a reference to it

  function play(g: AnimationGroup | null, loop: boolean) {
    if (g === playing) return;
    playing?.stop();
    g?.start(loop);
    playing = g;
  }

  const woundMat = new StandardMaterial(`${cfg.model}_wound`, scene);
  woundMat.diffuseTexture = woundTexture(scene, cfg.model);
  woundMat.useAlphaFromDiffuseTexture = true;
  woundMat.specularColor = new Color3(0.45, 0.25, 0.25); // wet sheen
  woundMat.specularPower = 40;
  woundMat.backFaceCulling = false;
  woundMat.zOffset = -2;
  const wounds: Mesh[] = [];

  return {
    /**
     * Leaves a wound where the line from `from` (the camera) through the hit point meets the model,
     * stuck to the body so it moves with it. shortcut: picks the unanimated (bind-pose) mesh; close
     * enough for rigid-skinned models, revisit if wounds drift on heavily animated ones.
     */
    wound(from: Vector3, at: Vec3) {
      const dir = new Vector3(at.x - from.x, at.y - from.y, at.z - from.z);
      const length = dir.length() + 3;
      const hit = scene.pickWithRay(new Ray(from, dir.normalize(), length), (m) =>
        container.meshes.includes(m),
      );
      if (!hit?.pickedPoint) return;
      const normal = (hit.getNormal(true) ?? dir.scale(-1)).normalize();
      const disc =
        wounds.length >= MAX_WOUNDS
          ? wounds.shift()!
          : CreatePlane(`${cfg.model}_wound`, { size: 1 }, scene);
      disc.material = woundMat;
      disc.isPickable = false;
      disc.parent = null;
      disc.scaling.setAll((0.22 + Math.random() * 0.08) * Math.max(1, cfg.hitbox.radius * 2)); // small: a flat decal pokes out past curved edges
      disc.position.copyFrom(hit.pickedPoint.add(normal.scale(0.01)));
      // Face out along the normal with the texture's top toward world up, so the drip runs downhill.
      let top = Vector3.Up().subtract(normal.scale(normal.y));
      if (top.lengthSquared() < 1e-4) top = Vector3.Forward();
      top.normalize();
      const forward = normal.negate();
      disc.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(
        Vector3.Cross(top, forward),
        top,
        forward,
      );
      disc.computeWorldMatrix(true); // setParent keeps the world pose, so both matrices must be current
      node.computeWorldMatrix(true);
      disc.setParent(node);
      wounds.push(disc);
    },
    clearWounds() {
      wounds.forEach((d) => d.dispose());
      wounds.length = 0;
    },
    /** Brief red flash (and the hit clip, if any) so hits read clearly even without sound. */
    flash() {
      flashUntil = performance.now() + 120;
    },
    update(prev: CreatureState, curr: CreatureState, alpha: number) {
      const dead = curr.mode === 'dead';
      const rollOver = dead && !anims.dead;
      node.position.set(
        prev.x + (curr.x - prev.x) * alpha,
        prev.y + (curr.y - prev.y) * alpha + (rollOver ? 0.12 : 0),
        prev.z + (curr.z - prev.z) * alpha,
      );
      node.rotation.set(0, curr.heading, rollOver ? Math.PI / 2 : 0); // models face +z (glTF front)

      if (curr.stagger > 0 && hitAnim && !dead) play(hitAnim, false);
      else if (curr.stagger <= 0 || !hitAnim) play(anims[curr.mode], !ONE_SHOT.includes(curr.mode));
      if (playing && playing !== hitAnim) playing.speedRatio = curr.stagger > 0 ? 0 : 1; // freeze when staggered

      const now = performance.now();
      if (now < flashUntil) glow.copyFrom(FLASH);
      else if (curr.mode === 'attack')
        TELEGRAPH.scaleToRef(0.35 + 0.25 * Math.sin(now / 50), glow); // pulsing, not a solid wash
      else glow.set(0, 0, 0);
      for (const m of materials) m.emissiveColor = glow;
    },
  };
}
