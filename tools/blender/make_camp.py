# Builds the tribal camp kit (one object per prop) and saves it as an editable .blend source:
#   blender -b --factory-startup --python tools/blender/make_camp.py -- art-source/props/env_kit_camp.blend
# Convention (docs/ART_GUIDE.md): meters, origin on the ground at the prop's centre, Z up (glTF Y up).
# Object names are the node names src/config/props.ts refers to. Flat colours, no textures.
# Open the .blend in Blender to tweak by hand; re-run this script only to start over.
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1 :][0]
random.seed(5)  # same "hand-made" irregularities every run
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, srgb, roughness=0.95):
    m = bpy.data.materials.new(name)
    lin = (*(c**2.2 for c in srgb), 1)  # sRGB -> linear
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    m.diffuse_color = lin  # viewport colour
    return m


HIDE = material("camp_hide", (0.62, 0.48, 0.33))
HIDE_DARK = material("camp_hide_dark", (0.43, 0.31, 0.2))
WOOD = material("camp_wood", (0.42, 0.29, 0.18))
BARK = material("camp_bark", (0.33, 0.25, 0.18))
CUT = material("camp_cut_wood", (0.66, 0.52, 0.34))
CHAR = material("camp_char", (0.12, 0.1, 0.09))
STONE = material("camp_stone", (0.5, 0.48, 0.44), roughness=0.85)
BONE = material("camp_bone", (0.86, 0.81, 0.7), roughness=0.7)


def mesh_obj(name, bm, mat, smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = smooth
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def tube(mat, a, b, r_a, r_b, segments=7, jitter=0.0, caps=None):
    """Tapered cylinder from a to b; `caps` = material for the end faces (cut wood)."""
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r_a, radius2=r_b, depth=(b - a).length)
    rot = (b - a).to_track_quat("Z", "Y").to_matrix().to_4x4()
    for v in bm.verts:
        v.co.z += (b - a).length / 2
        v.co = rot @ v.co + a
        if jitter:
            v.co += Vector([random.uniform(-jitter, jitter) for _ in range(3)])
    obj = mesh_obj("part", bm, mat)
    if caps:
        obj.data.materials.append(caps)
        for p in obj.data.polygons:
            if len(p.vertices) == segments:  # the two end caps
                p.material_index = 1
    return obj


def rock(mat, center, radii, jitter=0.15, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        n = v.co.normalized()
        v.co = Vector((n.x * radii[0], n.y * radii[1], n.z * radii[2])) * (1 + random.uniform(-jitter, jitter))
        v.co += Vector(center)
    return mesh_obj("part", bm, mat)


def disc(mat, radius, z, segments=10):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=segments, radius=radius)
    for v in bm.verts:
        v.co.z = z
        v.co.x += random.uniform(-0.05, 0.05)
        v.co.y += random.uniform(-0.05, 0.05)
    return mesh_obj("part", bm, mat)


def join(name, parts):
    """One object per prop (one draw call per material), named for the game."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = parts[0]
    obj.name = obj.data.name = name
    return obj


def bake(obj):
    """Apply rotation/scale so the exported node carries no transform (the game places it)."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


# Hide tent: a cone of stitched hides over a ring of poles that cross above the smoke hole.
def tent():
    r, h, n = 1.7, 3.0, 9
    bm = bmesh.new()
    ring = [bm.verts.new((r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), random.uniform(0, 0.08))) for k in range(n)]
    top = [bm.verts.new((0.25 * math.cos(2 * math.pi * k / n), 0.25 * math.sin(2 * math.pi * k / n), h)) for k in range(n)]
    for k in range(n):
        if k == 0:
            continue  # the doorway gap faces -Y (glTF +Z, the prop's front)
        bm.faces.new((ring[k], ring[(k + 1) % n], top[(k + 1) % n], top[k]))
    # Sag between the poles so the hides read as soft.
    for k, v in enumerate(ring):
        v.co.x *= 1.0 + 0.04 * (k % 2)
        v.co.y *= 1.0 + 0.04 * (k % 2)
    obj = mesh_obj("part", bm, HIDE)
    obj.rotation_euler.z = -math.pi / 2 - math.pi / n  # doorway centred on -Y
    bake(obj)
    bpy.ops.object.modifier_add(type="SOLIDIFY")
    obj.modifiers[-1].thickness = 0.04
    bpy.ops.object.modifier_apply(modifier=obj.modifiers[-1].name)
    flap = rock(HIDE_DARK, (0, -1.25, 0.9), (0.45, 0.06, 0.8), jitter=0.05)  # rolled-up door flap
    poles = [
        tube(WOOD, (1.75 * math.cos(a), 1.75 * math.sin(a), 0), (-0.25 * math.cos(a), -0.25 * math.sin(a), h + 0.6), 0.035, 0.025, segments=5, jitter=0.01)
        for a in (2 * math.pi * k / 6 + 0.3 for k in range(6))
    ]
    return join("Tent", [obj, flap, *poles])


