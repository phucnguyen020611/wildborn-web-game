# Builds the stylized woolly mammoth boss: soft lumpy fur masses (smooth shaded), a rigid-skinned armature
# (each part follows one bone) and keyframed clips: idle, walk, run, attack, hit, death.
#   blender -b --factory-startup --python tools/blender/make_mammoth.py -- art-source/creatures/crt_mammoth.blend
# Convention: metres, origin between the feet, faces -Y in Blender (= glTF +Z, the game's "forward").
# Clip timings must match the creature config in src/config/creatures.ts (attack wind-up especially).
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1 :][0]
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def material(name, srgb, roughness=0.95):
    m = bpy.data.materials.new(name)
    lin = (*(c**2.2 for c in srgb), 1)
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    m.diffuse_color = lin
    return m


FUR = material("mammoth_fur", (0.42, 0.29, 0.18))
FUR_DARK = material("mammoth_fur_dark", (0.30, 0.20, 0.13))
SKIN = material("mammoth_skin", (0.28, 0.24, 0.22))
IVORY = material("mammoth_ivory", (0.88, 0.83, 0.72), roughness=0.6)

parts = []  # (object, bone name)


def finish(bm, name, mat, bone, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        # Smooth sides; n-gon caps (tube ends) stay flat, which also keeps their edges crisp.
        p.use_smooth = smooth and len(p.vertices) <= 4
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    parts.append((obj, bone))
    return obj


def blob(name, mat, bone, center, radii, subdiv=4, jitter=0.06, shag=0.0):
    """Soft, lumpy ellipsoid: smooth low-frequency bumps read as fur masses; `shag` adds ragged tufts."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    k = [random.uniform(0, 6.28) for _ in range(3)]
    for v in bm.verts:
        n = v.co.normalized()
        lump = math.sin(5 * n.x + k[0]) * math.sin(4 * n.y + k[1]) * math.sin(6 * n.z + k[2])
        ragged = random.uniform(-shag, shag) if n.z < 0.2 else 0  # tufts only on the lower half
        v.co = Vector((n.x * radii[0], n.y * radii[1], n.z * radii[2])) * (1 + jitter * lump + ragged)
        v.co += Vector(center)
    return finish(bm, name, mat, bone)


def tube(name, mat, bone, a, b, r_a, r_b, segments=14, jitter=0.0):
    """Tapered cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r_a, radius2=r_b, depth=(b - a).length)
    rot = (b - a).to_track_quat("Z", "Y").to_matrix().to_4x4()
    for v in bm.verts:
        v.co.z += (b - a).length / 2  # cone is centred; move its base to the origin
        v.co = rot @ v.co + a
        if jitter:
            v.co += Vector([random.uniform(-jitter, jitter) for _ in range(3)])
    return finish(bm, name, mat, bone)


def curve_tube(name, mat, bone, points, r_start, r_end, segments=12):
    """Chain of tubes through `points`, tapering from r_start to r_end (tusks, trunk tip)."""
    n = len(points) - 1
    for i in range(n):
        r0 = r_start + (r_end - r_start) * i / n
        r1 = r_start + (r_end - r_start) * (i + 1) / n
        tube(f"{name}_{i}", mat, bone, points[i], points[i + 1], r0, r1 * 1.02 if i < n - 1 else r1, segments)


# ---------- body (faces -Y) ----------
blob("body", FUR, "body", (0, 0.1, 2.15), (1.15, 1.9, 1.25))
blob("belly_fur", FUR_DARK, "body", (0, 0.1, 1.55), (1.05, 1.75, 0.55), jitter=0.1, shag=0.12)  # shaggy hanging fur
blob("hump", FUR_DARK, "body", (0, -0.75, 2.95), (0.95, 0.95, 0.75))
blob("rump", FUR, "body", (0, 1.45, 2.05), (0.95, 0.75, 1.0))
blob("head", FUR_DARK, "head", (0, -2.05, 2.95), (0.72, 0.75, 0.85))
blob("cheeks", FUR, "head", (0, -2.2, 2.55), (0.62, 0.55, 0.5))
for s in (-1, 1):
    blob(f"ear_{s}", SKIN, "head", (0.62 * s, -1.85, 3.05), (0.12, 0.3, 0.35), subdiv=3, jitter=0.1)
    blob(f"eye_{s}", SKIN, "head", (0.5 * s, -2.55, 2.95), (0.07, 0.07, 0.07), subdiv=3, jitter=0.0)
    curve_tube(  # tusk: curves down, forward, then up and inward
        f"tusk_{s}", IVORY, "head",
        [(0.32 * s, -2.55, 2.4), (0.45 * s, -2.95, 1.9), (0.5 * s, -3.45, 1.7), (0.4 * s, -3.85, 1.95), (0.18 * s, -3.95, 2.35)],
        0.15, 0.05,
    )

