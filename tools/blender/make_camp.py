# Builds the tribal camp kit (one object per prop) and saves it as an editable .blend source:
#   blender -b --factory-startup --python tools/blender/make_camp.py -- art-source/props/env_kit_camp.blend [preview.png]
# Convention (docs/ART_GUIDE.md): meters, origin on the ground at the prop's centre, Z up (glTF Y up).
# Object names are the node names src/config/props.ts refers to.
# Wood uses the Stylized Nature MegaKit bark (CC0, same look as the trees; set MEGAKIT=<kit glTF folder>,
# default ../../Assets/stylized-nature-megakit/glTF); hides use a leather texture painted here in code.
# Open the .blend in Blender to tweak by hand; re-run this script only to start over.
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
TEX = 512  # camp textures are small on screen: 512² keeps the kit light
random.seed(5)  # same "hand-made" irregularities every run
bpy.ops.wm.read_factory_settings(use_empty=True)


def lin(srgb):
    return (*(c**2.2 for c in srgb), 1)


def kit_image(name):
    img = bpy.data.images.load(os.path.join(KIT, name + ".png"))
    img.scale(TEX, TEX)
    img.pack()
    return img


def leather_image():
    """Hide panels: blotchy tanned leather, a stitched seam on the left edge (u tiles around the tent),
    dirt toward the ground (v = 0) and soot toward the smoke hole (v = 1)."""
    n = 256
    img = bpy.data.images.new("camp_leather", n, n)
    px = [0.0] * (n * n * 4)
    base = Vector((0.62, 0.48, 0.33))
    for y in range(n):
        v = y / n
        for x in range(n):
            u = x / n
            p = Vector((math.cos(2 * math.pi * u) * 1.3, math.sin(2 * math.pi * u) * 1.3, v * 6))  # seamless in u
            blot = noise.fractal(p * 1.5, 0.6, 2.0, 4)
            vein = abs(noise.noise(p * 7))
            k = 0.86 + 0.16 * blot - 0.08 * vein
            k *= 1 - 0.35 * max(0, 1 - v / 0.12) ** 2  # mud splash at the hem
            k *= 1 - 0.55 * max(0, (v - 0.72) / 0.28) ** 1.5  # smoke-stained top
            seam = min(x, n - x)
            if seam < 3:
                k *= 0.6  # overlap shadow
            elif seam < 7 and (y // 6) % 2 == 0:
                k *= 0.75  # sinew stitches
            c = base * k
            i = (y * n + x) * 4
            px[i : i + 4] = [c.x, c.y, c.z, 1]  # a new byte image stores sRGB as given
    img.pixels = px
    img.pack()
    return img


def material(name, srgb, roughness=0.95, image=None, emit=None):
    m = bpy.data.materials.new(name)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0
    m.diffuse_color = lin(srgb)  # viewport colour
    if image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        # Texture × tint: the glTF exporter turns a Multiply mix with a constant into baseColorFactor.
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1
        links.new(tex.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = lin(srgb)
        links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = lin(srgb)
    if emit:
        bsdf.inputs["Emission Color"].default_value = lin(emit)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


# shortcut: no bark normal map: ~250 KB more for detail barely visible on props this size; add if close-ups need it.
BARK_IMG = kit_image("Bark_NormalTree")
LEATHER = leather_image()
HIDE = material("camp_hide", (1, 1, 1), image=LEATHER)
HIDE_DARK = material("camp_hide_dark", (0.72, 0.68, 0.64), image=LEATHER)
WOOD = material("camp_wood", (0.78, 0.72, 0.66), image=BARK_IMG)  # peeled, weathered poles
BARK = material("camp_bark", (0.82, 0.74, 0.68), image=BARK_IMG)
CHAR = material("camp_char", (0.3, 0.25, 0.22), image=BARK_IMG)
CUT = material("camp_cut_wood", (0.66, 0.52, 0.34))
ASH = material("camp_ash", (0.24, 0.22, 0.2))
EMBER = material("camp_ember", (0.9, 0.35, 0.08), roughness=0.6, emit=(1.0, 0.38, 0.08))
STONE = material("camp_stone", (0.5, 0.48, 0.44), roughness=0.85)
STONE_DARK = material("camp_stone_dark", (0.36, 0.34, 0.32), roughness=0.85)
BONE = material("camp_bone", (0.84, 0.79, 0.67), roughness=0.7)
ROPE = material("camp_rope", (0.46, 0.38, 0.26))


def mesh_obj(name, bm, mats, smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if not mesh.uv_layers:  # join keeps the active part's UV layers: every part needs one
        mesh.uv_layers.new(name="UVMap")
    for p in mesh.polygons:
        p.use_smooth = smooth
    for m in mats if isinstance(mats, (list, tuple)) else [mats]:
        mesh.materials.append(m)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def tube(mat, a, b, r_a, r_b, segments=10, rings=1, jitter=0.0, caps=None, bend=(0, 0, 0), tile=0.7):
    """Tapered round wood from a to b with bark UVs (texture tile ≈ `tile` m around), optional sideways
    `bend` at the middle, and `caps` (end-face material, e.g. cut wood). Smooth shaded."""
    a, b = Vector(a), Vector(b)
    axis = b - a
    length = axis.length
    rot = axis.to_track_quat("Z", "Y").to_matrix()
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    rings_v = []
    for j in range(rings + 1):
        t = j / rings
        r = r_a + (r_b - r_a) * t
        centre = a + axis * t + Vector(bend) * math.sin(math.pi * t)
        ring = []
        for k in range(segments):
            ang = 2 * math.pi * k / segments
            rr = r * (1 + random.uniform(-jitter, jitter))
            ring.append(bm.verts.new(centre + rot @ Vector((math.cos(ang) * rr, math.sin(ang) * rr, 0))))
        rings_v.append(ring)
    around = max(1, round(2 * math.pi * max(r_a, r_b) / tile))
    for j in range(rings):
        for k in range(segments):
            k2 = (k + 1) % segments
            f = bm.faces.new((rings_v[j][k], rings_v[j][k2], rings_v[j + 1][k2], rings_v[j + 1][k]))
            us = (k / segments * around, (k + 1) / segments * around)
            vs = (j / rings * length / tile, (j + 1) / rings * length / tile)
            for loop, (uu, vv) in zip(f.loops, ((us[0], vs[0]), (us[1], vs[0]), (us[1], vs[1]), (us[0], vs[1]))):
                loop[uv].uv = (uu, vv)
    mats = [mat]
    if caps:
        mats.append(caps)
        for ring, flip in ((rings_v[0], True), (rings_v[-1], False)):
            f = bm.faces.new(list(reversed(ring)) if flip else ring)
            f.material_index = 1
            f.smooth = False
    obj = mesh_obj("part", bm, mats, smooth=True)
    if caps:
        for p in obj.data.polygons:
            p.use_smooth = p.material_index == 0
    return obj


def rock(mat, center, radii, jitter=0.15, subdiv=2, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    seed = Vector([random.uniform(0, 100) for _ in range(3)])
    for v in bm.verts:
        n = v.co.normalized()
        bump = 1 + jitter * noise.noise(n * 1.7 + seed)
        v.co = Vector((n.x * radii[0], n.y * radii[1], n.z * radii[2])) * bump + Vector(center)
    return mesh_obj("part", bm, mat, smooth=smooth)


def disc(mat, radius, z, segments=14, wobble=0.06):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=segments, radius=radius)
    for v in bm.verts:
        v.co.z = z
        v.co.x *= 1 + random.uniform(-wobble, wobble)
        v.co.y *= 1 + random.uniform(-wobble, wobble)
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


def solidify(obj, thickness):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("solidify", "SOLIDIFY")
    mod.thickness = thickness
    bpy.ops.object.modifier_apply(modifier=mod.name)


# Hide tent: stitched hides sagging between 12 poles, which cross and are lashed above the smoke hole.
# The doorway faces -Y (glTF +Z, the prop's front); its flap is folded back over the right-hand side.
def tent():
    R, top_r, h, poles, rings = 1.75, 0.22, 3.0, 12, 7
    around = poles * 2  # a vertex on each pole and one midway, where the hide sags inward
    door = {around - 1, 0, 1}  # gaps (between around-vertices k and k+1) left open, bottom rings only
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = []
    for j in range(rings + 1):
        t = j / rings
        row = []
        for k in range(around):
            ang = -math.pi / 2 + 2 * math.pi * (k + 0.5) / around  # gap 0 centred on -Y
            r = R + (top_r - R) * t
            if k % 2:  # midway between poles
                r *= 1 - 0.07 * math.sin(math.pi * t)
            r *= 1 + 0.06 * max(0, 1 - t * 4)  # hem flares out over the ground
            z = h * t + (random.uniform(-0.03, 0.05) if j == 0 else 0)
            row.append(bm.verts.new((r * math.cos(ang), r * math.sin(ang), z)))
        grid.append(row)
    panels = 4  # u: one leather texture repeat per 3 pole gaps, so a stitched seam every 3 poles
    for j in range(rings):
        for k in range(around):
            if k in door and j < 4:
                continue
            k2 = (k + 1) % around
            f = bm.faces.new((grid[j][k], grid[j][k2], grid[j + 1][k2], grid[j + 1][k]))
            u0, u1 = k / around * panels, (k + 1) / around * panels
            for loop, (uu, vv) in zip(f.loops, ((u0, j / rings), (u1, j / rings), (u1, (j + 1) / rings), (u0, (j + 1) / rings))):
                loop[uv].uv = (uu, vv)
    hide = mesh_obj("part", bm, HIDE, smooth=True)
    solidify(hide, 0.035)

    # Door flap: a hide panel folded back and pinned beside the doorway.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    a0 = -math.pi / 2 + 2 * math.pi * 2.2 / around
    a1 = -math.pi / 2 + 2 * math.pi * 3.6 / around
    flap_grid = []
    for j in range(4):
        t = j / 3 * (4 / rings)
        row = []
        for i, ang in enumerate((a0, a1)):
            r = (R + (top_r - R) * t) * 1.06 + 0.04 * math.sin(math.pi * j / 3)
            row.append(bm.verts.new((r * math.cos(ang), r * math.sin(ang), h * t + 0.05)))
        flap_grid.append(row)
    for j in range(3):
        f = bm.faces.new((flap_grid[j][0], flap_grid[j][1], flap_grid[j + 1][1], flap_grid[j + 1][0]))
        for loop, (uu, vv) in zip(f.loops, ((0.1, j / 6), (0.5, j / 6), (0.5, (j + 1) / 6), (0.1, (j + 1) / 6))):
            loop[uv].uv = (uu, vv)
    flap = mesh_obj("part", bm, HIDE_DARK, smooth=True)
    solidify(flap, 0.03)

    parts = [hide, flap]
    for p in range(poles):
        ang = -math.pi / 2 + 2 * math.pi * p / poles + random.uniform(-0.03, 0.03)
        foot = Vector((R * 1.02 * math.cos(ang), R * 1.02 * math.sin(ang), -0.05))
        tip = Vector((-0.32 * math.cos(ang), -0.32 * math.sin(ang), h + 0.75 + random.uniform(-0.1, 0.15)))
        parts.append(tube(WOOD, foot, tip, 0.04, 0.025, segments=6, rings=2, jitter=0.05, tile=0.4))
    parts.append(tube(ROPE, (0, 0, h - 0.02), (0, 0, h + 0.16), 0.2, 0.17, segments=12, tile=0.3))  # lashing
    # Stones weigh the hem down.
    for k in range(9):
        ang = -math.pi / 2 + 2 * math.pi * (k + 0.5) / 9
        if abs(math.sin(ang) + 1) < 0.2:
            continue  # keep the doorway clear
        parts.append(rock(STONE, (1.85 * math.cos(ang), 1.85 * math.sin(ang), 0.05), (0.16, 0.13, 0.1), subdiv=1))
    return join("Tent", parts)


# Fire pit: a ring of fieldstones round an ash bed, charred logs leaning together over glowing embers.
def fire_pit():
    parts = [disc(ASH, 0.66, 0.02)]
    for k in range(11):
        ang = 2 * math.pi * k / 11 + random.uniform(-0.08, 0.08)
        s = random.uniform(0.85, 1.25)
        parts.append(rock(STONE if k % 3 else STONE_DARK, (0.8 * math.cos(ang), 0.8 * math.sin(ang), 0.07), (0.2 * s, 0.15 * s, 0.13 * s), jitter=0.25))
    for k in range(6):
        ang = 2 * math.pi * k / 6 + random.uniform(-0.15, 0.15)
        parts.append(rock(EMBER, (0.22 * math.cos(ang), 0.22 * math.sin(ang), 0.04), (0.08, 0.07, 0.04), subdiv=1, smooth=False))
    for k in range(5):
        ang = 2 * math.pi * k / 5 + 0.4
        parts.append(tube(CHAR, (0.55 * math.cos(ang), 0.55 * math.sin(ang), 0.03), (0.06 * math.cos(ang), 0.06 * math.sin(ang), 0.5), 0.07, 0.045, segments=8, jitter=0.06, caps=EMBER, tile=0.4))
    return join("FirePit", parts)


# Fallen log: along X, slightly bowed, with snapped branch stubs and cut ends.
def log():
    body = tube(BARK, (-2.4, 0, 0.33), (2.4, 0, 0.29), 0.36, 0.3, segments=14, rings=8, jitter=0.04, caps=CUT, bend=(0, 0.12, 0.04))
    stubs = [
        tube(BARK, (-0.8, 0.2, 0.5), (-0.6, 0.55, 0.95), 0.09, 0.05, segments=7, rings=2, caps=CUT, tile=0.4),
        tube(BARK, (1.1, -0.2, 0.45), (1.4, -0.6, 0.7), 0.08, 0.05, segments=7, rings=2, caps=CUT, tile=0.4),
        tube(BARK, (0.2, 0.25, 0.55), (0.3, 0.45, 0.72), 0.05, 0.03, segments=6, caps=CUT, tile=0.3),
    ]
    return join("Log", [body, *stubs])


# Tree stump: flared base, roots running into the ground, a cut top with a jagged hinge where it broke.
def stump():
    body = tube(BARK, (0, 0, -0.05), (0, 0, 0.55), 0.46, 0.34, segments=14, rings=4, jitter=0.05, caps=CUT)
    top = max(v.co.z for v in body.data.vertices)
    for v in body.data.vertices:  # tear the hinge: raise part of the rim
        if v.co.z > top - 1e-4 and v.co.x > 0.1:
            v.co.z += 0.12 * random.random()
    roots = [
        tube(BARK, (0.32 * math.cos(a), 0.32 * math.sin(a), 0.22), (0.85 * math.cos(a + 0.2), 0.85 * math.sin(a + 0.2), -0.06), 0.13, 0.04, segments=7, rings=3, bend=(0, 0, 0.06), tile=0.4)
        for a in (2 * math.pi * k / 5 + 0.5 for k in range(5))
    ]
    return join("Stump", [body, *roots])


# Old mammoth remains: half-buried rib arches, spine, skull with tusks, a thigh bone: a sign the boss is near.
def bones():
    parts = []
    for i in range(5):
        y = -0.9 + i * 0.45
        for side in (-1, 1):
            pts = [(side * 0.15, y, 1.25 - 0.14 * i)]
            pts += [(side * (0.2 + 0.9 * math.sin(t * math.pi / 2)), y + 0.05 * t, 0.15 + 1.1 * math.cos(t * math.pi / 2) * (1 - 0.12 * i)) for t in (0.35, 0.7, 1)]
            parts += [tube(BONE, a, b, 0.07, 0.06, segments=8) for a, b in zip(pts, pts[1:])]
    parts.append(tube(BONE, (0, -1.2, 1.2), (0, 1.2, 0.7), 0.1, 0.08, segments=10, rings=4, jitter=0.08))  # knobbly spine
    parts.append(rock(BONE, (0.2, -1.9, 0.45), (0.55, 0.5, 0.45), jitter=0.12))
    parts.append(rock(STONE_DARK, (0.2, -2.25, 0.5), (0.12, 0.05, 0.1), subdiv=1))  # eye socket shadow
    parts += [tube(BONE, (side * 0.3, -2.2, 0.35), (side * 0.75, -3.0, 0.95), 0.09, 0.03, segments=10, rings=5, bend=(side * 0.15, -0.15, -0.1)) for side in (-1, 1)]
    parts.append(tube(BONE, (1.4, 0.2, 0.08), (2.3, 0.9, 0.08), 0.08, 0.1, segments=8))
    parts += [rock(BONE, p, (0.13, 0.13, 0.11), subdiv=1) for p in ((1.4, 0.2, 0.08), (2.3, 0.9, 0.08))]  # joint knobs
    return join("Bones", parts)


# Drying rack: two A-frames lashed to a crossbar, a pelt stretched between them on cords.
def drying_rack():
    parts = []
    for x in (-1.1, 1.1):
        parts += [
            tube(WOOD, (x, -0.5, -0.05), (x, 0.05, 1.9), 0.04, 0.03, segments=6, rings=2, jitter=0.05, tile=0.4),
            tube(WOOD, (x, 0.5, -0.05), (x, -0.05, 1.9), 0.04, 0.03, segments=6, rings=2, jitter=0.05, tile=0.4),
            tube(ROPE, (x, 0, 1.68), (x, 0, 1.8), 0.06, 0.06, segments=8, tile=0.3),
        ]
    parts.append(tube(WOOD, (-1.35, 0, 1.75), (1.35, 0, 1.75), 0.04, 0.035, segments=6, rings=3, bend=(0, 0, -0.03), tile=0.4))
    # Pelt: body with four leg flaps and a neck, bulging a little, UVs straight from its outline.
    outline = [(-0.55, 0.55), (-0.3, 0.5), (-0.18, 0.62), (0.18, 0.62), (0.3, 0.5), (0.55, 0.55), (0.75, 0.3), (0.62, 0.1),
               (0.68, -0.25), (0.85, -0.5), (0.5, -0.45), (0.25, -0.58), (-0.25, -0.58), (-0.5, -0.45), (-0.85, -0.5),
               (-0.68, -0.25), (-0.62, 0.1), (-0.75, 0.3)]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    centre = bm.verts.new((0, 0.06, 1.1))
    rim = [bm.verts.new((x, 0.0, 1.1 + z)) for x, z in outline]
    for i in range(len(rim)):
        f = bm.faces.new((centre, rim[i], rim[(i + 1) % len(rim)]))
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x * 0.6 + 0.5, (loop.vert.co.z - 1.1) * 0.6 + 0.4)
    pelt = mesh_obj("part", bm, HIDE, smooth=True)
    solidify(pelt, 0.02)
    parts.append(pelt)
    for x, z in ((-0.55, 0.55), (0.55, 0.55), (-0.85, -0.5), (0.85, -0.5)):  # cords to the frame
        frame = (math.copysign(1.08, x), 0, 1.75 if z > 0 else 0.62)
        parts.append(tube(ROPE, (x, 0, 1.1 + z), frame, 0.012, 0.012, segments=4))
    return join("DryingRack", parts)


# All props sit at the origin (overlapping in the .blend; hide the others to edit one).
made = [make() for make in (tent, fire_pit, log, stump, bones, drying_rack)]
for obj in made:
    bake(obj)

if preview:
    # Contact sheet: props side by side under a sun, rendered with Eevee.
    for i, obj in enumerate(made):
        obj.location.x = (i - 2.5) * 4.2
    bpy.ops.object.light_add(type="SUN", rotation=(0.9, 0.2, 0.6))
    bpy.context.active_object.data.energy = 3.5
    bpy.ops.object.camera_add(location=(0, -16, 6.5), rotation=(math.radians(72), 0, 0))
    scene = bpy.context.scene
    scene.camera = bpy.context.active_object
    scene.camera.data.lens = 24
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.5, 0.55, 0.6)
    scene.render.resolution_x, scene.render.resolution_y = 1600, 700
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(scene.camera)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o)
    for obj in made:
        obj.location.x = 0

bpy.ops.wm.save_as_mainfile(filepath=out)
