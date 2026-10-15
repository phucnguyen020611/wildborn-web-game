# Art Guide

Phong cách đã chốt: **stylized / semi-realistic** (spec mục 7.2). Tài liệu này là quy tắc để mọi asset trông như cùng một game.

## Nguồn chính

- **Môi trường:** Quaternius — Stylized Nature MegaKit (CC0). Bản gốc nằm ở `WILDBORN/Assets/stylized-nature-megakit/`, chỉ copy model cần dùng vào `art-source/`.
- Asset từ nguồn khác phải đặt cạnh MegaKit kiểm tra trước: hình khối, độ bão hòa và mật độ chi tiết phải khớp.

## Bảng màu (tạm thời)

| Vai trò | Màu | Dùng ở |
|---|---|---|
| Đất / cỏ nền | `#546638` | Mặt đất (`src/render/scene.ts`) |
| Đá blockout | `#736657` | Khối thử nghiệm |
| Trời / sương | `#8C9E94` | Clear color + fog |
| Ánh sáng phản từ đất | `#596147` | `groundColor` của đèn bán cầu |
| UI — xương (chữ) | `#F2EBDD` | `--text` |
| UI — than hồng (nhấn) | `#D97706` | `--accent`, nút chính |

Sẽ tinh chỉnh khi có ánh sáng, bầu trời và hậu kỳ thật. Hiện cảnh còn hơi xám so với ảnh preview của MegaKit.

## Quy tắc kỹ thuật

- **Đơn vị:** 1 unit = 1 m, trục Y hướng lên, gốc model ở điểm chạm đất, mặt trước hướng **+Z**.
- **Texture:** tối đa 1024² mặc định (pipeline tự giới hạn). KTX2: ETC1S cho màu, UASTC cho normal map.
- **Vật liệu:** PBR, `metallic = 0`, `roughness` cao (~1). Không dùng vật liệu bóng kiểu kim loại cho đồ tự nhiên.
- **Ngân sách gợi ý:** cây ≤ 20k đỉnh, đá ≤ 2k, cỏ/cây bụi ≤ 3k; con số thực tế xem `PERFORMANCE_TESTS.md`.

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
