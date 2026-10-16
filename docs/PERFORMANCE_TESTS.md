# Performance Tests

Ngân sách tham chiếu: spec mục 12.1. Mỗi lần đo ghi một mục mới, không sửa số cũ.

## 2026-10-15 — Giai đoạn 1, scene thử nghiệm

**Build:** production (`npm run build` + `vite preview`), Babylon.js 9.30.0, WebGL2
**Máy:** MacBook Apple M4, 16 GB RAM, macOS 27.2 — máy mạnh, **chưa phải máy tham chiếu "trung bình"**
**Trình duyệt:** browser pane Chromium của Claude desktop (localhost, không giới hạn mạng)
**Scene:** sàn 60×60 m, 8 khối hộp, 1 con cáo có rig + 3 animation, fog, không bóng đổ

| Chỉ số | Kết quả | Ngân sách | Ghi chú |
|---|---|---|---|
| Dung lượng tải lần đầu (nén) | ~736 KB | 15–30 MB | JS 610 KB, asset/font/CSS 126 KB |
| Code JS sau nén | ~610 KB | ~3 MB | Chunk chính 313 KB; còn lại là shader/module Babylon tải lười |
| Số request | 81 | — | Nhiều chunk nhỏ của Babylon; chấp nhận được với HTTP/2 |
| Thời gian đến first paint | ~344 ms | menu ≤ 5 s | localhost, chưa có độ trễ mạng thật |
| FPS | 60–120 (theo tần số màn hình) | 60 | Đạt trần vsync |
| Frame time | ~8,3 ms ở 120 Hz | ≤ 16,7 ms | |
| Draw call | 9 | ≤ 300–500 | |
| JS heap | 12 MB (bản build, lúc nghỉ) · 22–72 MB (bản dev) | — | |
| Model cáo | 159 KB → 72 KB (-55%) | — | Meshopt + WebP; texture 1024² ≈ 5,6 MB VRAM (WebP giải nén thành RGBA) |

### Nhận xét

- Còn rất xa ngân sách. Tải lần đầu chỉ bằng khoảng 5% mức 15 MB.
- Glb loader kéo theo module `flowGraph*` (cho `KHR_interactivity`) dù không dùng. Có thể cắt bằng cách chỉ đăng ký những extension cần dùng, khi nào bundle bắt đầu đáng lo.
- Texture WebP tải nhẹ nhưng chiếm VRAM như ảnh thường. Cần chuyển sang KTX2 trước khi đưa vào asset môi trường lớn.

### Còn thiếu

- [ ] Đo trên máy tham chiếu "trung bình" (laptop GPU tích hợp) và trên Chrome/Edge/Firefox/Safari thật.
- [ ] Đo với mạng giới hạn (Chrome DevTools throttling, ví dụ "Fast 4G").
- [ ] Đo lại sau khi có asset môi trường thật. *(KTX2: xong, xem mục bên dưới.)*

### Đánh giá engine (Babylon.js)

Đã kiểm chứng được: camera FPS + pointer lock, import glTF có rig, chạy animation, nén Meshopt/WebP, chạy WebGL2 ổn định, bundle nhỏ. Chưa gặp trở ngại nào cần thử engine khác. **Đã chốt Babylon.js (2026-10-15).**

## 2026-10-15 — Chuyển texture sang KTX2

Cài KTX-Software 4.4.2, chạy lại `npm run assets`. Texture con cáo 1024² chuyển từ WebP sang KTX2 ETC1S:

| | WebP | KTX2 (ETC1S) |
|---|---|---|
| File `crt_fox.glb` | 72 KB | 76 KB |
| VRAM texture (ước tính) | 5,59 MB | 0,70 MB |

Tải thêm 4 KB nhưng bộ nhớ GPU giảm khoảng 8 lần. Bộ giải mã KTX2 hiện tải từ `cdn.babylonjs.com` (mặc định của Babylon), cần tự host trước khi phát hành.

## 2026-10-15 — Môi trường stylized + benchmark `?bench`

**Scene:** như trên, thêm ~215 prop Quaternius (45 cây, 10 đá, 40 bụi/dương xỉ, 120 cỏ) dùng GPU instancing.
**Đo bằng:** `?bench` (camera chạy vòng tròn 20 s, bỏ 2 s đầu), browser pane Chromium, Apple M4, 1226×900 @1x.

| Chỉ số | Kết quả | Ngân sách |
|---|---|---|
| Frame time trung bình | 8,34 ms (120 FPS, chạm trần vsync) | ≤ 16,7 ms |
| p95 / p99 / max | 9,0 / 9,3 / 16,4 ms | — |
| Draw call | 11 (183 trước khi bật instancing) | ≤ 300–500 |
| Model môi trường (8 file) | 4,7 MB | — |
| Tổng tải lần đầu ước tính | ~5,3 MB (JS ~0,6 MB + model ~4,7 MB, chưa tính bộ giải mã KTX2 từ CDN) | 15–30 MB |

### Nhận xét

- **Instancing là bắt buộc:** Babylon mặc định clone (`doNotInstantiate: true`). Bật instancing giảm draw call ~16 lần.
- **Texture là phần nặng nhất:** 3 file cây chiếm 3,9/4,7 MB, phần lớn do normal map vỏ cây UASTC. Hướng giảm tiếp: dùng chung một file texture cho các biến thể cây, hoặc bỏ normal map cho cây ở xa.
- **Giới hạn của số đo:** trên M4 mọi thứ chạm trần vsync nên chưa biết còn dư bao nhiêu. Cần chạy `?bench` trên máy tầm trung.

## 2026-10-15 — Bản deploy thật trên GitHub Pages

