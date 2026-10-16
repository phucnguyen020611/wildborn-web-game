import { loadContainer } from './loaders';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { CreatureConfig } from '../config/creatures';
import type { CreatureMode, CreatureState } from '../sim/creature';

const urls = import.meta.glob<string>('../assets/creatures/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

const FLASH = new Color3(0.9, 0.15, 0.1);
const TELEGRAPH = new Color3(0.85, 0.5, 0.05); // amber: about to attack (shown even when the model has an attack clip)
const ONE_SHOT: CreatureMode[] = ['attack', 'dead']; // play once and hold the last pose

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

  return {
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
