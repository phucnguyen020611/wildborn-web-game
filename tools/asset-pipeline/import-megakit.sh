#!/bin/sh
# Recreates art-source/environment/ (not in git: 35 MB, all derived) from the Quaternius Stylized
# Nature MegaKit (CC0). Download it from https://opengameart.org/content/stylized-nature-megakit
# and unzip; pass the kit's glTF folder (default: ../../Assets/stylized-nature-megakit/glTF).
# Then run `npm run assets -- environment`.
set -e
KIT="${1:-../../Assets/stylized-nature-megakit/glTF}"
OUT=art-source/environment
mkdir -p "$OUT"
for pair in \
  CommonTree_1:env_tree_common_1 Pine_1:env_tree_pine_1 DeadTree_1:env_tree_dead_1 \
  Rock_Medium_1:env_rock_medium_1 Rock_Medium_2:env_rock_medium_2 \
  Bush_Common_Flowers:env_bush_flowers Fern_1:env_fern_1 Grass_Common_Tall:env_grass_tall; do
  src="${pair%%:*}"
  dst="${pair##*:}"
  node_modules/.bin/gltf-transform copy "$KIT/$src.gltf" "$OUT/$dst.glb" > /dev/null
  echo "$src -> $OUT/$dst.glb"
done
