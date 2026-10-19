# Art Guide

Phong cách đã chốt: **stylized / semi-realistic** (spec mục 7.2). Tài liệu này là quy tắc để mọi asset trông như cùng một game.

## Nguồn chính

- **Môi trường:** Quaternius — Stylized Nature MegaKit (CC0). Bản gốc nằm ở `WILDBORN/Assets/stylized-nature-megakit/`. `npm run import-megakit` gộp các model cần dùng thành **một file kit** (`env_kit_forest`) để chúng dùng chung texture.
- **Đồ vật bộ tộc, ma mút, giáo:** tự dựng bằng script Blender trong `tools/blender/`, màu trơn không texture.
- Asset từ nguồn khác phải đặt cạnh MegaKit kiểm tra trước: hình khối, độ bão hòa và mật độ chi tiết phải khớp.

## Bảng màu

| Vai trò | Màu | Dùng ở |
|---|---|---|
| Trời | Tính theo vị trí mặt trời (`SkyMaterial`) | `src/render/sky.ts` |
| Chân trời / sương | Theo giờ, 10 giờ sáng ≈ `#C2D4DB` | Clear color, fog (EXP2, mật độ 0,014), `src/render/daylight.ts` |
| Mặt đất | Texture ảnh (xem mục Địa hình) | `src/render/terrain.ts` |
| Thảm cỏ — gốc → ngọn | `#213812` → `#8C9E4D` | `src/render/grass.ts` |
| Nước | `#0D2421` (alpha 0,85) + phản chiếu | `src/render/water.ts` |
| Nắng | Theo giờ, ban ngày `#FFF0D1` (cường độ 1,25) | Directional light, đổ bóng |
| Ánh trời | Theo giờ, ban ngày `#E0EDFF` (cường độ 0,65) | Hemispheric light |
| Ánh phản từ đất | `#596147` | `groundColor` của hemispheric light |
| UI — xương (chữ) | `#F2EBDD` | `--text` |
| UI — than hồng (nhấn) | `#D97706` | `--accent`, nút chính, thanh tải |

Sương mù cùng màu chân trời, nên cây ở xa nhạt dần vào trời thay vì bị cắt cụt.

## Ánh sáng và bóng

- **Giờ trong ngày** (`src/render/daylight.ts`): từ giờ (0–24) suy ra hướng mặt trời, màu và cường độ nắng, ánh trời, màu sương. Giá trị nội suy giữa các mốc theo độ cao mặt trời: đêm trăng, chạng vạng, hoàng hôn, giờ vàng, ban ngày, trưa. Ban đêm, mặt trăng (đối diện mặt trời) là nguồn đổ bóng. Map đặt giờ bằng `time`; `?time=` để xem thử.
- **Bầu trời:** `SkyMaterial` (tán xạ Preetham) theo vị trí mặt trời. Bầu trời được vẽ một lần vào cube map 128px, dùng làm ánh sáng môi trường cho vật liệu PBR và phản chiếu nước ở mức Thấp.
- **Bóng:** một nguồn sáng đổ bóng duy nhất, chia tầng (cascaded): Vừa 2 tầng, Cao 3 tầng, Thấp tắt; shadow map 2048, PCF, xa nhất 90 m. Cây, đá, thú và đồ trại đổ bóng; cỏ và hoa thì không.

## Quy tắc kỹ thuật

- **Đơn vị:** 1 unit = 1 m, trục Y hướng lên, gốc model ở điểm chạm đất, mặt trước hướng **+Z**.
- **Texture:** tối đa 1024² mặc định (pipeline tự giới hạn). KTX2: ETC1S cho màu, UASTC cho normal map.
- **Vật liệu:** PBR, `metallic = 0`, `roughness` cao (~1). Không dùng vật liệu bóng kiểu kim loại cho đồ tự nhiên.
- **Ngân sách gợi ý:** cây ≤ 20k đỉnh, đá ≤ 2k, cỏ/cây bụi ≤ 3k; con số thực tế xem `PERFORMANCE_TESTS.md`.
- **Kích thước cây cỏ MegaKit:** một số model to quá cỡ (cụm hoa cao 2–2,4 m, cỏ cao 1,8 m), nên đặt `scale` gốc trong `src/config/props.ts`.
- **Vùng va chạm của đá:** model đá MegaKit lệch tâm so với gốc tọa độ (tới 0,85 m), nên `collider` có `cx`/`cz` đo từ bounding box; độ lệch tự xoay theo góc của tảng đá.

