# Builds the woolly mammoth boss, modelled on museum reconstructions (Royal BC Museum model, skeletal
# diagrams, Mauricio Antón's restorations): a tall domed head with a dip behind it, a shoulder hump, the back
# sloping down to low hips, columnar legs, small ears, a long trunk, huge tusks that sweep down, out, up
# and in, and a curtain of long shaggy hair. One smooth skin (metaballs) plus hanging hair locks, skinned
# smoothly to the rig by distance to each bone; keyframed clips: idle, walk, run, attack, hit, death.
#   blender -b --factory-startup --python tools/blender/make_mammoth.py -- art-source/creatures/crt_mammoth.blend [preview.png]
# Convention: metres, origin between the feet, faces -Y in Blender (= glTF +Z, the game's "forward").
# Clip timings must match the creature config in src/config/creatures.ts (attack wind-up especially).
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector, noise
from mathutils.kdtree import KDTree

args = sys.argv[sys.argv.index("--") + 1 :]
out = args[0]
preview = args[1] if len(args) > 1 else None
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
K = 0.575  # an isolated metaball element of radius 1 ends up 0.575 m in radius (measured)


def material(name, roughness, back=True):
    """Colour comes from the mesh's vertex colours (fur shading is painted per vertex below)."""
    m = bpy.data.materials.new(name)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    m.use_backface_culling = back  # hair locks are single sheets: seen from both sides
    return m


FUR = material("mammoth_fur", 0.95)
LOCKS = material("mammoth_locks", 0.95, back=False)
IVORY = material("mammoth_ivory", 0.45)
EYE = material("mammoth_eye", 0.25)


def link(obj):
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


# ---------- skin: one smooth surface from overlapping metaballs ----------
mb = bpy.data.metaballs.new("mammoth_skin")
mb.resolution = 0.07
mb.threshold = 0.6


def ell(center, radii):
    e = mb.elements.new(type="ELLIPSOID")
    e.co = center
    e.radius = 1.0
    e.size_x, e.size_y, e.size_z = (r / K for r in radii)


def chain(points, r0, r1, step=0.12):
    """Balls every `step` along a polyline, radius r0 -> r1 (legs, trunk, tail)."""
    pts = [Vector(p) for p in points]
    total = sum((b - a).length for a, b in zip(pts, pts[1:]))
    d = 0.0
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        n = max(1, int(seg / step))
        for i in range(n):
            t = (d + seg * i / n) / total
            e = mb.elements.new(type="BALL")
            e.co = a + (b - a) * (i / n)
            e.radius = (r0 + (r1 - r0) * t) / K
        d += seg
    e = mb.elements.new(type="BALL")
    e.co = pts[-1]
    e.radius = r1 / K


# Torso: deep chest and shoulders, a hump behind the neck, back sloping down to a narrower rump.
ell((0, 1.4, 2.0), (0.82, 0.72, 0.82))  # rump
ell((0, 0.65, 2.15), (0.95, 0.85, 0.92))  # loins
ell((0, 0.05, 1.95), (0.98, 1.05, 0.85))  # belly
ell((0, -0.6, 2.2), (0.98, 0.8, 1.0))  # chest
ell((0, -0.8, 2.85), (0.7, 0.65, 0.55))  # shoulder hump
ell((0, -1.3, 2.62), (0.6, 0.45, 0.56))  # neck (lower than hump and dome: the dip)
# Head: tall dome, sloping forehead, heavy cheeks.
ell((0, -1.82, 3.2), (0.54, 0.52, 0.7))  # dome: the highest point
ell((0, -2.2, 2.6), (0.48, 0.42, 0.62))  # face
ell((0, -2.0, 2.2), (0.46, 0.45, 0.32))  # jaw and cheeks
for s in (-1, 1):
    ell((0.5 * s, -1.65, 2.95), (0.1, 0.2, 0.24))  # small ears