# Trunk: three segments, each on its own bone so it can curl and sway.
TRUNK = [(0, -2.72, 2.55), (0, -3.0, 1.85), (0, -3.08, 1.2), (0, -3.0, 0.55)]
tube("trunk_0", FUR_DARK, "trunk.1", TRUNK[0], TRUNK[1], 0.28, 0.21, jitter=0.02)
tube("trunk_1", SKIN, "trunk.2", TRUNK[1], TRUNK[2], 0.21, 0.15, jitter=0.015)
tube("trunk_2", SKIN, "trunk.3", TRUNK[2], TRUNK[3], 0.15, 0.11, jitter=0.01)

# Legs: upper and lower on separate bones; the lower ends in a wide foot.
LEGS = {"FL": (-0.62, -0.95), "FR": (0.62, -0.95), "BL": (-0.6, 1.25), "BR": (0.6, 1.25)}
for leg, (x, y) in LEGS.items():
    tube(f"leg_{leg}_up", FUR, f"leg.{leg}.up", (x, y, 1.95), (x, y, 0.95), 0.42, 0.33, jitter=0.04)
    tube(f"leg_{leg}_low", FUR_DARK, f"leg.{leg}.low", (x, y, 0.98), (x, y, 0.12), 0.33, 0.3, jitter=0.03)
    tube(f"foot_{leg}", SKIN, f"leg.{leg}.low", (x, y, 0.16), (x, y, 0.0), 0.36, 0.36)

tube("tail_0", FUR, "tail", (0, 2.1, 2.45), (0, 2.35, 1.75), 0.1, 0.06)
blob("tail_tuft", FUR_DARK, "tail", (0, 2.38, 1.65), (0.12, 0.12, 0.18), subdiv=3, shag=0.2)

# ---------- armature ----------
arm_data = bpy.data.armatures.new("mammoth_rig")
arm = bpy.data.objects.new("crt_mammoth_rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")


def bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.roll = 0
    if parent:
        b.parent = arm_data.edit_bones[parent]
    return b


bone("root", (0, 0, 0), (0, -1, 0))  # along the facing axis: rolling it tips the animal onto its side
bone("body", (0, 1.0, 2.2), (0, -1.0, 2.3), "root")
bone("head", (0, -1.55, 2.95), (0, -2.5, 2.95), "body")
bone("trunk.1", TRUNK[0], TRUNK[1], "head")
bone("trunk.2", TRUNK[1], TRUNK[2], "trunk.1")
bone("trunk.3", TRUNK[2], TRUNK[3], "trunk.2")
bone("tail", (0, 2.1, 2.45), (0, 2.35, 1.75), "body")
for leg, (x, y) in LEGS.items():
    bone(f"leg.{leg}.up", (x, y, 1.95), (x, y, 0.97), "body")
    bone(f"leg.{leg}.low", (x, y, 0.97), (x, y, 0.0), f"leg.{leg}.up")
bpy.ops.object.mode_set(mode="OBJECT")

# Rigid skinning: every vertex of a part fully follows its bone. Then merge into one mesh.
for obj, b in parts:
    vg = obj.vertex_groups.new(name=b)
    vg.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
bpy.ops.object.select_all(action="DESELECT")
for obj, _ in parts:
    obj.select_set(True)
mesh_obj = parts[0][0]
bpy.context.view_layer.objects.active = mesh_obj
bpy.ops.object.join()
mesh_obj.name = mesh_obj.data.name = "crt_mammoth"
mesh_obj.parent = arm
mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
mod.object = arm

# ---------- animation clips ----------
pose = arm.pose.bones
for pb in pose:
    pb.rotation_mode = "XYZ"
arm.animation_data_create()
D = math.radians


