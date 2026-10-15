# Poses the CC0 "fps arms" rig (OpenGameArt) gripping the spear with the right hand, bakes the pose into a
# static mesh and saves it in the spear's local frame, so in game it is parented to the spear viewmodel:
#   blender -b "<Assets>/fps-arms/FPS ARMS RIG 1.blend" --python tools/blender/make_fp_arms.py -- \
#       art-source/characters/chr_fp_arms.blend [preview.png]
# Keep GRIP / REST_* in sync with src/render/viewmodel.ts.
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
out = args[0]
preview = args[1] if len(args) > 1 else None

UNIT = 0.1  # the rig is modelled in decimetres
EYE = Vector((0, 0, 1.19))  # rig camera position (rig units): looks along +Y, up +Z, right +X

# Spear viewmodel rest transform in game camera space (Babylon: x right, y up, z forward, metres).
REST_POS = Vector((0.22, -0.19, 0.45))
PITCH = math.pi / 2 - 0.12  # rotation.x
YAW = -0.06  # rotation.y


def rx(a):  # Babylon (left-handed) rotation about X: +y toward +z
    return Matrix(((1, 0, 0), (0, math.cos(a), -math.sin(a)), (0, math.sin(a), math.cos(a))))


def ry(b):  # Babylon rotation about Y: +z toward +x
    return Matrix(((math.cos(b), 0, math.sin(b)), (0, 1, 0), (-math.sin(b), 0, math.cos(b))))


R = ry(YAW) @ rx(PITCH)  # spear-local -> camera
AXIS = R @ Vector((0, 1, 0))  # spear direction in camera space


def cam_to_rig(p):  # Babylon camera space (m) -> rig space; swapping y/z also swaps handedness
    return EYE + Vector((p.x, p.z, p.y)) / UNIT


def rig_to_spear_local_blender(p):
    """Rig point -> spear-local frame, expressed in Blender axes so glTF export lands it right in Babylon."""
    cam = Vector(((p - EYE).x, (p - EYE).z, (p - EYE).y)) * UNIT
    b = R.transposed() @ (cam - REST_POS)  # Babylon spear-local (y along the shaft)
    return Vector((-b.x, -b.z, b.y))  # Babylon (x,y,z) <- Blender (-X, Z, -Y)


arm = bpy.data.objects["caucasian_male_1"]
body = bpy.data.objects["caucasian_male_1:Body"]
for m in body.data.materials:
    m.blend_method = "OPAQUE"  # skin is opaque; HASHED would export as alpha
    # The rig uses a legacy Diffuse BSDF, which the glTF exporter ignores; rebuild as Principled.
    nodes, links = m.node_tree.nodes, m.node_tree.links
    tex = next(n for n in nodes if n.type == "TEX_IMAGE")
    for n in [n for n in nodes if n.type == "BSDF_DIFFUSE"]:
        nodes.remove(n)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.8
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], next(n for n in nodes if n.type == "OUTPUT_MATERIAL").inputs["Surface"])
pose = arm.pose.bones
inv = arm.matrix_world.inverted()

# Right hand onto the grip: wrist a little behind the grip so the palm closes around the shaft.
grip = cam_to_rig(REST_POS)
wrist = cam_to_rig(REST_POS - AXIS * 0.04 + Vector((0.035, -0.02, -0.02)))
ctrl = pose["hand.R.control"]
# Desired hand-bone frame: Y (wrist -> knuckles) across the shaft toward the body's centre line,
# Z perpendicular to both, so the fingers can curl over the shaft.
across = (grip - wrist).normalized()
side = Vector((-1, 0.3, 0.2)).normalized()
y_axis = (across + side).normalized()
z_axis = (cam_to_rig(REST_POS + AXIS) - grip).normalized().cross(y_axis).normalized()
x_axis = y_axis.cross(z_axis)
hand_world = Matrix.Translation(wrist) @ Matrix((x_axis, y_axis, z_axis)).transposed().to_4x4()
# The IK control bone has its own rest orientation; pose it so the *hand* (its child) ends up as wanted.
bones = arm.data.bones
rel = bones["hand.R.control"].matrix_local.inverted() @ bones["hand.R"].matrix_local
ctrl.matrix = (inv @ hand_world) @ rel.inverted()

# Curl fingers and thumb around the shaft (bone-local X is the hinge axis in this rig).
for name in ("f_index", "f_middle", "f_ring", "f_pinky"):
    for seg in ("01", "02", "03"):
        b = pose.get(f"{name}.{seg}.R")
        if b:
            b.rotation_mode = "XYZ"
            b.rotation_euler.x = math.radians(70)
for seg, angle in (("01", 20), ("02", 35), ("03", 35)):
    b = pose.get(f"thumb.{seg}.R")
    if b:
        b.rotation_mode = "XYZ"
        b.rotation_euler.x = math.radians(angle)

bpy.context.view_layer.update()

if preview:
    # Quick look from the player's eye with the game's default FOV, plus a stand-in shaft.
    cam = bpy.data.objects["Camera"]
    cam.data.sensor_fit = "HORIZONTAL"
    cam.data.angle = math.radians(100)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=19, vertices=8)
    shaft = bpy.context.active_object
    shaft.location = cam_to_rig(REST_POS + AXIS * 0.35)
    shaft.rotation_euler = (cam_to_rig(REST_POS + AXIS) - grip).to_track_quat("Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "SINGLE"
    scene.render.resolution_percentage = 100
    scene.render.resolution_x, scene.render.resolution_y = 960, 540
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(shaft)

# Bake the pose, keep only the right arm, move into the spear-local frame, drop everything else.
with bpy.context.temp_override(object=body, active_object=body):
    bpy.ops.object.modifier_apply(modifier=body.modifiers[0].name)
body.parent = None
mesh = body.data
mw = body.matrix_world.copy()
for v in mesh.vertices:
    v.co = rig_to_spear_local_blender(mw @ v.co)
body.matrix_world = Matrix.Identity(4)
left = {g.index for g in body.vertex_groups if g.name.endswith(".L")}
bm = bmesh.new()
bm.from_mesh(mesh)
deform = bm.verts.layers.deform.active
bmesh.ops.delete(
    bm,
    geom=[v for v in bm.verts if any(g in left and w > 0.5 for g, w in v[deform].items())],
    context="VERTS",
)
bm.to_mesh(mesh)
bm.free()
for o in list(bpy.data.objects):
    if o is not body:
        bpy.data.objects.remove(o)
body.vertex_groups.clear()
body.name = mesh.name = "chr_fp_arms"
bpy.ops.file.pack_all()  # embed the texture so the .blend is self-contained
bpy.ops.wm.save_as_mainfile(filepath=out)
