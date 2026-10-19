import { loadContainer } from './loaders';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Prop } from '../maps/types';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { PROPS, type PropConfig } from '../config/props';
import { windForKit } from './wind';
import forestUrl from '../assets/environment/env_kit_forest.glb?url';
import campUrl from '../assets/props/env_kit_camp.glb?url';

const KITS = { forest: forestUrl, camp: campUrl };
const CELL = 32; // metres
const FAR = 160; // props without a draw distance (rocks, camp): by here the fog has swallowed them

/** Loads each kit once, then places GPU instances (one draw call per mesh/material, not per prop). */
export async function loadProps(
  scene: Scene,
  props: Prop[],
  castShadow: (m: AbstractMesh) => void,
) {
  const used = [...new Set(props.map((p) => (PROPS[p.id] as PropConfig).kit ?? 'forest'))];
  const kits = await Promise.all(used.map((k) => loadContainer(KITS[k], scene)));
  // Collectibles pulse gold so they read as "take me" among the plants. They get their own material (the
  // kit's is shared with other plants), cloned before wind is added: a plugin can't be cloned.
  const glowNodes = new Set(
    (Object.values(PROPS) as PropConfig[]).filter((c) => c.glow).flatMap((c) => c.nodes),
  );
  const glowing: PBRMaterial[] = [];
  const meshes = kits.flatMap((kit) => {
    kit.addAllToScene();
    const clones: PBRMaterial[] = [];
    for (const m of kit.meshes)
      if (m.material && glowNodes.has(m.name.replace(/_primitive\d+$/, ''))) {
        m.material = m.material.clone(`${m.material.name}_glow`)!;
        clones.push(m.material as PBRMaterial);
      }
    glowing.push(...clones);
    // Double-sided foliage: light the back faces too instead of rendering them black.
    for (const mat of [...kit.materials, ...clones]) {
      if (!mat.backFaceCulling) (mat as PBRMaterial).twoSidedLighting = true;
      windForKit(mat);
    }
    return kit.meshes as Mesh[];
  });

  // Source meshes per kit node (a node is one mesh, or `<name>_primitive<i>` children, one per material),
  // with their transform under __root__ (which carries the glTF handedness flip) baked into a local one.
  const parts = new Map<string, { mesh: Mesh; s: Vector3; q: Quaternion; t: Vector3 }[]>();
  for (const m of meshes) {
    // Quaternius stores wind/AO masks in vertex colors for its own shader; as plain tint they turn plants red/black.
    m.useVertexColors = false;
    if (!m.getTotalVertices()) continue;
    const part = { mesh: m, s: new Vector3(), q: new Quaternion(), t: new Vector3() };
    m.computeWorldMatrix(true).decompose(part.s, part.q, part.t);
    const name = m.name.replace(/_primitive\d+$/, '');
    parts.set(name, [...(parts.get(name) ?? []), part]);
    m.isVisible = false; // the source stays hidden; its instances render
  }
  if (glowing.length)
    scene.onBeforeRenderObservable.add(() => {
      const k = 0.25 + 0.2 * Math.sin(performance.now() / 300);
      for (const m of glowing) m.emissiveColor.set(k, k * 0.75, k * 0.15);
    });
  // Small plants vanish past their draw distance (instances follow their source mesh's LOD).
  for (const cfg of Object.values(PROPS) as PropConfig[])
    if (cfg.drawDistance)
      for (const name of cfg.nodes)
        for (const { mesh } of parts.get(name) ?? []) mesh.addLODLevel(cfg.drawDistance, null);

  // Props are grouped into map cells per draw distance; a whole cell is switched off once the camera is
  // out of range, so the instances in it cost nothing (not even culling). That is what lets maps be big.
  const cells = new Map<string, { node: TransformNode; x: number; z: number; range: number }>();
  const cellOf = (p: Prop, range: number) => {
    const i = Math.floor(p.x / CELL);
    const j = Math.floor(p.z / CELL);
    const key = `${range}:${i}:${j}`;
    let cell = cells.get(key);
    if (!cell) {
      const node = new TransformNode(`props_${key}`, scene);
      cell = { node, x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, range };
      cells.set(key, cell);
    }
    return cell.node;
  };
  const reach = CELL * 0.71; // cell centre to corner
  scene.onBeforeRenderObservable.add(() => {
    const cam = scene.activeCamera?.globalPosition;
    if (!cam) return;
    for (const c of cells.values())
      c.node.setEnabled(Math.hypot(c.x - cam.x, c.z - cam.z) - reach < c.range);
  });

  // One node per prop, in order, so callers can hide one (a herb once it's picked).
  return props.map((p) => {
    const cfg = PROPS[p.id] as PropConfig;
    const node = new TransformNode(p.id, scene);
    node.parent = cellOf(p, cfg.drawDistance ?? FAR);
    node.position.set(p.x, p.y ?? 0, p.z);
    node.rotation.y = p.rot;
    node.scaling.setAll(p.scale);
    for (const part of parts.get(cfg.nodes[p.variant ?? 0]) ?? []) {
      const inst = part.mesh.createInstance(p.id);
      inst.parent = node;
      inst.scaling.copyFrom(part.s);
      inst.rotationQuaternion = part.q.clone();
      inst.position.copyFrom(part.t);
      inst.isPickable = false;
      inst.freezeWorldMatrix();
      if (cfg.castsShadow) castShadow(inst);
    }
    node.freezeWorldMatrix();
    return node;
  });
}