## Lưu ý riêng với Quaternius MegaKit

- **Vertex color** chứa mask gió/AO cho shader riêng của tác giả. Game tắt vertex color khi load (`src/render/props.ts`), nếu không cây cỏ bị nhuộm đỏ/đen.
- **Texture đuôi `_C`** là mask màu cho shader của tác giả, không phải màu thật. Ví dụ `Leaves_TwistedTree_C.png` màu đỏ, nên `Bush_Common` và `TwistedTree_*` hiện ra đỏ rực. Mở texture xem trước khi chọn model.
- **Lá cây hai mặt** cần bật two-sided lighting (đã làm trong code), cùng với `groundColor` của đèn bán cầu khác đen, để mặt dưới lá không bị đen.
- **Bark normal map** 2048² gốc rất nặng (3,6 MB/cây sau KTX2). Ở 1024² còn khoảng 0,9 MB. Các biến thể cây dùng chung texture nhưng mỗi file `.glb` đang chứa một bản riêng.

## Asset tạo bằng Blender

- Script trong `tools/blender/` sinh file `.blend` vào `art-source/`. Mở file `.blend` trong Blender để chỉnh tay; chỉ chạy lại script khi muốn làm lại từ đầu, vì chạy lại sẽ ghi đè các chỉnh sửa tay.
- **Giáo** (`make_spear.py`): gốc tọa độ ở chỗ cầm, giáo nằm dọc trục +Z của Blender (tức +Y của glTF), mũi ở Z = 1,3.
- **Tay** (`make_fp_arms.py`): được đặt sẵn trong khung tọa độ của giáo, nên trong game chỉ cần gắn làm con của giáo. Mesh gốc bị cắt ở cánh tay trên. Script kéo dài chỗ cắt về điểm `SHOULDER` nằm sau camera rồi bịt kín, nên khi đâm (tay lao lên 0,3 m) không lộ phần hở. Nếu đổi `REST` trong `src/render/viewmodel.ts` thì phải đổi `REST_POS` trong script và chạy lại.
- **Ma mút** (`make_mammoth.py`): mặt trước hướng −Y trong Blender (+Z trong glTF), gốc tọa độ giữa 4 chân. Dáng theo phục dựng bảo tàng (mô hình Royal BC Museum, sơ đồ xương, tranh của Mauricio Antón): đầu vòm cao nhất, gáy trũng, bướu vai, lưng dốc xuống mông thấp, chân trước dài hơn, tai nhỏ, vòi gần chạm đất, ngà chĩa xuống rồi cong ra ngoài, vòng lên và chụm vào. Da liền một khối (metaball), có thêm khoảng 1.700 dải lông rủ (dài nhất ở sườn và bụng). Màu tô theo đỉnh: lưng nâu đỏ, bụng và chân tối hơn. Skin mềm theo khoảng cách tới từng xương. Khoảng 21k đỉnh, 294 KB. Thời gian báo đòn trong clip `Attack` (0,7 s) phải khớp `attackWindup` trong `src/config/creatures.ts`.

## Bộ kit môi trường

