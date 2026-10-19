import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Scene } from '@babylonjs/core/scene';
import type { Missile } from '../sim/tdm';
import { loadContainer } from './loaders';
import spearUrl from '../assets/weapons/wpn_spear.glb?url';
import kitUrl from '../assets/weapons/wpn_kit.glb?url';

/** Spears, javelins and arrows in flight or stuck where they landed: one model per missile id. */
export function createMissiles(scene: Scene) {
  let spear: AssetContainer | null = null;
  let kit: AssetContainer | null = null;
  void Promise.all([loadContainer(spearUrl, scene), loadContainer(kitUrl, scene)]).then(
    ([s, k]) => {
      spear = s;
      kit = k;
    },
  );
  const live = new Map<number, TransformNode>();
  const dir = new Vector3();

  function make(m: Missile) {
    const node = new TransformNode(`missile_${m.id}`, scene);
    node.rotationQuaternion = new Quaternion();
    const src = m.weapon === 'spear' ? spear : kit;
    if (src) {
      const keep = m.weapon === 'javelin' ? 'Javelin' : m.weapon === 'bow' ? 'Arrow' : '';
      const inst = src.instantiateModelsToScene((n) => `missile_${m.id}_${n}`, false);
      const root = inst.rootNodes[0] as TransformNode;
      if (keep)
        for (const mesh of root.getChildMeshes(false)) {
          let n: TransformNode | null = mesh;
          let ok = false;
          for (; n; n = n.parent as TransformNode | null)
            ok ||= n.name === `missile_${m.id}_${keep}`;
          if (!ok) mesh.dispose();
        }
      root.parent = node;
      root.getChildMeshes(false).forEach((x) => (x.isPickable = false));
    }
    return node;
  }

  return {
    update(missiles: Missile[]) {
      const seen = new Set<number>();
      for (const m of missiles) {
        seen.add(m.id);
        let node = live.get(m.id);
        if (!node) live.set(m.id, (node = make(m)));
        dir.set(m.vx, m.vy, m.vz).normalize();
        Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, node.rotationQuaternion!);
        // Models point along +y from their grip; stuck ones sink their point in a little.
        const back = m.weapon === 'bow' ? 0.7 : m.weapon === 'javelin' ? 0.6 : 1.3;
        const sink = m.flying ? 0 : 0.2;
        node.position.set(
          m.x - dir.x * (back - sink),
          m.y - dir.y * (back - sink),
          m.z - dir.z * (back - sink),
        );
      }
      for (const [id, node] of live)
        if (!seen.has(id)) {
          node.dispose();
          live.delete(id);
        }
    },
  };
}
