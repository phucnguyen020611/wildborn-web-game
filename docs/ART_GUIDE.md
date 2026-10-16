# Art Guide

Phong cách đã chốt: **stylized / semi-realistic** (spec mục 7.2). Tài liệu này là quy tắc để mọi asset trông như cùng một game.

## Nguồn chính

- **Môi trường:** Quaternius — Stylized Nature MegaKit (CC0). Bản gốc nằm ở `WILDBORN/Assets/stylized-nature-megakit/`. `npm run import-megakit` gộp các model cần dùng thành **một file kit** (`env_kit_forest`) để chúng dùng chung texture.
- **Đồ vật bộ tộc, ma mút, giáo:** tự dựng bằng script Blender trong `tools/blender/`, màu trơn không texture.
- Asset từ nguồn khác phải đặt cạnh MegaKit kiểm tra trước: hình khối, độ bão hòa và mật độ chi tiết phải khớp.

## Bảng màu

| Vai trò | Màu | Dùng ở |
|---|---|---|
| Trời — đỉnh | `#5F97C4` | Vòm trời (`src/render/sky.ts`) |
| Trời — gần chân trời | `#A9C6D8` | Vòm trời |
| Chân trời / sương | `#C7D6C7` | Vòm trời, clear color, fog (EXP2, mật độ 0,014) |
| Mặt đất — cỏ | `#5C733B` | Địa hình (`src/render/terrain.ts`) |
| Mặt đất — cỏ khô | `#808045` | Mảng cỏ khô (theo noise) |
| Mặt đất — lối mòn | `#735C3D` | Dọc `paths` của map |
| Mặt đất — đá | `#70695E` | Sườn dốc hơn ~40–50° |
| Mặt đất — bùn | `#4D4533` | Sát mép nước |
| Nước | `#386166` (alpha 0,75) | Mặt suối/hồ |
| Nắng | `#FFF0D1` (cường độ 1,25), chếch thấp | Directional light, đổ bóng |
| Ánh trời | `#E0EDFF` (cường độ 0,65) | Hemispheric light |
| Ánh phản từ đất | `#596147` | `groundColor` của hemispheric light |
| UI — xương (chữ) | `#F2EBDD` | `--text` |
| UI — than hồng (nhấn) | `#D97706` | `--accent`, nút chính, thanh tải |

Sương mù cùng màu chân trời, nên cây ở xa nhạt dần vào trời thay vì bị cắt cụt.

## Ánh sáng và bóng

- Một nguồn sáng đổ bóng duy nhất (mặt trời), shadow map 2048, lọc PCF. Mức chất lượng Thấp tắt bóng.
- Chỉ **thú** và **tảng đá** đổ bóng (`castsShadow` trong `src/config/props.ts`). Cây và cỏ không đổ bóng, vì mỗi vật đổ bóng phải vẽ lại thêm một lần vào shadow map.

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
- **Tay** (`make_fp_arms.py`): được đặt sẵn trong khung tọa độ của giáo, nên trong game chỉ cần gắn làm con của giáo. Nếu đổi `REST` trong `src/render/viewmodel.ts` thì phải đổi `REST_POS` trong script và chạy lại.
- **Ma mút** (`make_mammoth.py`): mặt trước hướng −Y trong Blender (+Z trong glTF), gốc tọa độ giữa 4 chân. Mỗi bộ phận gắn cứng vào một xương (không skin mềm). Thời gian báo đòn trong clip `Attack` (0,7 s) phải khớp `attackWindup` trong `src/config/creatures.ts`.

## Bộ kit môi trường

- **Một file kit = một lần tải, texture dùng chung.** Trước đây mỗi model là một file riêng, nên texture lá (2048²) bị chép trong 4 file, vỏ cây trong 3 file. Kit `env_kit_forest` gom 37 model chỉ còn 3,3 MB, trong khi 15 file rời trước đây là 7 MB.
- Mỗi model là một node đặt theo tên file gốc (ví dụ `Pine_3`). `src/config/props.ts` nối id trong game (`tree_pine`) với danh sách node làm biến thể.
- **Normal map vỏ cây giới hạn 512²** (`build.mjs`, chỉ áp dụng cho thư mục `environment`). Đây là phần nặng nhất của kit, và từ tầm mắt người chơi không thấy khác biệt.
- **Khoảng cách vẽ:** cây cỏ nhỏ ẩn sau 45 m, cây to sau 110 m (`drawDistance`), lúc đó sương đã che gần hết.
- Kit đồ trại `env_kit_camp` (lều, đống lửa, khúc gỗ, gốc cây, xương ma mút, giá phơi da) do `tools/blender/make_camp.py` tạo, nặng 31 KB.

## Địa hình

- Map có thể có **heightmap** (`src/sim/terrain.ts`): lưới độ cao 1 m, dùng chung cho mô phỏng (người chơi, thú, giáo ném bám theo dốc) và mesh hiển thị.
- Màu đất tô theo đỉnh (vertex color): cỏ, cỏ khô theo noise, đất dọc lối mòn, đá ở sườn dốc, bùn sát nước. Thêm một texture lốm đốm lặp lại mỗi 4 m để mặt đất không trông như nhựa.
- Vật thể đặt trên dốc lấy **điểm thấp nhất dưới chân** (`seat` trong `src/maps/scatter.ts`) để không bị hở chân.

## Kiểm kê asset (2026-10-16)

| Asset | Tình trạng | Quyết định |
|---|---|---|
| Cây, đá, cỏ, hoa, sỏi (MegaKit) | Đúng phong cách. Texture từng bị lặp giữa các file | **Giữ.** Đã gộp thành kit dùng chung texture, thêm biến thể: 5 cây thường, 5 thông, 3 cây chết, 2 loại cỏ, đá lối mòn |
| Nấm Laetiporus (MegaKit) | Loại nấm mọc trên thân cây, đặt dưới đất trông lạ | **Bỏ** khỏi kit |
| Cây xoắn, bụi cây thường (MegaKit) | Texture lá `_C` là mask màu đỏ | **Chưa dùng.** Cần đổi texture khi làm vùng 2 (Rừng Xoắn) |
| Ma mút (`make_mammoth.py`) | Khối cạnh sắc, thô so với MegaKit | **Đã làm mịn:** bề mặt bo tròn, lông xù dưới bụng, chân và ngà nhiều cạnh hơn. 5,9k đỉnh, 112 KB. Có thể thay bằng model mua (`BOSS_CANDIDATES.md`) khi có ngân sách |
| Cáo (mẫu Khronos) | Texture kiểu thực tế, hơi lệch phong cách, giấy phép CC-BY | **Giữ tạm.** Thay bằng thú nhỏ tự dựng (hươu) khi làm bầy thú vùng 1 |
| Giáo, tay | Ổn ở góc nhìn thứ nhất | **Giữ** |
| Mặt đất | Màu trơn, phẳng | **Thay** bằng địa hình heightmap tô màu (xem trên) |
| Đồ trại | Chưa có | **Mới:** kit `env_kit_camp` |
| Âm thanh | Thiếu tiếng gầm báo đòn, bước chân, nước chảy | **Cần tìm** nguồn CC0 (hỏi người dùng trước khi tải) |