# Legs: columns, the front ones longer (the shoulders stand higher than the hips).
LEGS = {"FL": (-0.55, -0.72), "FR": (0.55, -0.72), "BL": (-0.52, 1.3), "BR": (0.52, 1.3)}
for leg, (x, y) in LEGS.items():
    top = 2.0 if leg[0] == "F" else 1.85
    knee = 1.0 if leg[0] == "F" else 0.95
    chain([(x, y, top), (x, y + 0.04, knee)], 0.4, 0.31)
    chain([(x, y + 0.04, knee), (x, y, 0.2)], 0.3, 0.27)
    ell((x, y - 0.03, 0.14), (0.31, 0.32, 0.15))  # wide flat foot
# Trunk: thick at the face, tapering, hanging near the ground with a slight forward curl at the tip.
TRUNK = [(0, -2.5, 2.45), (0, -2.72, 1.75), (0, -2.8, 1.05), (0, -2.74, 0.4), (0, -2.9, 0.25)]
chain(TRUNK, 0.25, 0.09, step=0.07)
chain([(0, 2.1, 2.3), (0, 2.3, 1.85), (0, 2.35, 1.5)], 0.08, 0.05, step=0.06)  # short tail

skin_src = link(bpy.data.objects.new("skin", mb))
bpy.ops.object.convert(target="MESH")
skin = bpy.context.active_object

# Fur clumps: low-frequency lumps along the surface, then decimate to a game budget.
bm = bmesh.new()
bm.from_mesh(skin.data)
bm.normal_update()
for v in bm.verts:
    p = v.co
    clump = noise.noise(Vector((p.x * 3, p.y * 3, p.z * 1.2)))
    v.co += v.normal * 0.035 * clump
bm.to_mesh(skin.data)
bm.free()
dec = skin.modifiers.new("decimate", "DECIMATE")
dec.ratio = min(1.0, 6500 / len(skin.data.vertices))
bpy.ops.object.modifier_apply(modifier=dec.name)
for p in skin.data.polygons:
    p.use_smooth = True
skin.data.materials.append(FUR)


def fur_colour(p, n):
    """Ginger-brown on the back, dark underneath and down the legs, near-black feet and trunk tip."""
    up = max(0.0, min(1.0, (p.z - 1.0) / 2.2))
    streak = 0.5 + 0.5 * noise.noise(Vector((p.x * 9, p.y * 9, p.z * 1.5)))
    top = Vector((0.5, 0.29, 0.15))
    low = Vector((0.2, 0.12, 0.07))
    c = low.lerp(top, up * (0.6 + 0.4 * max(0.0, n.z)))
    c *= 0.82 + 0.3 * streak
    if p.z < 0.3:  # feet and the trunk's end: bare dark skin
        c = c.lerp(Vector((0.13, 0.11, 0.1)), (0.3 - p.z) / 0.3)
    return c


# ---------- hair locks: hanging tapered strips, longest on the flanks and belly ----------
locks = bmesh.new()
kd_src = skin.data.vertices
candidates = [v for v in kd_src if v.co.z > 0.7 and v.co.y > -2.3]  # everywhere but the face, trunk and feet
random.shuffle(candidates)
lock_roots = []
count = 0  # bmesh vertex indices follow creation order
for v in candidates[:1700]:
    root, n = v.co.copy(), v.normal.copy()
    hang = max(0.0, min(1.0, (2.6 - root.z) / 1.6))  # 0 on the back .. 1 low on the flanks
    length = (0.14 + 0.62 * hang) * random.uniform(0.7, 1.2)  # short on the back, a skirt on the flanks
    width = random.uniform(0.08, 0.14)
    down = Vector((0, 0, -1)).lerp(n, 0.25 - 0.15 * hang).normalized()
    side = n.cross(down).normalized() * width
    rings = []
    for i in range(4):
        t = i / 3
        sway = Vector((math.sin(root.y * 7 + i), math.cos(root.x * 7 + i), 0)) * 0.03 * t
        c = root - n * 0.04 + down * length * t + n * 0.05 * t * (1 - t) + sway
        half = side * (1 - t * 0.85)
        rings.append((locks.verts.new(c - half), locks.verts.new(c + half)))
    for (a0, a1), (b0, b1) in zip(rings, rings[1:]):
        locks.faces.new((a0, a1, b1, b0))
    lock_roots.append((root, n, list(range(count, count + 8))))
    count += 8
