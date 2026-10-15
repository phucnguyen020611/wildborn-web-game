import { LoadAssetContainerAsync } from './loaders';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Prop } from '../maps/testArena';

const urls = import.meta.glob<string>('../assets/environment/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const urlFor = (id: string) => {
  const url = urls[`../assets/environment/${id}.glb`];
  if (!url) throw new Error(`Missing src/assets/environment/${id}.glb (run npm run assets?)`);
  return url;
};

/** Loads each model once, then places GPU instances (one draw call per mesh/material, not per prop). */
export async function loadProps(scene: Scene, props: Prop[]) {
  const ids = [...new Set(props.map((p) => p.id))];
  const containers = new Map(
    await Promise.all(
      ids.map(async (id) => [id, await LoadAssetContainerAsync(urlFor(id), scene)] as const),
    ),
  );
  // Quaternius stores wind/AO masks in vertex colors for its own shader; as plain tint they turn plants red/black.
  for (const c of containers.values()) for (const m of c.meshes) m.useVertexColors = false;
  // Double-sided foliage: light the back faces too instead of rendering them black.
  for (const c of containers.values())
    for (const mat of c.materials)
      if (!mat.backFaceCulling) (mat as PBRMaterial).twoSidedLighting = true;
  for (const p of props) {
    const { rootNodes } = containers.get(p.id)!.instantiateModelsToScene((n) => n, false, {
      doNotInstantiate: false, // Babylon defaults to full clones
    });
    // Parent instead of transforming __root__, which carries the glTF handedness flip.
    const node = new TransformNode(p.id, scene);
    node.position.set(p.x, 0, p.z);
    node.rotation.y = p.rot;
    node.scaling.setAll(p.scale);
    rootNodes.forEach((r) => (r.parent = node));
    node.getChildMeshes().forEach((m) => {
      m.isPickable = false;
      m.freezeWorldMatrix();
    });
  }
}