**URL:** https://phucnguyen020611.github.io/wildborn-web-game/ (commit `d50c311`), browser pane Chromium, mạng thật, chưa có cache.

| Chỉ số | Kết quả | Ngân sách |
|---|---|---|
| Request | 99 | — |
| Dung lượng truyền tải | ~6,3 MB | 15–30 MB |
| Thời gian đến khi tải xong toàn bộ asset | ~12,8 s | — |
| Lỗi tải | 0 (12/12 model trả 200) | — |

Menu hiện trước khi model tải xong, nhưng trong lúc đó chưa có gì báo đang tải. Đây là lý do nên làm màn hình tải có thanh tiến trình (spec 11.1). GitHub Pages chỉ cache khoảng 10 phút (spec 11.4), nên phát hành thật nên dùng CDN cho phép chỉnh header cache.

## 2026-10-15 — Môi trường cho boss: tảng đá, bóng đổ, bầu trời

**Thay đổi:** bỏ khối xám, thêm 7 tảng đá lớn đổ bóng, shadow map 2048 (PCF), vòm trời gradient, thêm khoảng 140 cây cỏ nhỏ (hoa, nấm, cỏ ba lá, sỏi). Tổng 357 prop.
**Đo bằng:** `?bench`, browser pane Chromium, Apple M4, 1024×768.

| Chỉ số | Kết quả | Trước đó |
|---|---|---|
| Frame time trung bình | 10,3 ms* | 8,34 ms |
| p95 / p99 | 9,4 / 16,9 ms | 9,0 / 9,3 ms |
| Draw call (lúc chơi) | ~38 | ~21–31 |
| Model + âm thanh | 7,3 MB | ~6 MB |

\*Có một khung hình kéo dài khoảng 1 giây (max 1.008 ms), nhiều khả năng do pane bị ẩn thoáng qua hoặc shader biên dịch muộn; nó kéo số trung bình lên. Lần chạy lại không hoàn tất vì pane bị ẩn. p99 tăng lên khoảng 17 ms, có thể do shadow pass. Cần đo lại trên Chrome thật, và nếu p99 vẫn cao thì kiểm tra shadow map, ví dụ hạ xuống 1024 cho mức Vừa.

## 2026-10-16 — Map vùng 1 (Thung lũng Thông) với địa hình và kit môi trường

**Thay đổi:** map 160 × 160 m có heightmap, suối, khoảng 2.800 prop (gần 8 lần arena), cây cỏ từ một file kit dùng chung texture, khoảng cách vẽ 45 m (cây cỏ nhỏ) / 110 m (cây to).
**Đo bằng:** `?bench`, browser pane Chromium, Apple M4, 1351×985. Lúc này camera bench đã bám theo địa hình.

| Chỉ số | Kết quả | Arena cũ (2026-10-15) |
|---|---|---|
| Frame time trung bình | 8,34 ms (chạm trần vsync 120 Hz) | 10,3 ms* |
| p95 / p99 / max | 9,2 / 9,4 / 12,8 ms | 9,4 / 16,9 / 1.008 ms |
| Tam giác mỗi khung hình (góc nặng nhất) | ~670k (trước khi thêm khoảng cách vẽ cho cây: ~880k) | — |
| Draw call | ~60 | ~38 |
| Model + âm thanh (bản build) | 4,3 MB | 7,3 MB |
| Thời gian đến khi nút Chơi bật (dev server) | ~2 s | — |

- **Không nhân bản bằng `instantiateModelsToScene` cho từng prop** khi kit lớn: mỗi lần gọi duyệt toàn bộ node của kit, với 2.100 prop mất khoảng 11 giây. Gọi `createInstance` trực tiếp trên mesh nguồn thì gần như tức thì.
- Tam giác chủ yếu đến từ cây (5–9k đỉnh mỗi cây). Nếu máy tầm trung bị chậm, hạ `drawDistance` của cây xuống 80–90 m hoặc thêm LOD cho cây.
- Vẫn cần chạy `?bench` trên máy tầm trung.

## 2026-10-16 — Nhóm B: bầu trời, bóng nhiều tầng, texture mặt đất, nước, gió, thảm cỏ

**Thay đổi:** `SkyMaterial` + ánh sáng theo giờ; bóng cascaded (cây cũng đổ bóng); `TerrainMaterial` 3 texture; nước có phản chiếu phẳng; gió trên GPU; thảm cỏ khoảng 41.500 bụi (thin instance, chỉ vẽ trong tầm).
**Đo bằng:** vẽ 20 khung liên tiếp, chờ GPU xong (`readPixels`), browser pane Chromium, Apple M4, canvas 1536×1152, cài đặt mặc định. Không dùng `?bench`: pane nhúng đang giới hạn rAF ở khoảng 1 khung/giây nên số đo theo rAF vô nghĩa.

| Góc nhìn | ms/khung | Tam giác lượt chính |
|---|---|---|
| Trại nhìn về bắc | 7,9 | ~700k (cây ~470k, cỏ ~90k) |
| Chỗ lội suối | 10,9 | — |
| Đồng cỏ | 9,6 | — |

- Tính cả lượt vẽ bóng (2–3 tầng) và gương nước, tổng số tam giác mỗi khung khoảng 2–4 triệu. Phần lớn là cây vẽ vào shadow map. Nếu máy tầm trung chậm: giảm `shadowMaxZ` (90 m), cho cây xa không đổ bóng, hoặc thêm LOD cho cây.
- Model + âm thanh + texture: 5,6 MB (trước 4,3 MB; thêm 1,4 MB texture mặt đất).
- Shader cỏ biên dịch bất đồng bộ nên xuất hiện sau vài khung đầu.
- Vẫn cần chạy `?bench` trên máy tầm trung và trên Chrome thật.

