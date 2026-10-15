# Asset Register

Mọi asset trong bản build phải có dòng ở đây (spec mục 10.6). Asset không rõ giấy phép thì không được đưa vào `art-source/`.

| Asset | Nguồn | Tác giả | Giấy phép | Ngày tải | Gốc | Chuyển đổi | Sau tối ưu | Dùng ở |
|---|---|---|---|---|---|---|---|---|
| `crt_fox` | [KhronosGroup/glTF-Sample-Assets — Fox](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox) | Model: PixelMannen · Rig & animation: tomkranis · glTF: @AsoboStudio, @scurest | Model CC0-1.0; rig/animation và bản glTF CC-BY-4.0 (**cần ghi công**) | 2026-10-15 | GLB 159 KB, đơn vị cm, texture PNG 1024² | `npm run assets`: Meshopt + KTX2 (ETC1S) | 76 KB | Thú thử nghiệm (thay tạm cho boss) |
| `env_tree_common_1` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `CommonTree_1.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 1304 KB | Môi trường arena thử |
| `env_tree_pine_1` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `Pine_1.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 1228 KB | Môi trường arena thử |
| `env_tree_dead_1` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `DeadTree_1.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 1404 KB | Môi trường arena thử |
| `env_rock_medium_1` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `Rock_Medium_1.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 192 KB | Môi trường arena thử |
| `env_rock_medium_2` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `Rock_Medium_2.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 188 KB | Môi trường arena thử |
| `env_bush_flowers` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `Bush_Common_Flowers.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 220 KB | Môi trường arena thử |
| `env_fern_1` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `Fern_1.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 184 KB | Môi trường arena thử |
| `env_grass_tall` | [Quaternius — Stylized Nature MegaKit (Standard)](https://opengameart.org/content/stylized-nature-megakit), file `Grass_Common_Tall.gltf` | Quaternius | CC0-1.0 | 2026-10-15 | glTF + PNG | `gltf-transform copy` → GLB, rồi `npm run assets` (Meshopt + KTX2, texture ≤ 1024²) | 12 KB | Môi trường arena thử |
| `sfx_thrust`, `sfx_throw` | [OpenGameArt — Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) (`swish-2.wav`, `swish-8.wav`) | artisticdude | CC0-1.0 | 2026-10-15 | WAV | `npm run assets`: AAC mono 96 kbps | 3–4 KB | Tiếng vút khi đâm/ném |
| `sfx_hit_1..3`, `sfx_kill`, `sfx_hurt`, `sfx_stick`, `sfx_pickup` | [Kenney — Impact Sounds](https://kenney.nl/assets/impact-sounds) (`impactPunch_medium_000..002`, `impactPunch_heavy_000/002`, `impactSoft_medium_001/004`) | Kenney | CC0-1.0 | 2026-10-15 | OGG | AAC mono 96 kbps | 3–9 KB | Trúng, giết, người chơi bị cắn, giáo cắm đất, nhặt giáo |
| `amb_forest` | [OpenGameArt — Forest Ambience](https://opengameart.org/node/23888) (`Forest_Ambience.mp3`) | TinyWorlds | CC0-1.0 | 2026-10-15 | MP3 44,7 s | AAC stereo 128 kbps | 710 KB | Nền tiếng rừng lặp |
| `wpn_spear` | Tự làm: `tools/blender/make_spear.py` → `art-source/weapons/wpn_spear.blend` | Dự án WILDBORN | Thuộc dự án | 2026-10-15 | .blend tạo bằng script, 3 vật liệu màu trơn, không texture | Blender → glTF, rồi `npm run assets` | 9 KB | Giáo cầm tay + giáo ném |
| `chr_fp_arms` | [OpenGameArt — fps arms (rigged only)](https://opengameart.org/content/fps-arms-rigged-only) (`FPS ARMS RIG 1.blend`) | para (mesh và texture tạo bằng MakeHuman) | CC0-1.0 | 2026-10-15 | .blend có rig, texture 1024² | `tools/blender/make_fp_arms.py`: tạo dáng tay phải cầm giáo bằng IK, đóng băng thành mesh tĩnh, bỏ tay trái, đưa về khung tọa độ của giáo; rồi `npm run assets` | 151 KB | Tay góc nhìn thứ nhất |
| `crt_mammoth` | Tự làm: `tools/blender/make_mammoth.py` → `art-source/creatures/crt_mammoth.blend` | Dự án WILDBORN | Thuộc dự án | 2026-10-15 | .blend tạo bằng script: low-poly nhiều mặt, xương cứng theo từng bộ phận, 6 clip (Idle, Walk, Run, Attack, Hit, Death), màu trơn | Blender → glTF, rồi `npm run assets` | 84 KB, ~1.300 tam giác | Boss đầu tiên |

## Ghi công bắt buộc (CC-BY)

Khi phát hành bản có dùng asset CC-BY, màn hình credits phải ghi:

- Fox — rigging & animation by tomkranis (CC BY 4.0); glTF conversion by @AsoboStudio and @scurest (CC BY 4.0). Model by PixelMannen (CC0).

Ghi công tự nguyện (CC0, không bắt buộc nhưng nên có): Quaternius, Kenney, artisticdude, TinyWorlds, para / MakeHuman.

## Quy trình

1. Kiểm tra giấy phép theo checklist spec mục 17.3, ghi một dòng vào bảng trên.
2. Đặt file nguồn vào `art-source/<loại>/` theo quy tắc tên (`crt_`, `wpn_`, `env_`, `chr_`).
3. Chạy `npm run assets` → file tối ưu ra `src/assets/` (cùng đường dẫn).
4. Import trong code bằng `import url from './assets/.../x.glb?url'` để Vite gắn hash vào tên file.
