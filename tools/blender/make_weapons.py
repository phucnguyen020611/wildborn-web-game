# Builds the Tribal War weapon kit (stone axe, club, javelin, bow, arrow) as one editable .blend source:
#   blender -b --factory-startup --python tools/blender/make_weapons.py -- art-source/weapons/wpn_kit.blend [preview.png]
# Convention (same as wpn_spear, docs/ART_GUIDE.md): metres, origin at the grip, the weapon along +Z
# (glTF +Y), striking end toward +Z. The bow's limbs run along Z with the string on its -Y side, so an
# arrow on it points +Y. Object names are the node names the game looks up.
# Wood uses the Stylized Nature MegaKit bark (CC0; MEGAKIT=<kit glTF folder>); flint, sinew and feathers
# are flat colours; the grip leather is painted in code.
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

args = sys.argv[sys.argv.index("--") + 1 :]
out = args[0]
preview = args[1] if len(args) > 1 else None
KIT = os.environ.get("MEGAKIT", os.path.join(os.path.dirname(__file__), "../../../../Assets/stylized-nature-megakit/glTF"))
random.seed(3)
bpy.ops.wm.read_factory_settings(use_empty=True)


def lin(c):
    return (*(v**2.2 for v in c), 1)


def material(name, srgb, roughness=0.9, image=None):
    m = bpy.data.materials.new(name)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    m.diffuse_color = lin(srgb)
    if image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1
        links.new(tex.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = lin(srgb)
        links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = lin(srgb)
    return m


bark = bpy.data.images.load(os.path.join(KIT, "Bark_NormalTree.png"))
bark.scale(512, 512)
bark.pack()


def leather_image():
    n = 128
    img = bpy.data.images.new("wpn_leather", n, n)
    px = []
    for y in range(n):
        for x in range(n):
            p = Vector((math.cos(2 * math.pi * x / n), math.sin(2 * math.pi * x / n), y / n * 4))
            k = 0.8 + 0.2 * noise.fractal(p * 2, 0.6, 2.0, 3)
            k *= 0.75 if (y % 16) < 2 else 1.0  # wrap seams
            px += [0.45 * k, 0.32 * k, 0.2 * k, 1]
    img.pixels = px
    img.pack()
    return img


WOOD = material("wpn_wood", (0.85, 0.72, 0.6), image=bark)
WOOD_DARK = material("wpn_wood_dark", (0.6, 0.5, 0.42), image=bark)
LEATHER = material("wpn_leather", (1, 1, 1), image=leather_image())
FLINT = material("wpn_flint", (0.24, 0.24, 0.26), roughness=0.45)
FLINT_LIGHT = material("wpn_flint_light", (0.55, 0.52, 0.48), roughness=0.5)
SINEW = material("wpn_sinew", (0.62, 0.52, 0.36))
FEATHER = material("wpn_feather", (0.85, 0.82, 0.74))
FEATHER_RED = material("wpn_feather_red", (0.6, 0.16, 0.1))


def obj_from(bm, name, mats, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    for p in mesh.polygons:
        p.use_smooth = smooth
    for m in mats if isinstance(mats, (list, tuple)) else [mats]:
        mesh.materials.append(m)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    return o


def tube(mat, pts, radii, segments=10, tile=0.25, caps=True, smooth=True):
    """Tube through `pts` with radius per point; bark UVs (around once, along by length / tile)."""
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    rings, along = [], [0.0]
    for i in range(1, len(pts)):
        along.append(along[-1] + (pts[i] - pts[i - 1]).length)
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = d.orthogonal().normalized()
        w = d.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(a) + w * math.sin(a)) * r) for a in (2 * math.pi * k / segments for k in range(segments))])
    for i in range(len(rings) - 1):
        for k in range(segments):
            k2 = (k + 1) % segments
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            for loop, (a, b) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                loop[uv].uv = (a / segments, along[b] / tile)
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return obj_from(bm, "part", mat, smooth)


