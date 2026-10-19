# Builds the Tribal War warrior from Quaternius' Universal Base Characters + Universal Animation Library
# (both CC0) and saves it as an editable .blend source:
#   blender -b --factory-startup --python tools/blender/make_warrior.py -- art-source/characters/chr_warrior.blend [preview.png]
# Set QUATERNIUS=<folder holding UBC_Standard/, UAL1_Standard/, UAL2_Standard/> (default ../../Assets/quaternius-universal).
# Adds long hair and a beard (from the pack), a leather loincloth, and team gear: a headband the game tints
# per team, plus feathers (team 0) or bone horns (team 1) so teams differ in shape, not only colour.
# Clips are renamed to what src/render/warrior.ts plays. Convention: metres, faces -Y (glTF +Z), origin at the feet.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector, noise

args = sys.argv[sys.argv.index("--") + 1 :]
out = args[0]
preview = args[1] if len(args) > 1 else None
Q = os.environ.get("QUATERNIUS", os.path.join(os.path.dirname(__file__), "../../../../Assets/quaternius-universal"))
UBC = os.path.join(Q, "UBC_Standard/Universal Base Characters[Standard]")
CLIPS = {  # pack clip -> game clip
    "Idle_Loop": "Idle",
    "Walk_Loop": "Walk",
    "Jog_Fwd_Loop": "Run",
    "Punch_Jab": "Thrust",
    "Sword_Regular_A": "Swing",
    "Sword_Attack": "SwingHeavy",
    "OverhandThrow": "Throw",
    "Pistol_Aim_Neutral": "Aim",
    "Pistol_Shoot": "Shoot",
    "Hit_Chest": "Hit",
    "Death01": "Death",
    "Jump_Loop": "Jump",
}
TEX = 1024
bpy.ops.wm.read_factory_settings(use_empty=True)


def imported(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


# ---------- character ----------
char = imported(os.path.join(UBC, "Base Characters/Godot - UE/Superhero_Male_FullBody.gltf"))
arm = next(o for o in char if o.type == "ARMATURE")
arm.name = "chr_warrior_rig"
body = next(o for o in char if o.type == "MESH" and o.name.startswith("SuperHero"))
for o in char:
    if o.animation_data:
        o.animation_data.action = None
# Keep the colour maps only (1024²): normal and roughness maps would triple the download for little gain
# at the distance warriors are seen.
for m in bpy.data.materials:
    if not m.node_tree:
        continue
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        for name in ("Normal", "Roughness", "Metallic"):
            for link in list(bsdf.inputs[name].links):
                links.remove(link)
        bsdf.inputs["Roughness"].default_value = 0.75
        bsdf.inputs["Metallic"].default_value = 0
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)

# ---------- clips from both animation libraries (same universal rig, same bone names) ----------
for lib in ("UAL1_Standard/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb",
            "UAL2_Standard/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb"):
    before = set(bpy.data.actions)
    objs = imported(os.path.join(Q, lib))
    for act in set(bpy.data.actions) - before:
        base = act.name.split("|")[-1]
        if base in CLIPS and CLIPS[base] not in bpy.data.actions:
            act.name = CLIPS[base]
            act.use_fake_user = True
        else:
            bpy.data.actions.remove(act)
    for o in objs:
        bpy.data.objects.remove(o)
print("clips:", sorted(a.name for a in bpy.data.actions))

# ---------- hair and beard, skinned to the head bone ----------
hair_dir = os.path.join(UBC, "Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)")
for name in ("Hair_Long", "Hair_Beard"):
    objs = imported(os.path.join(hair_dir, name + ".gltf"))
    for o in objs:
        if o.type == "MESH":
            o.parent = arm
            for mod in o.modifiers:
                if mod.type == "ARMATURE":
                    mod.object = arm
        elif o.type == "ARMATURE":
            pass
    for o in objs:
        if o.type in ("ARMATURE", "EMPTY"):
            bpy.data.objects.remove(o)
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)
# The pack's hair texture is a grey mask meant to be tinted: dye it dark brown.
for m in bpy.data.materials:
    if m.name.startswith("MI_Hair") and m.node_tree:
        nodes, links = m.node_tree.nodes, m.node_tree.links
        bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
        src = bsdf.inputs["Base Color"].links[0].from_socket if bsdf.inputs["Base Color"].links else None
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1
        mix.inputs["B"].default_value = (0.05, 0.03, 0.02, 1)
        if src:
            links.new(src, mix.inputs["A"])
        links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])


# ---------- clothing and team gear ----------
def lin(c):
    return (*(v**2.2 for v in c), 1)


def material(name, srgb, roughness=0.9, image=None, back=True):
    m = bpy.data.materials.new(name)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    if image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = lin(srgb)
    m.use_backface_culling = back
    return m


def leather_image():
    n = 256
    img = bpy.data.images.new("warrior_leather", n, n)
    px = []
    for y in range(n):
        for x in range(n):
            p = Vector((math.cos(2 * math.pi * x / n) * 1.5, math.sin(2 * math.pi * x / n) * 1.5, y / n * 5))
            k = 0.78 + 0.22 * noise.fractal(p * 1.6, 0.6, 2.0, 4)
            k *= 1 - 0.35 * max(0, (y / n - 0.85) / 0.15)  # darker, worn hem
            px += [0.44 * k, 0.3 * k, 0.18 * k, 1]
    img.pixels = px
    img.pack()
    return img


