import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { WeaponId } from '../config/arsenal';
import type { Fighter } from '../sim/tdm';
import { loadContainer } from './loaders';
import warriorUrl from '../assets/characters/chr_warrior.glb?url';
import spearUrl from '../assets/weapons/wpn_spear.glb?url';
import kitUrl from '../assets/weapons/wpn_kit.glb?url';

export const TEAM_COLORS = [new Color3(0.75, 0.16, 0.1), new Color3(0.12, 0.35, 0.8)]; // red ochre, woad blue
const WEAPON_NODES: Record<WeaponId, string> = {
  spear: 'wpn_spear',
  axe: 'Axe',
  club: 'Club',
  javelin: 'Javelin',
  bow: 'Bow',
};
const ATTACK_CLIP: Record<WeaponId, string> = {
  spear: 'Thrust',
  axe: 'SwingHeavy',
  club: 'Swing',
  javelin: 'Throw',
  bow: 'Aim',
};

/** Loads the warrior and weapon models once; `spawn` makes one fighter's body. */
export async function loadWarriors(scene: Scene, castShadow: (m: AbstractMesh) => void) {
  const [body, spear, kit] = await Promise.all([
    loadContainer(warriorUrl, scene),
    loadContainer(spearUrl, scene),
    loadContainer(kitUrl, scene),
  ]);
  const bands = TEAM_COLORS.map((c, i) => {
    const m = new StandardMaterial(`team_band_${i}`, scene);
    m.diffuseColor = c;
    m.specularColor = Color3.Black();
    return m;
  });

  /** A weapon model in the right hand: a copy of its kit node, attached to the hand bone. */
  function weapon(id: WeaponId, name: string) {
    const src = id === 'spear' ? spear : kit;
    const inst = src.instantiateModelsToScene((n) => `${name}_${n}`, false);
    const root = inst.rootNodes[0] as TransformNode;
    // The kit holds all five: keep only the meshes under this weapon's node.
    if (id !== 'spear')
      for (const m of root.getChildMeshes(false)) {
        let n: TransformNode | null = m;
        let keep = false;
        while (n) {
          if (n.name === `${name}_${WEAPON_NODES[id]}`) keep = true;
          n = n.parent as TransformNode | null;
        }
        if (!keep) m.dispose();
      }
    return root;
  }

  return function spawn(name: string, team: 0 | 1) {
    const inst = body.instantiateModelsToScene((n) => `${name}_${n}`, false, {
      doNotInstantiate: true,
    });
    const root = new TransformNode(name, scene);
    inst.rootNodes.forEach((r) => (r.parent = root));
    const meshes = root.getChildMeshes(false);
    for (const m of meshes) {
      m.isPickable = false;
      castShadow(m);
      if (m.name.endsWith('Gear_Band')) m.material = bands[team];
      if (m.name.endsWith('Gear_Feathers')) m.setEnabled(team === 0); // shape tells teams apart too
      if (m.name.endsWith('Gear_Horns')) m.setEnabled(team === 1);
    }
    const clips = new Map(inst.animationGroups.map((g) => [g.name.replace(`${name}_`, ''), g]));
    clips.forEach((g) => g.stop());
    const skinned = meshes.find((m) => m.skeleton) as Mesh | undefined;
    const hand = skinned?.skeleton?.bones.find((b) => b.name === 'hand_r');
    const held = new Map<WeaponId, TransformNode>();
    for (const id of Object.keys(WEAPON_NODES) as WeaponId[]) {
      const w = weapon(id, `${name}_${id}`);
      if (hand && skinned) {
        w.attachToBone(hand, skinned);
        // In the hand bone's frame this points the weapon forward and up from the fist (tuned by eye).
        w.rotationQuaternion = null;
        w.rotation.set(Math.PI / 2, 0, 0);
      }
      for (const m of w.getChildMeshes(false)) {
        m.isPickable = false;
        castShadow(m);
      }
      held.set(id, w);
    }

    let playing: AnimationGroup | undefined;
    const play = (clip: string, loop: boolean, speed = 1) => {
      const g = clips.get(clip);
      if (!g) return;
      if (g !== playing) {
        playing?.stop();
        g.start(loop, speed);
        playing = g;
      } else g.speedRatio = speed;
    };

    return {
      root,
      /** Poses the body from the sim: position, facing, weapon in hand, and the clip for what it's doing. */
      update(prev: Fighter, curr: Fighter, alpha: number) {
        const b = curr.body;
        root.position.set(
          prev.body.x + (b.x - prev.body.x) * alpha,
          prev.body.y + (b.y - prev.body.y) * alpha,
          prev.body.z + (b.z - prev.body.z) * alpha,
        );
        root.rotation.y = curr.yaw;
        held.forEach((w, id) => w.setEnabled(curr.alive && id === curr.weapon));
        if (!curr.alive) return play('Death', false);
        const speed = Math.hypot(b.vx, b.vz);
        const attacking =
          curr.phase === 'windup' || curr.phase === 'active' || curr.phase === 'throwing';
        if (attacking)
          play(ATTACK_CLIP[curr.phase === 'throwing' ? 'javelin' : curr.weapon], false, 1.6);
        else if (curr.phase === 'drawing') play('Aim', true);
        else if (!b.onGround) play('Jump', true);
        else if (speed > 5.5) play('Run', true, speed / 6);
        else if (speed > 0.6) play('Walk', true, speed / 2.2);
        else play('Idle', true);
      },
      dispose() {
        root.dispose();
      },
    };
  };
}