def clip(name, frames, fn):
    """Keyframe every bone each frame from fn(t in 0..1) -> {bone: (rot_xyz_deg, loc)}."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for f in range(frames + 1):
        t = f / frames
        pose_at = fn(t)
        for pb in pose:
            rot, loc = pose_at.get(pb.name, ((0, 0, 0), (0, 0, 0)))
            pb.rotation_euler = (D(rot[0]), D(rot[1]), D(rot[2]))
            pb.location = loc
            pb.keyframe_insert("rotation_euler", frame=f)
            pb.keyframe_insert("location", frame=f)
    return act


def gait(amp, bob, nod):
    def fn(t):
        a = 2 * math.pi * t
        p = {}
        for leg, phase in (("FL", 0), ("BR", 0), ("FR", math.pi), ("BL", math.pi)):
            s = math.sin(a + phase)
            p[f"leg.{leg}.up"] = ((amp * s, 0, 0), (0, 0, 0))
            p[f"leg.{leg}.low"] = ((max(0.0, -1.3 * amp * math.cos(a + phase)), 0, 0), (0, 0, 0))  # lift on the forward swing
        p["body"] = ((0, 0, 0), (0, bob * math.sin(2 * a), 0))  # bone-local Y is world Z for this bone? kept tiny anyway
        p["head"] = ((nod * math.sin(2 * a + 0.6), 0, 0), (0, 0, 0))
        p["trunk.1"] = ((6 * math.sin(a), 0, 0), (0, 0, 0))
        p["trunk.2"] = ((8 * math.sin(a + 0.5), 0, 0), (0, 0, 0))
        p["trunk.3"] = ((10 * math.sin(a + 1.0), 0, 0), (0, 0, 0))
        p["tail"] = ((0, 0, 15 * math.sin(a)), (0, 0, 0))
        return p

    return fn


def idle(t):
    a = 2 * math.pi * t
    return {
        "body": ((1.5 * math.sin(a), 0, 0), (0, 0, 0)),
        "head": ((3 * math.sin(a + 0.8), 0, 2 * math.sin(a * 0.5)), (0, 0, 0)),
        "trunk.1": ((5 * math.sin(a), 0, 3 * math.sin(a)), (0, 0, 0)),
        "trunk.2": ((7 * math.sin(a + 0.6), 0, 4 * math.sin(a + 0.6)), (0, 0, 0)),
        "trunk.3": ((9 * math.sin(a + 1.2), 0, 5 * math.sin(a + 1.2)), (0, 0, 0)),
        "tail": ((0, 0, 12 * math.sin(a)), (0, 0, 0)),
    }


def smooth(k):
    k = max(0.0, min(1.0, k))
    return k * k * (3 - 2 * k)


ATTACK_WINDUP = 0.7  # seconds; = attackWindup in creatures.ts. Clip: 0.7 s rear up, 0.2 s strike, 0.5 s recover.


def attack(t):
    sec = t * 1.4
    up = smooth(sec / ATTACK_WINDUP)  # 0 -> 1 rearing (the telegraph)
    strike = smooth((sec - ATTACK_WINDUP) / 0.2)  # 0 -> 1 swing down
    back = smooth((sec - ATTACK_WINDUP - 0.2) / 0.5)  # 0 -> 1 recover
    # For bones pointing forward (-Y), +X rotation lifts the tip.
    head = 28 * up * (1 - strike) - 30 * strike * (1 - back)
    curl = (1 - strike) * up
    return {
        "body": ((6 * up * (1 - strike) - 4 * strike * (1 - back), 0, 0), (0, 0, 0)),
        "head": ((head, 0, 0), (0, 0, 0)),
        "trunk.1": ((35 * curl - 20 * strike * (1 - back), 0, 0), (0, 0, 0)),
        "trunk.2": ((30 * curl - 15 * strike * (1 - back), 0, 0), (0, 0, 0)),
        "trunk.3": ((25 * curl, 0, 0), (0, 0, 0)),
        "leg.FL.up": ((-25 * up * (1 - strike), 0, 0), (0, 0, 0)),  # front foot lifts, then stamps
        "leg.FL.low": ((30 * up * (1 - strike), 0, 0), (0, 0, 0)),
    }


def hit(t):
    k = math.sin(math.pi * t)
    return {"head": ((-12 * k, 0, 6 * k), (0, 0, 0)), "body": ((-3 * k, 0, 0), (0, 0, 0))}


def death(t):
    k = smooth(t / 0.6)  # legs buckle
    roll = smooth((t - 0.3) / 0.7)  # then topple
    p = {f"leg.{leg}.up": ((35 * k, 0, 0), (0, 0, 0)) for leg in LEGS}
    p.update({f"leg.{leg}.low": ((-50 * k, 0, 0), (0, 0, 0)) for leg in LEGS})
    p["root"] = ((0, 80 * roll, 0), (0, 0, 0))
    p["head"] = ((20 * k, 0, 0), (0, 0, 0))
    p["trunk.1"] = ((25 * k, 0, 0), (0, 0, 0))
    return p


clip("Idle", 60, idle)
clip("Walk", 36, gait(amp=18, bob=0.04, nod=3))
clip("Run", 22, gait(amp=30, bob=0.08, nod=5))
clip("Attack", 42, attack)
clip("Hit", 9, hit)
clip("Death", 45, death)
arm.animation_data.action = bpy.data.actions["Idle"]

bpy.ops.wm.save_as_mainfile(filepath=out)