locks_mesh = bpy.data.meshes.new("locks")
locks.to_mesh(locks_mesh)
locks.free()
locks_obj = link(bpy.data.objects.new("locks", locks_mesh))
for p in locks_mesh.polygons:
    p.use_smooth = True
locks_mesh.materials.append(LOCKS)


# ---------- tusks: down and forward, sweeping out, then up and in until the tips nearly meet ----------
TUSK = [(0.3, -2.3, 2.3), (0.55, -2.75, 1.75), (0.95, -3.2, 1.62), (1.08, -3.58, 2.12), (0.75, -3.7, 2.75), (0.36, -3.52, 3.05)]


def tusk_point(s, t):
    """Catmull-Rom through TUSK (mirrored for the left tusk), t in 0..1."""
    pts = [Vector((x * s, y, z)) for x, y, z in TUSK]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    f = t * (len(TUSK) - 1)
    i = min(int(f), len(TUSK) - 2)
    u = f - i
    p0, p1, p2, p3 = pts[i : i + 4]
    return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u**3)


tusk_bm = bmesh.new()
for s in (-1, 1):
    seg, around = 40, 12
    rings = []
    for i in range(seg + 1):
        t = i / seg
        c = tusk_point(s, t)
        ahead = (tusk_point(s, min(1, t + 0.01)) - tusk_point(s, max(0, t - 0.01))).normalized()
        u = ahead.cross(Vector((0, 0, 1))).normalized()
        w = u.cross(ahead)
        r = 0.17 * (1 - t) ** 0.6 + 0.012
        rings.append([tusk_bm.verts.new(c + (u * math.cos(a) + w * math.sin(a)) * r)
                      for a in (2 * math.pi * k / around for k in range(around))])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(around):
            tusk_bm.faces.new((ra[k], ra[(k + 1) % around], rb[(k + 1) % around], rb[k]))
    tusk_bm.faces.new(list(reversed(rings[0])))
tusk_mesh = bpy.data.meshes.new("tusks")
tusk_bm.to_mesh(tusk_mesh)
tusk_bm.free()
tusk_obj = link(bpy.data.objects.new("tusks", tusk_mesh))
for p in tusk_mesh.polygons:
    p.use_smooth = True
tusk_mesh.materials.append(IVORY)

eye_bm = bmesh.new()
for s in (-1, 1):
    m = bmesh.ops.create_uvsphere(eye_bm, u_segments=8, v_segments=6, radius=0.045)
    for v in m["verts"]:
        v.co += Vector((0.43 * s, -2.35, 2.82))
eye_mesh = bpy.data.meshes.new("eyes")
eye_bm.to_mesh(eye_mesh)
eye_bm.free()
eye_obj = link(bpy.data.objects.new("eyes", eye_mesh))
eye_mesh.materials.append(EYE)


def paint(obj, colour):
    attr = obj.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    for i, v in enumerate(obj.data.vertices):
        c = colour(v)
        attr.data[i].color_srgb = (c.x, c.y, c.z, 1.0)