- **Một file kit = một lần tải, texture dùng chung.** Trước đây mỗi model là một file riêng, nên texture lá (2048²) bị chép trong 4 file, vỏ cây trong 3 file. Kit `env_kit_forest` gom 37 model chỉ còn 3,3 MB, trong khi 15 file rời trước đây là 7 MB.
- Mỗi model là một node đặt theo tên file gốc (ví dụ `Pine_3`). `src/config/props.ts` nối id trong game (`tree_pine`) với danh sách node làm biến thể.
- **Normal map vỏ cây giới hạn 512²** (`build.mjs`, chỉ áp dụng cho thư mục `environment`). Đây là phần nặng nhất của kit, và từ tầm mắt người chơi không thấy khác biệt.
- **Khoảng cách vẽ:** cây cỏ nhỏ ẩn sau 45 m, cây to sau 110 m (`drawDistance`), lúc đó sương đã che gần hết.
- Kit đồ trại `env_kit_camp` (lều, đống lửa, khúc gỗ, gốc cây, xương ma mút, giá phơi da) do `tools/blender/make_camp.py` tạo, nặng 146 KB. Gỗ dùng texture vỏ cây MegaKit (512², nhân màu theo vật liệu). Da dùng texture da thuộc 256² vẽ bằng code: có vết khâu, bùn ở mép dưới và muội khói ở đỉnh lều. Than hồng phát sáng (emissive). Không dùng normal map vỏ cây: tốn thêm khoảng 250 KB mà ở kích thước đồ trại gần như không thấy.
- **Thú** (Quaternius Ultimate Animated Animal Pack, CC0): hươu, hươu đực, sói, cáo dùng chung một rig và bộ clip. File GLB gốc xuất từ FBX2glTF nên skin không qua được bước kiểm tra, và mỗi clip bị lặp 2 lần. `tools/blender/import_animal.py` nhập vào Blender, chỉ giữ 6 clip game dùng rồi lưu `.blend`; `blender_export.py` chỉ xuất xương biến dạng. Nhờ vậy mỗi con khoảng 260 KB, so với 450 KB nếu giữ đủ clip.

## Địa hình

- **Texture mặt đất** (Poly Haven, CC0): cỏ `grass_ground`, đất rừng `forest_ground_04` (lối mòn, bùn ven nước), đá `rocky_terrain_02` (sườn dốc). `TerrainMaterial` trộn 3 lớp theo bản đồ trộn 512² sinh từ độ dốc, lối mòn và mép nước (`groundWeights` trong `src/render/terrain.ts`). Mỗi texture lặp 7 m; lặp nhỏ hơn thì ảnh chụp trông lấm tấm. Màu ETC1S 1024²; normal map UASTC 512², **không** dùng `--normal-mode`: cờ này dời Y sang kênh alpha (RGB = X), vật liệu Babylon đọc sai nên mặt đất bị loang lổ sáng tối.
- **Thảm cỏ GPU** (`src/render/grass.ts`): bụi 5 ngọn cong, đậm ở gốc, sáng ở ngọn; tối đa 4 bụi/m², mật độ theo lớp cỏ của bản đồ trộn nhân với noise để thành từng mảng. Thin instance theo ô 16 m; ô chỉ được dựng và hiện khi trong tầm vẽ. Mỗi ô có geometry riêng, vì các clone dùng chung geometry bị WebGL báo lỗi "vertex buffer is not big enough" và không vẽ.
- **Gió** (`src/render/wind.ts`): plugin vật liệu đẩy đỉnh theo bình phương độ cao trong model (cây cong từ gốc, cỏ lay từ chân). Cường độ theo vật liệu: cây ~0,002, cây chết ~0,001, cỏ/hoa/lá nhỏ 0,05, thảm cỏ 0,3. Bóng đổ không lay theo (shader shadow riêng), với biên độ nhỏ thì không nhận ra.
- **Nước** (`src/render/water.ts`): mesh lưới 0,5 m, chỉ phủ chỗ đất thấp hơn mặt nước. Màu và độ trong theo độ sâu (`waterTint`): mép bờ có vệt bọt nhạt, chỗ cạn trong và ánh màu đáy, chỗ sâu tối. Normal map gợn sóng sinh bằng code (tổng sóng sin, liền mạch), trôi theo dòng. Phản chiếu theo góc nhìn (fresnel), nhìn thẳng xuống thì thấy trong. Vừa/Cao phản chiếu phẳng (mirror 512²) bầu trời, mặt đất, cây, đá; Thấp chỉ phản chiếu bầu trời.
- Map có thể có **heightmap** (`src/sim/terrain.ts`): lưới độ cao 1 m, dùng chung cho mô phỏng (người chơi, thú, giáo ném bám theo dốc) và mesh hiển thị.
- Màu đất tô theo đỉnh (vertex color): cỏ, cỏ khô theo noise, đất dọc lối mòn, đá ở sườn dốc, bùn sát nước. Thêm một texture lốm đốm lặp lại mỗi 4 m để mặt đất không trông như nhựa.
- Vật thể đặt trên dốc lấy **điểm thấp nhất dưới chân** (`seat` trong `src/maps/scatter.ts`) để không bị hở chân.

