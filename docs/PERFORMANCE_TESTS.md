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
