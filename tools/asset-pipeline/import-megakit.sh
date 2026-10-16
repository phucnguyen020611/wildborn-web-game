#!/bin/sh
# Recreates art-source/environment/env_kit_forest.glb (not in git: derived) from the Quaternius Stylized
# Nature MegaKit (CC0). Download it from https://opengameart.org/content/stylized-nature-megakit
# and unzip; pass the kit's glTF folder (default: ../../Assets/stylized-nature-megakit/glTF).
# All models go into one file so they share textures (bark, leaves, rocks); each stays a node named
# after its source file, which src/config/props.ts refers to. Then run `npm run assets -- environment`.
set -e
KIT="${1:-../../Assets/stylized-nature-megakit/glTF}"
OUT=art-source/environment
mkdir -p "$OUT"
MODELS="
CommonTree_1 CommonTree_2 CommonTree_3 CommonTree_4 CommonTree_5
Pine_1 Pine_2 Pine_3 Pine_4 Pine_5
DeadTree_1 DeadTree_2 DeadTree_3
Rock_Medium_1 Rock_Medium_2 Rock_Medium_3
Bush_Common_Flowers Fern_1 Plant_1 Plant_7
Grass_Common_Short Grass_Common_Tall Grass_Wispy_Short Grass_Wispy_Tall
Flower_3_Group Flower_4_Group Clover_1 Clover_2
Mushroom_Common
Pebble_Round_1 Pebble_Round_2 Pebble_Round_3 Pebble_Round_4 Pebble_Round_5
RockPath_Round_Small_1 RockPath_Round_Small_2 RockPath_Round_Small_3
"
set --
for m in $MODELS; do set -- "$@" "$KIT/$m.gltf"; done
node_modules/.bin/gltf-transform merge "$@" "$OUT/env_kit_forest.glb" --merge-scenes > /dev/null
echo "$# models -> $OUT/env_kit_forest.glb"
