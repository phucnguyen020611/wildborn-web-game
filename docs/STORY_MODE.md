# Story Mode — The Great Hunt (khung 1 trang)

> **Trạng thái:** bản nháp 2026-10-16, chờ người dùng duyệt. Mọi tên gọi đều là tên làm việc.
> Mục đích của trang này là chốt **vùng, boss và nhịp chơi** để biết cần làm asset gì. Cốt truyện chi tiết, lời thoại và cân bằng số liệu làm sau.

## Tiền đề

Người chơi là một thợ săn trẻ của **bộ tộc Đá Xám**. Mùa đông năm nay đến sớm, đàn thú bỏ thung lũng. Theo tục lệ, bộ tộc chọn một người đi **Cuộc Đại Săn**: men theo dòng sông lên núi, hạ những con thú lớn đang chiếm đường di cư, và mang chiến lợi phẩm về để cả bộ tộc qua mùa đông.

- Mỗi boss là một "chặng" của chuyến đi. Hạ boss thì mở đường sang vùng tiếp theo.
- Kể chuyện tối giản: tranh vẽ hang động giữa các chặng, lời của già làng ở trại (ngôn ngữ bộ tộc hư cấu, phụ đề `vi`/`en`, spec mục 2.4).

## Ba vùng cho bản Story Mode đầu tiên

| # | Vùng | Không khí | Thú nhỏ | Boss | Cơ chế mới boss dạy người chơi | Vũ khí mở sau boss |
|---|---|---|---|---|---|---|
| 1 | **Thung lũng Thông** | Rừng thông và đồng cỏ, suối cạn, trại bộ tộc. Nắng sáng | Cáo, hươu (chạy trốn) | **Ma mút** | Đọc báo đòn của con thú to và chậm; đi vòng sau lưng; ném giáo rồi nhặt lại | Cung tên |
| 2 | **Rừng Xoắn** | Rừng cây xoắn và cây chết, đầm lầy, sương dày. Chiều tà | Sói (đi theo bầy, đánh lại) | **Hổ răng kiếm** | Thú nhanh, vồ từ xa. Né ngang đúng lúc; dùng cung khi nó lùi lại rình | Rìu đá |
| 3 | **Đèo Tuyết** | Vách đá, tuyết, gió. Ánh sáng lạnh | Dê núi (chạy trốn trên dốc) | **Tê giác lông mượt** | Lao thẳng rất mạnh. Dụ nó đâm vào đá/cây để choáng, rồi đánh điểm yếu | Bẫy (phục vụ chơi lại) |

Thứ tự này đi từ dễ đọc đến khó đọc, và mỗi boss đòi một kỹ năng khác nhau. Bản prototype hiện tại đã có Ma mút (vùng 1).

## Vòng chơi trong một vùng (~15–25 phút)

1. **Trại (checkpoint):** đến trại tạm ven sông. Lưu tiến trình, hồi máu, đổi trang bị.
2. **Khám phá và săn thú nhỏ:** đi theo dấu chân và lối mòn. Thú nhỏ cho **da, xương, gân** dùng để nâng cấp.
3. **Lần dấu boss:** dấu vết lớn dần (cây đổ, xương, dấu chân to) dẫn tới bãi đấu boss.
4. **Bãi đấu boss:** khu đất được thiết kế riêng, có chỗ nấp và địa hình phục vụ cơ chế của boss.
5. **Về trại:** nâng cấp và nhận vũ khí mới. Tranh vẽ hang động kể tiếp chặng sau rồi chuyển vùng.

**Nâng cấp (giữ đơn giản):** mỗi vũ khí có 2 bậc nâng (ví dụ mũi giáo đá → mũi giáo xương: sát thương + tầm ném), trả bằng da/xương/gân. Không có cây kỹ năng, không có hệ thống chế đồ phức tạp.

## Quy mô kỹ thuật mỗi vùng

- **Một vùng = một gói tải riêng** (spec mục 11.1). Mục tiêu ≤ 10–15 MB mỗi vùng, dùng chung asset giữa các vùng nếu được.
- **Kích thước map:** khoảng 160 × 160 m, có địa hình đồi dốc (heightmap). Sương mù che rìa map, núi và vách bao quanh làm ranh giới tự nhiên.
- **Bố cục chung:** trại ở một đầu → vùng săn ở giữa → bãi đấu boss ở đầu kia. Có lối mòn chính và vài đường vòng.

## Danh sách asset từ khung này

Ký hiệu: **Có** = đã có trong game · **Kho** = có sẵn trong MegaKit, chỉ cần import · **Blender** = tự dựng · **Tìm** = cần tìm nguồn miễn phí hoặc tự dựng.

| Nhóm | Vùng 1 — Thung lũng Thông | Vùng 2 — Rừng Xoắn | Vùng 3 — Đèo Tuyết |
|---|---|---|---|
| Địa hình | Heightmap, trộn màu cỏ/đất/đá, nước suối (**code**) | + bùn, nước đầm (**code**) | + tuyết (**code**) |
| Cây | Thông, cây thường (**Có**, thêm biến thể từ **Kho**) | Cây xoắn, cây chết (**Kho**) | Thông phủ tuyết (**Blender**: đổi màu) |
| Đá | Đá vừa (**Có**), vách đá lớn (**Blender**), đá lối mòn (**Kho**) | Như vùng 1 | Như vùng 1, màu lạnh hơn |
| Cây cỏ nhỏ | Cỏ, hoa, dương xỉ, nấm, sỏi (**Có/Kho**) | Cây bụi, nấm, cây thủy sinh (**Kho**) | Rất ít |
| Đồ vật | Lều, đống lửa, xương thú, khúc gỗ đổ, giá phơi da (**Blender**) | Dùng lại vùng 1 | Dùng lại vùng 1 |
| Thú nhỏ | Cáo (**Có**), hươu (**Blender**) | Sói (**Blender**) | Dê núi (**Blender**) |
| Boss | Ma mút (**Có**) | Hổ răng kiếm (**Blender** hoặc mua) | Tê giác lông mượt (**Blender** hoặc mua) |
| Âm thanh | Tiếng gầm báo đòn, bước chân, nước chảy (**Tìm**, CC0) | Tiếng sói, gió (**Tìm**) | Gió tuyết (**Tìm**) |

**Tiến độ (2026-10-16):**

- Đã có: kiểm kê asset (`ART_GUIDE.md`), địa hình heightmap + nước + rải prop theo luật, kit đồ trại, map vùng 1 `src/maps/pineValley.ts` (trại → suối → đồng cỏ → bãi đấu ma mút).
- Còn thiếu cho vùng 1: hươu, vách đá lớn, âm thanh (gầm báo đòn, bước chân, nước chảy), checkpoint/lưu tiến trình, dẫn đường (dấu chân).

## Câu hỏi mở (không chặn việc làm vùng 1)

- Tên bộ tộc, tên nhân vật, kết truyện.
- Có chết vĩnh viễn hay chỉ quay về checkpoint? *(đề xuất: quay về trại gần nhất, giữ đồ đã săn)*
- Ban ngày/ban đêm có ảnh hưởng gameplay không? *(đề xuất: mỗi vùng một giờ cố định trong ngày, chưa làm chu kỳ ngày đêm)*
