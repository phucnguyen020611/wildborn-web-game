# Turns a Quaternius "Ultimate Animated Animal Pack" GLB (CC0) into an editable .blend source:
#   blender -b --factory-startup --python tools/blender/import_animal.py -- <Animal.glb> art-source/creatures/crt_<name>.blend
# The pack's GLBs come from FBX2glTF: their skin fails glTF validation and every clip is there twice
# ("Walk" and "AnimalArmature|Walk"). Blender's importer reads them fine; re-exporting gives a valid file.
import sys

import bpy

src, out = sys.argv[sys.argv.index("--") + 1 :]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

# Only the clips src/config/creatures.ts plays: every clip costs ~20 KB of glTF JSON.
KEEP = {"Idle", "Walk", "Gallop", "Attack", "Attack_Headbutt", "Idle_HitReact_Left", "Death"}
for action in list(bpy.data.actions):
    if action.name not in KEEP:  # also drops the duplicate "AnimalArmature|..." copies
        bpy.data.actions.remove(action)
for obj in bpy.data.objects:  # the importer leaves one clip assigned; start from the rest pose
    if obj.animation_data:
        obj.animation_data.action = None
        for track in list(obj.animation_data.nla_tracks):
            obj.animation_data.nla_tracks.remove(track)
for action in bpy.data.actions:
    action.use_fake_user = True  # keep unassigned clips when saving
print("clips:", sorted(a.name for a in bpy.data.actions))
bpy.ops.wm.save_as_mainfile(filepath=out)