# Fire pit: stone ring, charred logs leaning together, ash bed.
def fire_pit():
    stones = [rock(STONE, (0.75 * math.cos(a), 0.75 * math.sin(a), 0.08), (0.2, 0.16, 0.14)) for a in (2 * math.pi * k / 9 for k in range(9))]
    logs = [
        tube(CHAR, (0.5 * math.cos(a), 0.5 * math.sin(a), 0.02), (0.05 * math.cos(a), 0.05 * math.sin(a), 0.45), 0.07, 0.05, segments=6, caps=CUT)
        for a in (2 * math.pi * k / 4 + 0.4 for k in range(4))
    ]
    return join("FirePit", [disc(CHAR, 0.62, 0.015), *stones, *logs])


# Fallen log: along X, with two snapped branch stubs.
def log():
    body = tube(BARK, (-2.4, 0, 0.33), (2.4, 0, 0.3), 0.36, 0.3, segments=9, jitter=0.02, caps=CUT)
    stubs = [
        tube(BARK, (-0.8, 0.2, 0.5), (-0.6, 0.55, 0.95), 0.09, 0.05, segments=5, caps=CUT),
        tube(BARK, (1.1, -0.2, 0.45), (1.4, -0.6, 0.7), 0.08, 0.05, segments=5, caps=CUT),
    ]
    return join("Log", [body, *stubs])


def stump():
    body = tube(BARK, (0, 0, -0.05), (0, 0, 0.55), 0.42, 0.34, segments=9, jitter=0.02, caps=CUT)
    roots = [
        tube(BARK, (0.3 * math.cos(a), 0.3 * math.sin(a), 0.2), (0.75 * math.cos(a), 0.75 * math.sin(a), -0.05), 0.12, 0.05, segments=5)
        for a in (2 * math.pi * k / 4 + 0.5 for k in range(4))
    ]
    return join("Stump", [body, *roots])


# Old mammoth remains: half-buried rib arches, a long bone and a skull: a sign the boss is near.
def bones():
    ribs = []
    for i in range(5):
        y = -0.9 + i * 0.45
        for side in (-1, 1):
            pts = [(side * (0.2 + 0.9 * math.sin(t * math.pi / 2)), y, 0.15 + 1.1 * math.cos(t * math.pi / 2) * (1 - 0.12 * i)) for t in (0, 0.35, 0.7, 1)]
            pts = [(side * 0.15, y, 1.25 - 0.14 * i)] + pts[1:]
            ribs += [tube(BONE, a, b, 0.07, 0.06, segments=5) for a, b in zip(pts, pts[1:])]
    spine = tube(BONE, (0, -1.2, 1.2), (0, 1.2, 0.7), 0.1, 0.08, segments=6)
    skull = rock(BONE, (0.2, -1.9, 0.45), (0.55, 0.5, 0.45), jitter=0.06)
    tusk = [tube(BONE, (side * 0.3, -2.2, 0.35), (side * 0.7, -3.0, 0.9), 0.08, 0.03, segments=6) for side in (-1, 1)]
    femur = tube(BONE, (1.4, 0.2, 0.08), (2.3, 0.9, 0.08), 0.08, 0.1, segments=6)
    return join("Bones", [spine, skull, *tusk, femur, *ribs])


# Drying rack: two A-frames, a crossbar and a stretched hide.
def drying_rack():
    parts = []
    for x in (-1.1, 1.1):
        parts += [tube(WOOD, (x, -0.5, 0), (x, 0, 1.8), 0.035, 0.03, segments=5), tube(WOOD, (x, 0.5, 0), (x, 0, 1.8), 0.035, 0.03, segments=5)]
    parts.append(tube(WOOD, (-1.3, 0, 1.75), (1.3, 0, 1.75), 0.035, 0.035, segments=5))
    hide = rock(HIDE, (0, 0.02, 1.15), (0.85, 0.03, 0.55), jitter=0.04)
    return join("DryingRack", [*parts, hide])


# All props sit at the origin (overlapping in the .blend; hide the others to edit one).
for make in [tent, fire_pit, log, stump, bones, drying_rack]:
    bake(make())

bpy.ops.wm.save_as_mainfile(filepath=out)
