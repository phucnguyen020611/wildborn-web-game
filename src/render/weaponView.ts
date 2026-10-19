import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { ARSENAL, type WeaponId, type WeaponStats } from '../config/arsenal';
import type { Fighter } from '../sim/tdm';
import { loadContainer } from './loaders';
import spearUrl from '../assets/weapons/wpn_spear.glb?url';
import kitUrl from '../assets/weapons/wpn_kit.glb?url';
import armsUrl from '../assets/characters/chr_fp_arms.glb?url';

const VIEWMODEL_GROUP = 1; // drawn over the world (cleared depth), like the story spear
const REST = { x: 0.22, y: -0.19, z: 0.45 }; // the grip the arms are baked for (make_fp_arms.py)
const NODE: Record<WeaponId, string> = {
  spear: '',
  axe: 'Axe',
  club: 'Club',
  javelin: 'Javelin',
  bow: 'Bow',
};
const smooth = (k: number) => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

/**
 * Tribal War first-person weapons. All but the bow are gripped where the spear is (same hand pose):
 * axe and club stand more upright in the hand and chop down; spear and javelin thrust and throw.
 * shortcut: the bow is shown without arms (the baked arm pose only grips a forward shaft); a second
 * arm pose from make_fp_arms.py would fix it.
 */
export function createWeaponView(
  scene: Scene,
  camera: Camera,
  motion: { vmX: number; vmY: number; vmRoll: number },
) {
  const inFront = (m: AbstractMesh) => {
    m.renderingGroupId = VIEWMODEL_GROUP;
    m.isPickable = false;
  };
  const hand = new TransformNode('wv_hand', scene); // the grip: arms + one-handed weapons
  hand.parent = camera;
  const bowRoot = new TransformNode('wv_bow', scene);
  bowRoot.parent = camera;
  const models = new Map<WeaponId, TransformNode>();
  const arrow = new TransformNode('wv_arrow', scene);
  arrow.parent = camera; // not under the canted bow: it points straight at the crosshair

  void Promise.all([
    loadContainer(spearUrl, scene),
    loadContainer(kitUrl, scene),
    loadContainer(armsUrl, scene),
  ]).then(([spear, kit, arms]) => {
    const copy = (c: typeof kit, node: string, parent: TransformNode, name: string) => {
      const inst = c.instantiateModelsToScene((n) => `${name}_${n}`, false);
      const root = inst.rootNodes[0] as TransformNode;
      if (node)
        for (const m of root.getChildMeshes(false)) {
          let n: TransformNode | null = m;
          let keep = false;
          for (; n; n = n.parent as TransformNode | null) keep ||= n.name === `${name}_${node}`;
          if (!keep) m.dispose();
        }
      root.parent = parent;
      root.getChildMeshes(false).forEach(inFront);
      return root;
    };
    copy(arms, '', hand, 'wv_arms');
    for (const id of Object.keys(NODE) as WeaponId[]) {
      const holder = new TransformNode(`wv_${id}`, scene);
      holder.parent = id === 'bow' ? bowRoot : hand;
      copy(id === 'spear' ? spear : kit, NODE[id], holder, `wv_${id}`);
      if (id === 'axe' || id === 'club') holder.rotation.x = -0.8; // head up: held like a hatchet
      models.set(id, holder);
    }
    copy(kit, 'Arrow', arrow, 'wv_arrow_mesh');
  });

  return {
    update(f: Fighter) {
      const bow = f.weapon === 'bow';
      hand.setEnabled(f.alive && !bow);
      bowRoot.setEnabled(f.alive && bow);
      if (!bow || !f.alive) arrow.setEnabled(false);
      models.forEach((m, id) => m.setEnabled(id === f.weapon));
      const w: WeaponStats = ARSENAL[f.weapon];
      const lowered = f.phase === 'recover' && f.t < 0 ? 1 : 0; // just switched: coming up from below
      if (bow) {
        const draw = f.phase === 'drawing' ? smooth(f.t / ARSENAL.bow.bow.drawTime) : 0;
        // Held out at arm's length left of centre, canted, the grip a little below the crosshair.
        bowRoot.position.set(
          -0.07 + motion.vmX,
          -0.1 - 0.3 * lowered + motion.vmY,
          0.95 - 0.05 * draw,
        );
        bowRoot.rotation.set(0, 0, 0.35 + motion.vmRoll);
        bowRoot.scaling.setAll(0.8);
        arrow.setEnabled(f.phase === 'drawing' || f.phase === 'ready');
        // Nock end on the string near the face, resting across the bow's grip; drawing pulls it back.
        arrow.position.set(
          -0.035 + motion.vmX,
          -0.11 - 0.3 * lowered + motion.vmY,
          0.36 - 0.16 * draw,
        );
        arrow.rotation.set(Math.PI / 2 - 0.02, 0.06, 0);
        return;
      }
      let pitch = Math.PI / 2 - 0.12; // shaft forward (the rest pose the arms are baked for)
      let x = REST.x;
      let y = REST.y - 0.3 * lowered;
      let z = REST.z;
      if (f.phase === 'throwing' && w.throw) {
        const k = smooth(f.t / w.throw.windup); // draw back over the shoulder
        y += 0.22 * k;
        z -= 0.3 * k;
        x += 0.05 * k;
      } else if (
        w.melee &&
        f.weapon !== 'spear' &&
        (f.phase === 'windup' || f.phase === 'active' || f.phase === 'recover')
      ) {
        // Chop: raise, bring it down hard, come back.
        const m = w.melee;
        const k =
          f.phase === 'windup'
            ? -smooth(f.t / m.windup)
            : f.phase === 'active'
              ? -1 + 2.2 * smooth(f.t / m.active)
              : 1.2 * (1 - smooth(f.t / m.recover));
        pitch += 0.55 * k;
        y += 0.06 * Math.max(0, -k);
        z += 0.08 * Math.max(0, k);
      } else if (w.melee) {
        let push = 0; // the spear's thrust, as in the story viewmodel
        if (f.phase === 'windup') push = -0.25 * (f.t / w.melee.windup);
        else if (f.phase === 'active') push = Math.min(1, f.t / 0.04);
        else if (f.phase === 'recover' && f.t > 0) push = 1 - smooth(f.t / w.melee.recover);
        x += 0.04 * Math.max(0, push);
        y -= 0.06 * Math.max(0, push);
        z += 0.16 * push;
      }
      hand.position.set(x + motion.vmX, y + motion.vmY, z);
      hand.rotation.set(pitch, -0.06, motion.vmRoll);
    },
  };
}