def knapped(mat, center, size, jitter=0.18, rot=Matrix.Identity(3), subdiv=1):
    """Faceted flint: an icosphere squashed to `size` with chipped (jittered) flat faces."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1)
    for v in bm.verts:
        n = v.co.normalized()
        v.co = rot @ Vector((n.x * size[0], n.y * size[1], n.z * size[2])) * (1 + random.uniform(-jitter, jitter)) + Vector(center)
    return obj_from(bm, "part", mat, smooth=False)


def leaf_point(mat, base, length, width, thick):
    """Leaf-shaped flint point along +Z from `base`: a lens with a ridge, flat-shaded."""
    bm = bmesh.new()
    ring = []
    steps = 8
    for i in range(steps + 1):
        t = i / steps
        w = width * math.sin(math.pi * min(1, t * 1.15)) * (1 - t) ** 0.3
        ring.append((t * length, w))
    top = [bm.verts.new((w, 0, z)) for z, w in ring]
    bot = [bm.verts.new((-w, 0, z)) for z, w in ring]
    ridge_f = [bm.verts.new((0, thick * math.sin(math.pi * z / length), z)) for z, _ in ring]
    ridge_b = [bm.verts.new((0, -thick * math.sin(math.pi * z / length), z)) for z, _ in ring]
    for i in range(steps):
        for side in (top, bot):
            bm.faces.new((side[i], side[i + 1], ridge_f[i + 1], ridge_f[i]))
            bm.faces.new((side[i + 1], side[i], ridge_b[i], ridge_b[i + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for v in bm.verts:
        v.co += Vector(base)
    return obj_from(bm, "part", mat, smooth=False)


def sleeve(z0, z1, radius):
    """Leather grip: a snug wrapped sleeve over the shaft (the seams are in the texture)."""
    n = 6
    pts = [(0, 0, z0 + (z1 - z0) * i / n) for i in range(n + 1)]
    r = [radius * (0.92 if i in (0, n) else 1.0) for i in range(n + 1)]  # tucked ends
    return tube(LEATHER, pts, r, segments=10, tile=(z1 - z0))


def wraps(mat, z0, z1, radius, turns, thickness=0.006):
    """Sinew or rawhide binding: a tight helix of cord round the shaft between z0 and z1."""
    n = turns * 10
    pts = [(radius * math.cos(2 * math.pi * turns * i / n), radius * math.sin(2 * math.pi * turns * i / n), z0 + (z1 - z0) * i / n) for i in range(n + 1)]
    return tube(mat, pts, [thickness] * len(pts), segments=5, tile=0.05)


def join(name, parts):
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = parts[0]
    o.name = o.data.name = name
    return o


def bent(z0, z1, n, bow=0.0, jit=0.0):
    """Points from z0 to z1 along Z with a slight sideways bow (natural wood) and jitter."""
    return [(math.sin(math.pi * i / n) * bow + random.uniform(-jit, jit), random.uniform(-jit, jit), z0 + (z1 - z0) * i / n) for i in range(n + 1)]


# Stone axe: a knapped flint head lashed into a split haft. Heavy end up (+Z), grip at the origin.
def axe():
    haft = tube(WOOD, bent(-0.14, 0.58, 8, bow=0.012, jit=0.002), [0.017, 0.018, 0.019, 0.02, 0.021, 0.023, 0.025, 0.027, 0.027], segments=9)
    head = knapped(FLINT, (0.075, 0, 0.47), (0.12, 0.028, 0.075), jitter=0.15)  # blade forward (+X)
    butt = knapped(FLINT, (-0.035, 0, 0.47), (0.03, 0.026, 0.05), jitter=0.12)
    lash = [wraps(SINEW, 0.41, 0.53, 0.03, 9, thickness=0.005)]
    for s in (-1, 1):  # cross lashing over the head
        lash.append(tube(SINEW, [(0.02, s * 0.03, 0.40), (0.0, s * 0.034, 0.47), (-0.02, s * 0.03, 0.54)], [0.006] * 3, segments=5, tile=0.05))
    grip = sleeve(-0.1, 0.12, 0.023)
    return join("Axe", [haft, head, butt, *lash, grip])


# Club: a knotty branch, swelling into a heavy head studded with flint chips.
def club():
    radii = [0.02, 0.021, 0.023, 0.026, 0.031, 0.04, 0.052, 0.06, 0.05]
    body = tube(WOOD_DARK, bent(-0.15, 0.6, 8, bow=0.018, jit=0.003), radii, segments=10)
    knob = knapped(WOOD_DARK, (0.004, 0, 0.56), (0.062, 0.06, 0.08), jitter=0.12, subdiv=2)
    knob.data.polygons.foreach_set("use_smooth", [True] * len(knob.data.polygons))
    chips = []
    for i in range(7):
        a = i * 2.4
        z = 0.42 + 0.03 * (i % 4)
        r = 0.05 + 0.006 * (i % 3)
        d = Vector((math.cos(a), math.sin(a), 0))
        rot = d.to_track_quat("X", "Z").to_matrix()
        chips.append(knapped(FLINT, (d.x * (r + 0.015), d.y * (r + 0.015), z), (0.035, 0.01, 0.022), jitter=0.2, rot=rot))
    grip = sleeve(-0.12, 0.1, 0.025)
    return join("Club", [body, knob, *chips, grip])


# Javelin: light, straight shaft, leaf point bound with sinew; gripped a little behind the balance point.
def javelin():
    shaft = tube(WOOD, bent(-0.5, 0.62, 10, jit=0.001), [0.011] * 3 + [0.012] * 5 + [0.0115] * 3, segments=7, tile=0.4)
    point = leaf_point(FLINT_LIGHT, (0, 0, 0.6), 0.14, 0.024, 0.006)
    bind = wraps(SINEW, 0.56, 0.63, 0.013, 9, thickness=0.003)
    grip = sleeve(-0.06, 0.06, 0.0145)
    return join("Javelin", [shaft, point, bind, grip])


# Bow: a self bow, limbs along Z (curving toward +Y), leather grip, string on the -Y side.
def bow():
    tip = 0.68
    pts, radii = [], []
    n = 16
    for i in range(n + 1):
        t = -1 + 2 * i / n
        z = t * tip
        y = 0.07 * (1 - t * t) - 0.012  # limbs curve away from the archer
        pts.append((0, y + 0.02 * t ** 4, z))  # tips recurve back a little
        radii.append(0.016 * (1 - 0.6 * abs(t)) + 0.005)
    limbs = tube(WOOD, pts, radii, segments=8, tile=0.3)
    grip = sleeve(-0.07, 0.07, 0.022)
    a, b = Vector(pts[0]), Vector(pts[-1])
    string = tube(SINEW, [a + Vector((0, -0.004, 0.01)), b + Vector((0, -0.004, -0.01))], [0.0025, 0.0025], segments=4, tile=0.2)
    nocks = [tube(SINEW, [p + Vector((0, 0, -0.025)), p + Vector((0, 0, 0.025))], [0.008, 0.008], segments=6) for p in (a, b)]
    return join("Bow", [limbs, grip, string, *nocks])


# Arrow: along +Z, origin at the nock end; flint point, three fletches.
def arrow():
    shaft = tube(WOOD, bent(0, 0.74, 6), [0.0055] * 7, segments=6, tile=0.4)
    point = leaf_point(FLINT, (0, 0, 0.72), 0.06, 0.012, 0.004)
    bind = wraps(SINEW, 0.7, 0.735, 0.0065, 3, thickness=0.0025)
    fletch = []
    for k in range(3):
        a = 2 * math.pi * k / 3
        d = Vector((math.cos(a), math.sin(a), 0))
        bm = bmesh.new()
        q = [bm.verts.new(d * r + Vector((0, 0, z))) for r, z in ((0.006, 0.03), (0.022, 0.05), (0.02, 0.13), (0.006, 0.15))]
        bm.faces.new(q)
        fletch.append(obj_from(bm, "part", FEATHER_RED if k == 0 else FEATHER, smooth=False))
    nock = tube(SINEW, [(0, 0, -0.005), (0, 0, 0.02)], [0.007, 0.007], segments=6)
    return join("Arrow", [shaft, point, bind, *fletch, nock])


made = [axe(), club(), javelin(), bow(), arrow()]
FEATHER.use_backface_culling = False  # single-sheet fletches: seen from both sides
FEATHER_RED.use_backface_culling = False

if preview:
    for i, o in enumerate(made):
        o.location.x = (i - 2) * 0.42
        o.location.z = -0.1 if o.name != "Bow" else 0.0
    bpy.ops.object.light_add(type="SUN", rotation=(0.6, 0.3, 0.8))
    bpy.context.active_object.data.energy = 4
    bpy.ops.object.camera_add(location=(0, -3.2, 0.2), rotation=(math.radians(88), 0, 0))
    scene = bpy.context.scene
    scene.camera = bpy.context.active_object
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.55, 0.58, 0.62)
    scene.render.resolution_x, scene.render.resolution_y = 1400, 800
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(scene.camera)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o)
    for o in made:
        o.location.x = 0

bpy.ops.wm.save_as_mainfile(filepath=out)
