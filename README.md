# WILDBORN

Game FPS tiền sử chạy trên trình duyệt. Đặc tả: [docs/SPECIFICATION.md](docs/SPECIFICATION.md).

**Chơi thử:** https://phucnguyen020611.github.io/wildborn-web-game/ — tự deploy mỗi khi push lên `main` (`.github/workflows/deploy.yml`: type-check, lint, test, build, rồi GitHub Pages).

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
```

| Lệnh                              | Việc                                             |
| --------------------------------- | ------------------------------------------------ |
| `npm run dev`                     | Dev server                                       |
| `npm run build`                   | Type-check + build ra `dist/`                    |
| `npm test`                        | Unit test (simulation, game loop, khớp key i18n) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                |

**Điều khiển:** WASD di chuyển · chuột để nhìn · chuột trái đâm giáo · chuột phải ném giáo (đi tới chỗ giáo rơi để nhặt) · Space nhảy · Shift chạy · Esc tạm dừng · F3 bật/tắt debug overlay (`?debug` để bật ở bản build).

**Cài đặt** (menu chính hoặc menu tạm dừng): độ nhạy chuột, đảo trục dọc, FOV, chất lượng Thấp/Vừa/Cao (Thấp: không bóng, không phản chiếu, không thảm cỏ; Vừa: bóng 2 tầng, cỏ trong 28 m; Cao: bóng 3 tầng, cỏ trong 42 m), rung và nhún camera (tự tắt nếu hệ điều hành bật giảm chuyển động), âm lượng tổng/hiệu ứng/môi trường. Lưu trong trình duyệt (`localStorage`).

**Map:** mặc định là **Thung lũng Thông** (vùng 1, xem [docs/STORY_MODE.md](docs/STORY_MODE.md)): xuất phát ở trại phía nam, theo lối mòn lội qua suối, băng qua đồng cỏ tới bãi đấu của ma mút ở phía bắc. Arena thử nghiệm cũ vẫn mở được bằng `?map=arena`.

**Vòng chơi:** săn **voi ma mút** ở bãi đấu cuối lối mòn. Ma mút nổi giận khi bạn tới gần (khoảng 12 m) hoặc khi bị đánh. Trước mỗi cú húc, nó **ngẩng đầu và nhấp nháy màu hổ phách**: lùi ra hoặc né sang ngang, vì hướng húc đã khóa từ lúc báo đòn. Nó quay chậm, nên vòng ra sườn mà đâm. Cáo là thú nền: chạy trốn, bị đánh thì cắn lại. Hạ ma mút là thắng, hết máu là thua. Nhảy từ độ cao hơn khoảng 3,5 m sẽ mất máu; sườn dốc hơn khoảng 42° không leo được mà bị trượt xuống. Khi máu dưới 30%, màn hình nhạt màu dần và có tiếng tim đập.

**Giờ trong ngày:** mỗi map có giờ cố định (Thung lũng Thông: 10 giờ sáng). Xem thử giờ khác bằng `?time=` (0–24), ví dụ `?time=17.6` (hoàng hôn) hoặc `?time=22` (đêm trăng).

**Benchmark:** mở `?bench` (ví dụ `http://localhost:5173/?bench`): camera tự chạy 22 giây rồi hiện kết quả frame time, GPU và trình duyệt. Dùng để đo trên máy khác mà không cần chơi.

## Asset

Model gốc đặt trong `art-source/`, chạy `npm run assets` để tối ưu (`npm run assets -- <tên>` chỉ build file có đường dẫn chứa `<tên>`). File `.blend`/`.fbx` được Blender xuất sang glTF tự động; script tạo asset nằm trong `tools/blender/`. Texture được nén KTX2 nếu máy có CLI `ktx` ([KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases)), nếu không thì dùng WebP. Mọi asset phải được ghi vào [docs/ASSET_REGISTER.md](docs/ASSET_REGISTER.md).

`art-source/environment/` không nằm trong git (30 MB, đều lấy từ Quaternius Stylized Nature MegaKit). Tạo lại bằng `npm run import-megakit -- <thư mục glTF của kit>` (mặc định là `../../Assets/stylized-nature-megakit/glTF`). Lệnh này gộp các model vào một file kit dùng chung texture; muốn thêm model thì thêm tên vào `tools/asset-pipeline/import-megakit.sh` và khai báo trong `src/config/props.ts`.

## Cấu trúc

- `src/sim/` — logic gameplay thuần, không đụng render/DOM (dùng lại cho server PvP sau này)
- `src/core/loop.ts` — game loop bước cố định 60 Hz, render nội suy
- `src/render/` — scene Babylon.js, chỉ đọc state từ sim
- `src/input/` — pointer lock, bàn phím theo `KeyboardEvent.code`
- `src/i18n/` — `vi.json`, `en.json`, hàm `t()`
- `src/ui/`, `src/debug/`, `src/config/`, `src/maps/`
- `tools/asset-pipeline/` — script tối ưu asset
