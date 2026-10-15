# Builds the stylized primitive spear and saves it as an editable .blend source:
#   blender -b --factory-startup --python tools/blender/make_spear.py -- art-source/weapons/wpn_spear.blend
# Convention (docs/ART_GUIDE.md): meters, origin at the grip, spear along +Z (glTF +Y), point at Z = TIP.
# Open the .blend in Blender to tweak by hand; re-run this script only to start over.
import math
import random
import sys

import bmesh
import bpy

out = sys.argv[sys.argv.index("--") + 1 :][0]
random.seed(7)  # same "hand-made" irregularities every run
bpy.ops.wm.read_factory_settings(use_empty=True)

TIP = 1.3


def material(name, srgb, roughness=0.9):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*(c**2.2 for c in srgb), 1)  # sRGB -> linear
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    m.diffuse_color = (*(c**2.2 for c in srgb), 1)  # viewport colour, so it reads in Blender too
    return m


def cone(name, mat, z_center, depth, r_bottom, r_top, segments, jitter=0.0, flatten=1.0, smooth=False, tilt=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments, radius1=r_bottom, radius2=r_top, depth=depth
    )
    c, s = math.cos(tilt), math.sin(tilt)
    for v in bm.verts:
        v.co.y *= flatten
        v.co.y, v.co.z = v.co.y * c - v.co.z * s, v.co.y * s + v.co.z * c  # tilt around X
        v.co.z += z_center
        if jitter:
            v.co.x += random.uniform(-jitter, jitter)
            v.co.y += random.uniform(-jitter, jitter) * flatten
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def lathe(name, mat, z0, length, profile, segments, flatten=1.0, jitter=0.0):
    """Solid of revolution from (t, radius) pairs along +Z, t in 0..1; ends in a single point."""
    bm = bmesh.new()
    rings = []
    for t, r in profile:
        ring = []
        for k in range(segments):
            a = 2 * math.pi * k / segments
            j = random.uniform(-jitter, jitter) if 0 < t < 1 else 0
            ring.append(bm.verts.new(((r + j) * math.cos(a), (r + j) * math.sin(a) * flatten, z0 + t * length)))
        rings.append(ring)
    tip = bm.verts.new((0, 0, z0 + length))
    bm.faces.new(list(reversed(rings[0])))
    for lo, hi in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((lo[k], lo[(k + 1) % segments], hi[(k + 1) % segments], hi[k]))
    for k in range(segments):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % segments], tip))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


wood = material("spear_wood", (0.42, 0.28, 0.16))
leather = material("spear_leather", (0.30, 0.20, 0.12))
stone = material("spear_stone", (0.50, 0.49, 0.46), roughness=0.75)

parts = [
    # Shaft: slightly tapered, a little uneven like a trimmed sapling.
    cone("shaft", wood, z_center=0.2, depth=1.6, r_bottom=0.02, r_top=0.016, segments=12, jitter=0.0015, smooth=True),
    # Grip wrap where the hand holds it.
    *[
        cone(f"grip_{i}", leather, z_center=-0.06 + i * 0.03, depth=0.022, r_bottom=0.023, r_top=0.023, segments=10, jitter=0.001, tilt=0.12 * (-1) ** i)
        for i in range(5)
    ],
    # Leather lashing holding the point: overlapping tilted wraps.
    *[
        cone(f"lash_{i}", leather, z_center=0.93 + i * 0.022, depth=0.02, r_bottom=0.024 - i * 0.001, r_top=0.023 - i * 0.001, segments=10, jitter=0.001, tilt=0.18 * (-1) ** i)
        for i in range(4)
    ],
    # Knapped leaf-shaped stone point: widest a third of the way up, flat, irregular facets (flat shaded).
    lathe(
        "point", stone, z0=TIP - 0.34, length=0.34, segments=8, flatten=0.32, jitter=0.004,
        profile=[(0.0, 0.018), (0.12, 0.04), (0.32, 0.052), (0.55, 0.044), (0.8, 0.024)],
    ),
]

# One object (one draw call per material) named after the asset.
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
parts[0].name = parts[0].data.name = "wpn_spear"

bpy.ops.wm.save_as_mainfile(filepath=out)