paint(skin, lambda v: fur_colour(v.co, v.normal))
lock_colour = {}
for root, n, verts in lock_roots:
    base = fur_colour(root, n) * 0.92
    for k, vi in enumerate(verts):
        lock_colour[vi] = base * (1.0 - 0.12 * (k // 2) / 3)  # a little darker toward the tips
paint(locks_obj, lambda v: lock_colour.get(v.index, Vector((0.25, 0.15, 0.08))))
paint(tusk_obj, lambda v: Vector((0.62, 0.5, 0.36)).lerp(Vector((0.9, 0.85, 0.74)), min(1.0, max(0.0, (v.co.y + 2.5) / -0.9))))
paint(eye_obj, lambda v: Vector((0.03, 0.02, 0.02)))

# ---------- armature ----------
arm_data = bpy.data.armatures.new("mammoth_rig")
arm = bpy.data.objects.new("crt_mammoth_rig", arm_data)
link(arm)
bpy.ops.object.mode_set(mode="EDIT")


def bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.roll = 0
    if parent:
        b.parent = arm_data.edit_bones[parent]
    return b


bone("root", (0, 0, 0), (0, -1, 0))  # along the facing axis: rolling it tips the animal onto its side
bone("body", (0, 1.2, 2.15), (0, -1.0, 2.45), "root")
bone("head", (0, -1.45, 2.85), (0, -2.35, 2.75), "body")
bone("trunk.1", TRUNK[0], TRUNK[1], "head")
bone("trunk.2", TRUNK[1], TRUNK[2], "trunk.1")
bone("trunk.3", TRUNK[2], TRUNK[4], "trunk.2")
bone("tail", (0, 2.1, 2.3), (0, 2.35, 1.5), "body")
for leg, (x, y) in LEGS.items():
    top = 2.0 if leg[0] == "F" else 1.85
    knee = 1.0 if leg[0] == "F" else 0.95
    bone(f"leg.{leg}.up", (x, y, top), (x, y + 0.04, knee), "body")
    bone(f"leg.{leg}.low", (x, y + 0.04, knee), (x, y, 0.0), f"leg.{leg}.up")
segments = {b.name: (b.head.copy(), b.tail.copy()) for b in arm_data.edit_bones if b.name != "root"}
bpy.ops.object.mode_set(mode="OBJECT")


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


def skin_smooth(obj, positions=None):
    """Weights by inverse distance to each bone segment, the nearest three blended: soft joints."""
    groups = {name: obj.vertex_groups.new(name=name) for name in segments}
    for v in obj.data.vertices:
        p = positions[v.index] if positions else v.co
        near = sorted((seg_dist(p, a, b), name) for name, (a, b) in segments.items())[:3]
        ws = [(1.0 / (d**4 + 1e-4), name) for d, name in near]
        total = sum(w for w, _ in ws)
        for w, name in ws:
            groups[name].add([v.index], w / total, "REPLACE")


def skin_rigid(obj, name):
    obj.vertex_groups.new(name=name).add(range(len(obj.data.vertices)), 1.0, "REPLACE")


skin_smooth(skin)
# Each lock follows the skin where it grows, so hair moves with the leg or body under it.
lock_pos = {}
for root, n, verts in lock_roots:
    for vi in verts:
        lock_pos[vi] = root
skin_smooth(locks_obj, lock_pos)
skin_rigid(tusk_obj, "head")
skin_rigid(eye_obj, "head")

bpy.ops.object.select_all(action="DESELECT")
for o in (skin, locks_obj, tusk_obj, eye_obj):
    o.select_set(True)
bpy.context.view_layer.objects.active = skin
bpy.ops.object.join()
mesh_obj = skin
mesh_obj.name = mesh_obj.data.name = "crt_mammoth"
mesh_obj.parent = arm
mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
mod.object = arm
print("mammoth verts:", len(mesh_obj.data.vertices))

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

if preview:
    # Side, three-quarter and front views under a sun, to compare against the reference photos.
    bpy.ops.object.light_add(type="SUN", rotation=(0.8, 0.3, 0.9))
    bpy.context.active_object.data.energy = 4
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.55, 0.6, 0.65)
    scene.render.resolution_x, scene.render.resolution_y = 900, 600
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    scene.camera = cam
    cam.data.lens = 35
    for name, loc in (("side", (13, -0.5, 2.4)), ("three_quarter", (8.5, -9, 2.6)), ("front", (1.5, -12, 2.4))):
        cam.location = loc
        cam.rotation_euler = (Vector((0, -0.8, 1.9)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = preview.replace(".png", f"_{name}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o)

bpy.ops.wm.save_as_mainfile(filepath=out)
