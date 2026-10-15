# Run by build.mjs inside headless Blender:
#   blender -b [file.blend] --python blender_export.py -- <source> <out.glb>
# A .blend is opened by Blender itself (passed before --python); an .fbx is imported into an empty scene.
import sys

import bpy

src, out = sys.argv[sys.argv.index("--") + 1 :]

if src.lower().endswith(".fbx"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,  # bake modifiers (bevel, subdivision...) into the mesh
    export_animations=True,
    export_yup=True,  # Blender is Z-up; glTF is Y-up
)