## Hiệu ứng trúng đòn

- **Vết đâm** (`src/render/effects.ts`): khi mũi giáo chạm đất hoặc vật cản mà không trúng thú, mô phỏng phát sự kiện `strike`. Vết được đặt theo tia nhìn của người chơi (vật cản trong mô phỏng chỉ là hộp, thân cây thật có thể lệch so với hộp). Mỗi bề mặt một kiểu vết, nhận biết qua tên vật liệu: đá bị mẻ kèm vết rạn và văng vụn; gỗ nứt dọc thớ, lộ gỗ tươi và văng dăm; đất thủng lỗ, đất văng quanh; da rách; xương mẻ. Tối đa 60 vết, vết cũ nhất bị dùng lại.
- **Máu**: tia máu vệt dài (particle kéo giãn theo hướng bay) phun ra phía sau con thú và dội về phía người đâm, thêm một làn sương đỏ. Vết máu loang có giọt bắn xung quanh, rơi trên đất theo hướng đâm. Vết thương trên thân thú có lỗ đen ở giữa, viền đỏ ướt và dòng máu chảy xuống dưới. Thú bị thương để lại vệt máu nhỏ giọt sau mỗi khoảng 0,9 m, giúp lần theo dấu.

## Kiểm kê asset (2026-10-16)

| Asset | Tình trạng | Quyết định |
|---|---|---|
| Cây, đá, cỏ, hoa, sỏi (MegaKit) | Đúng phong cách. Texture từng bị lặp giữa các file | **Giữ.** Đã gộp thành kit dùng chung texture, thêm biến thể: 5 cây thường, 5 thông, 3 cây chết, 2 loại cỏ, đá lối mòn |
| Nấm Laetiporus (MegaKit) | Loại nấm mọc trên thân cây, đặt dưới đất trông lạ | **Bỏ** khỏi kit |
| Cây xoắn, bụi cây thường (MegaKit) | Texture lá `_C` là mask màu đỏ | **Chưa dùng.** Cần đổi texture khi làm vùng 2 (Rừng Xoắn) |
| Ma mút (`make_mammoth.py`) | Khối cạnh sắc, thô so với MegaKit | **Dựng lại 2026-10-19** theo ảnh phục dựng thật: da liền khối, lông rủ, ngà cong lớn. 21k đỉnh, 294 KB. Có thể thay bằng model mua (`BOSS_CANDIDATES.md`) khi có ngân sách |
| Cáo (mẫu Khronos) | Texture kiểu thực tế, hơi lệch phong cách, giấy phép CC-BY | **Đã thay** (2026-10-19) bằng bộ thú Quaternius: cáo, hươu, hươu đực, sói, cùng phong cách MegaKit, không còn asset CC-BY |
| Giáo, tay | Ổn ở góc nhìn thứ nhất | **Giữ** |
| Mặt đất | Màu trơn, phẳng | **Thay** bằng địa hình heightmap tô màu (xem trên) |
| Đồ trại | Chưa có | **Mới:** kit `env_kit_camp`. Dựng lại 2026-10-19: texture vỏ cây và da, bo cạnh, thêm chi tiết |
| Âm thanh | Thiếu tiếng gầm báo đòn, bước chân, nước chảy | **Cần tìm** nguồn CC0 (hỏi người dùng trước khi tải) |
