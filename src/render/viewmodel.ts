import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { WEAPONS } from '../config/weapons';
import type { SpearState } from '../sim/spear';
import type { Projectile } from '../sim/world';
import { loadContainer } from './loaders';
import spearUrl from '../assets/weapons/wpn_spear.glb?url';
import armsUrl from '../assets/characters/chr_fp_arms.glb?url';

const VIEWMODEL_GROUP = 1; // drawn after the world with a cleared depth buffer, so it never clips into walls
const TIP = 1.3; // distance from the spear's origin (grip) to its point, along local +y; see tools/blender/make_spear.py

const models = new Map<string, Promise<AssetContainer>>();

/** A copy of a glTF under a node that exists immediately (the meshes appear once loaded). */
function model(
  scene: Scene,
  url: string,
  name: string,
  setup: (m: AbstractMesh) => void = () => {},
) {
  const root = new TransformNode(name, scene);
  if (!models.has(url)) models.set(url, loadContainer(url, scene));
  models
    .get(url)!
    .then((c) => {
      const { rootNodes } = c.instantiateModelsToScene((n) => `${name}_${n}`, false);
      rootNodes.forEach((r) => (r.parent = root));
      for (const m of root.getChildMeshes()) {
        m.isPickable = false;
        setup(m);
      }
    })
    .catch((err) => console.error(`Failed to load ${url}`, err));
  return root;
}

/** The spear in the player's hands, posed from the sim's thrust/throw phase. */
export function createSpearViewmodel(scene: Scene, camera: Camera) {
  const inFront = (m: AbstractMesh) => (m.renderingGroupId = VIEWMODEL_GROUP);
  const root = model(scene, spearUrl, 'viewmodel', inFront);
  // Arms are baked in the spear's local frame (tools/blender/make_fp_arms.py), so they follow every pose.
  model(scene, armsUrl, 'fp_arms', inFront).parent = root;
  root.parent = camera;
  const REST = { x: 0.22, y: -0.19, z: 0.45 }; // keep in sync with REST_POS in make_fp_arms.py
  root.rotation.set(Math.PI / 2 - 0.12, -0.06, 0); // tip forward, slightly raised and inward

  const cfg = WEAPONS.spear;
  const smooth = (k: number) => k * k * (3 - 2 * k);

  function update(s: SpearState) {
    root.setEnabled(s.held);
    if (s.phase === 'throw') {
      // Draw back over the shoulder before release.
      const k = smooth(Math.min(1, s.t / cfg.throwWindup));
      root.position.set(REST.x + 0.05 * k, REST.y + 0.22 * k, REST.z - 0.3 * k);
      return;
    }
    let push = 0; // 0 = rest, 1 = fully extended, negative = pulled back
    if (s.phase === 'windup') push = -0.25 * (s.t / cfg.windup);
    else if (s.phase === 'active') push = Math.min(1, s.t / 0.04);
    else if (s.phase === 'recover') push = 1 - smooth(Math.min(1, s.t / cfg.recover));
    root.position.set(REST.x - 0.12 * Math.max(0, push), REST.y + 0.06 * push, REST.z + 0.3 * push);
  }

  return { update };
}

/** The thrown spear in the world: points along its velocity, tip buried a little once landed. */
export function createThrownSpear(scene: Scene) {
  const root = model(scene, spearUrl, 'thrown');
  root.rotationQuaternion = new Quaternion();
  root.setEnabled(false);
  const dir = new Vector3();

  function update(prev: Projectile | null, curr: Projectile | null, alpha: number) {
    root.setEnabled(!!curr);
    if (!curr) return;
    const p = prev && prev.flying ? prev : curr;
    dir.set(curr.vx, curr.vy, curr.vz).normalize();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, root.rotationQuaternion!);
    const tipDepth = curr.flying ? 0 : 0.25;
    root.position.set(
      p.x + (curr.x - p.x) * alpha - dir.x * (TIP - tipDepth),
      p.y + (curr.y - p.y) * alpha - dir.y * (TIP - tipDepth),
      p.z + (curr.z - p.z) * alpha - dir.z * (TIP - tipDepth),
    );
  }

  return { update };
}