LEATHER = material("warrior_leather", (1, 1, 1), image=leather_image(), back=False)
TEAM = material("warrior_team", (0.9, 0.9, 0.9), roughness=0.8)  # tinted per team in game
FEATHER = material("warrior_feather", (0.92, 0.9, 0.84), back=False)
BONE = material("warrior_bone", (0.86, 0.8, 0.66), roughness=0.6)

verts = [arm.matrix_world.inverted() @ body.matrix_world @ v.co for v in body.data.vertices]
height = max(v.z for v in verts)


def band(z0, z1):
    """Centre and radius of the body between heights z0..z1 (in the armature's space)."""
    pts = [v for v in verts if z0 < v.z < z1]
    c = sum(pts, Vector()) / len(pts)
    r = max(math.hypot(v.x - c.x, v.y - c.y) for v in pts)
    return c, r


def obj_from(bm, name, mat, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    for p in mesh.polygons:
        p.use_smooth = smooth
    mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.parent = arm
    return o


def skin_like_body(o):
    """Copies bone weights from the nearest body surface, then deforms with the rig."""
    mod = o.modifiers.new("weights", "DATA_TRANSFER")
    mod.object = body
    mod.use_vert_data = True
    mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.datalayout_transfer(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    rig = o.modifiers.new("Armature", "ARMATURE")
    rig.object = arm


def skin_to(o, bone):
    o.vertex_groups.new(name=bone).add(range(len(o.data.vertices)), 1.0, "REPLACE")
    rig = o.modifiers.new("Armature", "ARMATURE")
    rig.object = arm


# Loincloth: a belt round the hips and a skirt of hide flaring out, longer front and back.
hip_c, hip_r = band(height * 0.5, height * 0.56)
bm = bmesh.new()
uv = bm.loops.layers.uv.new("UVMap")
around, rings = 24, 6
grid = []
for j in range(rings + 1):
    t = j / rings
    row = []
    for k in range(around):
        a = 2 * math.pi * k / around
        front = abs(math.cos(a))  # front/back flaps (±Y) hang lower than the sides
        drop = height * (0.1 + 0.07 * front ** 3) * t
        r = hip_r * (1.06 + 0.25 * t)
        row.append(bm.verts.new((hip_c.x + r * math.sin(a), hip_c.y + r * math.cos(a), height * 0.555 - drop)))
    grid.append(row)
for j in range(rings):
    for k in range(around):
        k2 = (k + 1) % around
        f = bm.faces.new((grid[j][k], grid[j][k2], grid[j + 1][k2], grid[j + 1][k]))
        for loop, (u, v) in zip(f.loops, ((k, j), (k + 1, j), (k + 1, j + 1), (k, j + 1))):
            loop[uv].uv = (u / around, v / rings)
cloth = obj_from(bm, "Loincloth", LEATHER)
skin_like_body(cloth)

# Headband (team colour) round the brow, just above the eyebrows.
brow = height - 0.055  # above the eyes, below the crown
head_c, head_r = band(brow - 0.015, brow + 0.015)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=False, segments=20, radius1=head_r * 1.08, radius2=head_r * 1.05, depth=height * 0.025)
for v in bm.verts:
    v.co += Vector((head_c.x, head_c.y, brow))
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.008)
band_obj = obj_from(bm, "Gear_Band", TEAM)
skin_to(band_obj, "Head")

# Team 0: two feathers standing at the back of the band. Team 1: a pair of bone horns at the temples.
bm = bmesh.new()
for s in (-1, 1):
    base = Vector((head_c.x + s * head_r * 0.35, head_c.y + head_r * 0.95, brow + 0.01))
    quad = [Vector((s * 0.02, 0, 0)), Vector((s * 0.035, 0.03, 0.14)), Vector((s * 0.015, 0.05, 0.2)), Vector((-s * 0.005, 0.01, 0.06))]
    bm.faces.new([bm.verts.new(base + q) for q in quad])
feathers = obj_from(bm, "Gear_Feathers", FEATHER, smooth=False)
skin_to(feathers, "Head")
bm = bmesh.new()
for s in (-1, 1):
    prev = None
    for i in range(7):
        t = i / 6
        c = Vector((head_c.x + s * (head_r * 0.95 + 0.06 * t + 0.03 * t * t), head_c.y - 0.03 * t, brow + 0.02 + 0.1 * t - 0.02 * t * t))
        r = 0.022 * (1 - t) + 0.003
        ring = [bm.verts.new(c + Vector((0, r * math.cos(a), r * math.sin(a)))) for a in (2 * math.pi * k / 6 for k in range(6))]
        if prev:
            for k in range(6):
                bm.faces.new((prev[k], prev[(k + 1) % 6], ring[(k + 1) % 6], ring[k]))
        prev = ring
horns = obj_from(bm, "Gear_Horns", BONE)
skin_to(horns, "Head")

if preview:
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions.get("Idle")
    bpy.context.scene.frame_set(10)
    bpy.ops.object.light_add(type="SUN", rotation=(0.7, 0.2, 0.6))
    bpy.context.active_object.data.energy = 4
    bpy.ops.object.camera_add(location=(1.4, -2.6, 1.2), rotation=(math.radians(84), 0, math.radians(28)))
    scene = bpy.context.scene
    scene.camera = bpy.context.active_object
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.55, 0.58, 0.62)
    scene.render.resolution_x, scene.render.resolution_y = 700, 900
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(scene.camera)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o)
    arm.animation_data.action = None

for img in list(bpy.data.images):  # the normal/roughness maps unlinked above (some ship with broken paths)
    if any(k in img.name for k in ("Normal", "Roughness")):
        bpy.data.images.remove(img)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=out)
