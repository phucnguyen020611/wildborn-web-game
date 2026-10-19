# Story Mode — The Great Hunt

> **Trạng thái:** bản 2026-10-19, viết lại theo góp ý chơi thử. Tên gọi đều là tên làm việc.
> Trang này chốt **cấu trúc act, vòng chơi, đồ vật và thứ tự làm**. Lời thoại và cân bằng số liệu làm sau.

## Tiền đề

Người chơi là một thợ săn trẻ của **bộ tộc Đá Xám**. Mùa đông năm nay đến sớm, đàn thú bỏ thung lũng. Theo tục lệ, bộ tộc chọn một người đi **Cuộc Đại Săn**: men theo dòng sông lên núi, hạ những con thú lớn đang chiếm đường di cư, và mang chiến lợi phẩm về để cả bộ tộc qua mùa đông.

Kể chuyện tối giản: tranh vẽ hang động giữa các act, lời già làng ở trại (ngôn ngữ hư cấu, phụ đề `vi`/`en`).

## Act = một vùng = một boss chính

| Act | Vùng | Không khí | Thú nhỏ | Boss phụ (rơi đồ) | Boss chính | Cơ chế boss dạy |
|---|---|---|---|---|---|---|
| 1 | **Thung lũng Thông** | Rừng thông, đồng cỏ, suối. Nắng sáng | Cáo, hươu, hươu đực, sói | **Sói đầu đàn** → nanh sói | **Ma mút** | Đọc báo đòn của thú to và chậm; vòng ra sau; ném rồi nhặt giáo |
| 2 | **Rừng Xoắn** | Cây xoắn, cây chết, đầm lầy, sương dày. Chiều tà | Sói, lợn rừng | **Gấu hang** → mỡ gấu | **Hổ răng kiếm** | Thú nhanh, vồ từ xa: né ngang đúng lúc |
| 3 | **Đèo Tuyết** | Vách đá, tuyết, gió. Ánh sáng lạnh | Dê núi | **Bò rừng (auroch)** → sừng | **Tê giác lông mượt** | Lao thẳng: dụ nó đâm vào đá để choáng |

- **Chọn act khi vào game:** màn "Chọn chặng" hiện cả 3 act. Act 1 mở sẵn; hạ boss chính của một act thì mở act sau. Act đã qua có thể chơi lại.
- Tiến trình (act đã qua) lưu trên trình duyệt.

## Map: rộng, đi tự do, đích vẫn là boss (học từ Black Myth: Wukong)

- **Bố cục hình phễu:** trại ở một đầu, bãi boss ở đầu kia. Ở giữa là vùng mở có **nhiều đường đi** (lối mòn chính, đường vòng qua rừng, đường men suối), đi hướng nào cũng dồn về cửa bãi boss.
- **Dẫn đường bằng cảnh, không bằng mũi tên:** lối mòn sáng màu, khói lửa trại, cây đổ và xương thú lớn dần khi gần boss, dấu chân to, vách núi chắn hướng sai.
- **Điểm phụ ngoài đường chính:** hang boss phụ, bãi thảo dược, xác thú. Đi lệch đường thì được thưởng đồ.
- **Kích thước:** act 1 hiện là 160 × 160 m. Mục tiêu 400–500 m mỗi cạnh, cần **chia ô và tải dần** (địa hình, prop, cỏ theo ô quanh người chơi). Đây là phần kỹ thuật lớn nhất, làm ở giai đoạn D2.

## Vòng chơi trong một act (~20–30 phút)

1. **Trại:** điểm xuất phát và checkpoint. Gục ngã thì quay về trại, giữ đồ đã nhặt *(D2)*.
2. **Săn và hái lượm:** hái thảo dược; hạ thú nhỏ rồi lột lấy **da, xương**.
3. **Boss phụ:** canh một khu riêng, mạnh hơn thú thường, rơi **vật phẩm hiếm** để chế đồ mạnh.
4. **Chế đồ** (mở túi đồ bất cứ lúc nào, game tạm dừng):
   - **Thuốc đắp** = 2 thảo dược → hồi 40 máu (phím **Q**).
   - **Mũi giáo xương** = 3 xương + 1 da → giáo +30% sát thương.
   - **Mũi giáo nanh sói** = 1 nanh sói đầu đàn + 2 xương (cần mũi giáo xương) → giáo +60% sát thương.
5. **Boss chính:** hạ boss thì qua act, mở act sau.

**Giữ đơn giản:** không cây kỹ năng, không độ bền vũ khí, túi đồ không giới hạn ô. Mỗi act thêm 1–2 công thức mới (vũ khí mới như cung, rìu đến ở act 2–3).

## Thứ tự làm

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **D1 — lõi chơi** | Màn chọn act + lưu tiến trình; túi đồ, hái thảo dược, lột thú (phím E); chế đồ (phím Tab); thuốc hồi máu (Q); nâng cấp giáo; boss phụ Sói đầu đàn ở act 1 | **Xong** (2026-10-19): `src/config/items.ts`, `src/config/acts.ts`, `src/core/progress.ts`, `src/ui/acts.ts`, `src/ui/bag.ts`; 18 bụi thảo dược và hang sói đầu đàn ở tây bắc map act 1 |
| **D2 — map rộng** | Act 1 lên 400–500 m, chia ô tải dần; nhiều đường đi + điểm phụ; dẫn đường bằng cảnh (dấu chân, xương, khói); trại checkpoint, gục ngã quay về trại | Chưa |
| **D3 — act 2, 3** | Map Rừng Xoắn, Đèo Tuyết; hổ răng kiếm, tê giác, gấu hang, bò rừng, lợn rừng, dê núi; vũ khí mới; tranh hang động giữa các act | Chưa |

## Asset cần thêm

| Nhóm | Act 1 | Act 2 | Act 3 |
|---|---|---|---|
| Thú | Có đủ (sói đầu đàn dùng model sói, to hơn) | Hổ răng kiếm, gấu, lợn rừng (**Tìm** CC0 hoặc **Blender**) | Tê giác, bò rừng, dê núi (**Tìm**/**Blender**) |
| Đồ hái | Thảo dược (**Kho** MegaKit) | Nấm (**Kho**) | — |
| Địa hình | Vách đá lớn (**Blender**) | Bùn, nước đầm (**code**) | Tuyết (**code**) |
| Âm thanh | Tiếng gầm, bước chân, nước chảy (**Tìm** CC0) | Tiếng sói, gió | Gió tuyết |

## Câu hỏi mở (không chặn D1)

- Tên bộ tộc, tên nhân vật, kết truyện.
- Đồ đã chế có giữ khi chơi lại act không? *(đề xuất D1: mỗi lần vào act bắt đầu lại từ đầu; D2 lưu túi đồ cùng checkpoint)*
