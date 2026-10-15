# SPECIFICATION.md

# WILDBORN — Game Specification

> **Phiên bản:** 0.3 — 2026-10-15  
> **Trạng thái:** Bản đặc tả khởi đầu cho prototype  
> **Ngôn ngữ tài liệu:** Tiếng Việt  
> **Tên game:** `WILDBORN` _(đã chốt; còn chờ kiểm tra nhãn hiệu và tên miền)_  
> **Ngôn ngữ trong game:** Tiếng Việt và English _(đã chốt)_  
> **Nền tảng mục tiêu:** Trình duyệt web trên desktop, game 3D góc nhìn thứ nhất  
> **Engine:** Babylon.js + TypeScript *(đã chốt sau Giai đoạn 1, xem mục 9.1)*

**Quy ước trong tài liệu:**

- **[Đã chốt]** — quyết định đã được thống nhất.
- **[Đề xuất]** — khuyến nghị theo best-practice cho web game; áp dụng mặc định cho đến khi có quyết định khác.
- Các con số ngân sách (dung lượng, FPS, polygon...) là **mục tiêu thử nghiệm ban đầu**, phải được xác nhận bằng đo đạc thực tế.

---

## 1. Tổng quan dự án

Phát triển một game hành động 3D góc nhìn thứ nhất (FPS) lấy bối cảnh thời tiền sử. Game không sử dụng súng hiện đại; chiến đấu bằng vũ khí nguyên thủy như giáo, cung, rìu đá, dùi cui, lao ném và bẫy. Thế giới lấy cảm hứng từ cảm giác săn bắn, sinh tồn và môi trường bộ tộc trong _Far Cry Primal_, nhưng game cần có bản sắc, thiết kế map, model, nhân vật và nội dung riêng.

Game dự kiến có hai mode chính:

1. **Story Mode / PvE:** Khám phá môi trường tiền sử, chiến đấu với động vật và boss lớn như voi ma mút, hổ răng dài (_Smilodon_) cùng những sinh vật khác phù hợp với thế giới game.
2. **Team Deathmatch / PvP:** Hai đội chiến binh giao chiến bằng vũ khí nguyên thủy trên các map được thiết kế cho giao tranh cạnh tranh.

Về mặt kỹ thuật, PvE và PvP gần như là **hai sản phẩm** dùng chung nội dung: PvP đòi hỏi server, đồng bộ mạng và chống gian lận. Vì vậy prototype tập trung vào PvE, nhưng kiến trúc code phải chuẩn bị sẵn cho PvP (xem mục 9.3 và 15).

Do game chạy trên trình duyệt, mọi tính năng đồ họa và asset phải được thiết kế với ngân sách tải xuống, bộ nhớ GPU, tốc độ khung hình và khả năng tương thích thiết bị làm tiêu chí ngay từ đầu.

## 2. Mục tiêu thiết kế

### 2.1. Trải nghiệm cốt lõi

- Mang lại cảm giác nhập vai của game FPS: camera ở góc nhìn thứ nhất, điều khiển trực tiếp, ngắm và tấn công nhanh.
- Tạo khác biệt với FPS dùng súng bằng vũ khí tầm gần, tầm xa nguyên thủy, ném lao và bẫy.
- Tạo cảm giác quy mô khi người chơi đối đầu với động vật lớn.
- Cho phép cùng một hệ thống vũ khí và môi trường được tận dụng có chọn lọc ở cả PvE lẫn PvP.
- Vào game nhanh: người chơi nhấn link là thấy menu trong vài giây, không cần cài đặt hay tạo tài khoản để chơi thử.
- Ưu tiên prototype nhỏ, kiểm chứng cảm giác điều khiển và hiệu năng trước khi mở rộng thành thế giới lớn.

### 2.2. Các trụ cột thiết kế

1. **Primitive combat:** Giáo, cung tên, rìu đá, gậy, lao ném và bẫy là các công cụ chiến đấu chính.
2. **Hunt and survive:** Động vật, địa hình, đường đi và môi trường ảnh hưởng đến chiến đấu.
3. **Readable combat:** Người chơi phải đọc được hướng tấn công của boss, phân biệt đối thủ trong PvP và hiểu được địa hình chiến thuật.
4. **Web-first performance:** Asset, scene và hiệu ứng được tối ưu cho trình duyệt thay vì bê nguyên một bộ asset dành cho PC cấu hình cao vào game.
5. **Original identity:** Chỉ dùng game khác làm tài liệu tham khảo. Không trích xuất trái phép tài nguyên hoặc sao chép nguyên xi map, model, giao diện hay nội dung được bảo hộ.

### 2.3. Thứ tự ưu tiên phát triển

Không nên bắt đầu bằng việc sản xuất hàng loạt model hoặc dựng một map lớn. Thứ tự ưu tiên:

1. **Thiết lập nền móng dự án:** repo, build, lint, CI, i18n, debug overlay, đo hiệu năng.
2. **Kiểm chứng gameplay cốt lõi:** di chuyển FPS, ngắm, dùng vũ khí nguyên thủy, va chạm và phản hồi khi đánh trúng.
3. **Kiểm chứng công nghệ web:** dựng scene 3D chạy trong trình duyệt; đo thời gian tải, FPS và bộ nhớ trên thiết bị mục tiêu.
4. **Chuẩn hóa pipeline asset từ sớm:** thống nhất định dạng, quy tắc đặt tên, texture, vật liệu, rig, animation, LOD, nén và quy trình nhập vào engine.
5. **Hoàn thiện một vertical slice:** một map nhỏ, một vũ khí và một boss tạo thành vòng lặp chơi hoàn chỉnh.
6. **Mở rộng số lượng và chất lượng asset:** chỉ khi gameplay, pipeline và hiệu năng đã được kiểm chứng.

Cần phân biệt hai việc: **chuẩn bị pipeline asset sớm** là cần thiết; **sản xuất thật nhiều asset hoàn chỉnh từ đầu** thì chưa cần thiết và có thể gây lãng phí nếu yêu cầu kỹ thuật thay đổi.

### 2.4. Ngôn ngữ và bản địa hóa [Đã chốt]

Game hỗ trợ hai ngôn ngữ chính ngay từ prototype: **Tiếng Việt (`vi`)** và **English (`en`)**.

- Không hardcode chuỗi hiển thị trong code; mọi text UI, tutorial, phụ đề dùng key và lấy từ file ngôn ngữ (`src/i18n/vi.json`, `src/i18n/en.json`, được bundle cùng code vì dung lượng nhỏ).
- Key đặt theo ngữ cảnh, ví dụ `menu.play`, `hud.boss_health`, `weapon.spear.name`. Thiếu key ở một ngôn ngữ thì fallback sang `en` và ghi cảnh báo trong bản dev.
- Có script kiểm tra hai file ngôn ngữ có cùng tập key; chạy trong CI.
- Hỗ trợ tham số và số nhiều (ví dụ `"{count} mũi tên"` / `"{count} arrows"`), không ghép chuỗi bằng code.
- Ngôn ngữ mặc định theo trình duyệt: `vi` nếu ngôn ngữ trình duyệt là tiếng Việt, còn lại `en`. Người chơi đổi được trong menu, đổi ngay không cần tải lại trang, và lựa chọn được ghi nhớ.
- Font phải hỗ trợ đầy đủ dấu tiếng Việt (kể cả chữ hoa có dấu như `Ặ`, `Ỡ`). Nhiều font display phong cách "tribal/primal" thiếu glyph tiếng Việt, cần kiểm tra trước khi chọn. Subset font theo bảng ký tự Latin + Vietnamese để giảm dung lượng.
- Layout UI chừa chỗ cho độ dài chuỗi khác nhau giữa hai ngôn ngữ; không thiết kế nút/khung vừa khít với một ngôn ngữ.
- Không đưa text vào texture hoặc ảnh UI; nếu bắt buộc thì cần bản cho từng ngôn ngữ.
- Lời thoại nhân vật: cân nhắc dùng một ngôn ngữ bộ tộc hư cấu kèm phụ đề `vi`/`en`, vừa tăng chất tiền sử vừa tránh phải lồng tiếng hai lần.
- Tên thương hiệu `WILDBORN` giữ nguyên; tên mode, vũ khí, sinh vật có bản dịch riêng cho từng ngôn ngữ.
- Thẻ `<html lang>`, tiêu đề trang và meta mô tả (phục vụ chia sẻ link/SEO) đổi theo ngôn ngữ đang chọn.

## 3. Tên và nhãn hiệu

### 3.1. Tên chính thức [Đã chốt]

- **`WILDBORN`** — tên thương hiệu giữ nguyên tiếng Anh ở cả hai ngôn ngữ, không dịch.

Trước khi phát hành vẫn cần kiểm tra nhãn hiệu, tên miền, tên game có sẵn (Steam, itch.io, các web game portal) và khả năng gây nhầm lẫn với thương hiệu khác.

### 3.2. Những phương án từng cân nhắc

- `PRIMALIS` _(tên làm việc trước đây)_
- `AGE OF FANGS`
- `UNTAMED`
- `BLOOD & BONE`
- `FIRSTBORN`
- `SAVAGE AGE`
- `PRIMAL STRIKE`
- `STONEBORN`
- `TRIBAL WARFARE`
- `INSTINCT`
- `PRIMAL RAGE`

### 3.3. Tên mode đề xuất

| Mode            | English          | Tiếng Việt _(đề xuất)_ |
| --------------- | ---------------- | ---------------------- |
| Story Mode      | `THE GREAT HUNT` | `CUỘC ĐẠI SĂN`         |
| Team Deathmatch | `TRIBAL WAR`     | `CHIẾN TRANH BỘ TỘC`   |

Đây là tên làm việc cho mode, có thể đổi sau.

## 4. Game modes

### 4.1. Story Mode — The Great Hunt

**Mục đích:** Cho người chơi khám phá khu vực tiền sử và lần lượt đối đầu với các sinh vật lớn.

**Nội dung dự kiến:**

- Một khu vực rừng tiền sử nhỏ cho prototype.
- Các vật thể môi trường như đá, cây đổ, bụi cây, hang động, lều bộ tộc, xương thú và đống lửa.
- Một kẻ địch nhỏ (ví dụ sói hoặc lợn rừng) để thử combat cơ bản trước khi làm boss.
- Một boss đầu tiên để xác thực combat; ví dụ voi ma mút.
- Tiếp theo mới cân nhắc thêm hổ răng dài, động vật nhỏ hơn và các khu vực khác.
- Boss cần có các pha tấn công đọc được, thời gian báo đòn rõ ràng (hình ảnh + âm thanh), điểm yếu có chỉ dẫn, va chạm phù hợp và animation trạng thái như di chuyển, tấn công, bị thương và chết.
- Lưu tiến trình theo checkpoint (xem mục 14).

**Phạm vi prototype tối thiểu:** Một arena nhỏ, một vũ khí, một boss, một vòng lặp chiến đấu hoàn chỉnh.

**Cần thiết kế sau:** cốt truyện, vòng lặp chơi giữa các boss (khám phá, thu thập, nâng cấp?) và cách dẫn dắt người chơi.

### 4.2. Team Deathmatch — Tribal War

**Mục đích:** PvP giữa hai đội sử dụng vũ khí tiền sử.

**Yêu cầu thiết kế map:**

- Có tuyến giao tranh chính, đường vòng, chỗ nấp, điểm cao và vùng giao tranh ở nhiều khoảng cách.
- Hạn chế góc bắn áp đảo hoặc vị trí khó phản công.
- Silhouette và màu của hai đội phải dễ phân biệt trong môi trường rừng, kể cả với người mù màu (không chỉ dựa vào đỏ/xanh lá).
- Tái sử dụng một số asset môi trường của Story Mode nhưng map PvP cần bố cục riêng để phục vụ tính cạnh tranh.

**Các vấn đề cần thiết kế sau:**

- Quy mô đội, cách tính điểm, giới hạn thời gian và điều kiện chiến thắng.
- Respawn, cân bằng vũ khí và xử lý người chơi rời trận.
- Kiến trúc networking: xem nguyên tắc ở mục 15.

## 5. Gameplay và vũ khí

### 5.1. Góc nhìn và điều khiển

- Góc nhìn thứ nhất (first-person).
- Cần có di chuyển, nhìn/ngắm, chạy nhanh, nhảy, né (nếu phù hợp), tấn công và tương tác cơ bản.
- Tách model vũ khí ở góc nhìn người chơi (**first-person viewmodel**) khỏi model vũ khí nhìn thấy trong thế giới (**world model**). Viewmodel render với FOV riêng để không bị méo khi người chơi đổi FOV và không xuyên vào tường.
- Chi tiết về input trên trình duyệt: xem mục 6.3.

### 5.2. Vũ khí dự kiến

| Vũ khí      | Vai trò dự kiến                        | Ghi chú                                             |
| ----------- | -------------------------------------- | --------------------------------------------------- |
| Giáo        | Cận/trung, đâm tầm với dài; có thể ném | **[Đề xuất]** vũ khí đầu tiên, hai chế độ đâm + ném |
| Cung tên    | Tầm xa, cần giương dây                 | Mũi tên là projectile có quỹ đạo, không hitscan     |
| Rìu đá      | Cận chiến, sát thương cao, chậm        | Đòn vung cần hitbox theo cung chuyển động           |
| Dùi cui/gậy | Cận chiến nhanh, gây choáng            |                                                     |
| Lao ném     | Tầm trung, số lượng giới hạn           |                                                     |
| Bẫy         | Kiểm soát khu vực                      | Phù hợp PvE săn thú; cần cân bằng riêng cho PvP     |

Thông số cụ thể chưa được chốt. Mỗi vũ khí cần có vai trò dễ hiểu: tầm đánh, tốc độ ra đòn, độ chính xác, thời gian chuẩn bị, thời gian hồi và khả năng dùng trong PvP.

### 5.3. Thông số data-driven [Đề xuất]

- Thông số vũ khí, sinh vật, sát thương và AI nằm trong file cấu hình (JSON/TS) thay vì rải trong code, để cân bằng không cần sửa logic.
- File cấu hình có schema kiểm tra kiểu (ví dụ Zod hoặc TypeScript type) và được validate khi build.
- Tên hiển thị trong cấu hình là key i18n, không phải chuỗi cố định.

### 5.4. Cảm giác chiến đấu (game feel)

Cận chiến góc nhìn thứ nhất là rủi ro gameplay lớn nhất của dự án. Các kỹ thuật cần thử sớm:

- **Phản hồi khi trúng:** hitstop ngắn vài frame, rung camera nhẹ, âm thanh va chạm theo vật liệu (thịt, gỗ, đá), particle máu/bụi, hit marker.
- **Báo đòn:** windup animation và âm thanh rõ ràng trước đòn đánh nặng của cả người chơi lẫn boss.
- **Input buffering:** ghi nhận lệnh tấn công nhấn sớm trong lúc đang hồi đòn để điều khiển không bị "nuốt phím".
- **Hit detection:** đòn đâm dùng ray/shape cast theo hướng vũ khí; đòn vung dùng sweep theo cung chuyển động; projectile (tên, lao) mô phỏng quỹ đạo có trọng lực.
- **Hitbox tách khỏi mesh render:** dùng các khối va chạm đơn giản gắn theo bone; boss có hitbox điểm yếu riêng nhận hệ số sát thương cao hơn.

### 5.5. Yêu cầu với model và animation

- Vũ khí nhìn gần phải có silhouette rõ và chất lượng đủ tốt cho camera FPS.
- Animation cần phù hợp với thao tác thực tế: cầm, giương cung, kéo dây, ném lao, vung rìu, đánh trúng và hồi phục sau đòn.
- Animation tấn công có animation event/marker cho các mốc: bắt đầu hitbox, kết thúc hitbox, có thể hủy đòn.
- Với thú/boss, ưu tiên model có skeleton/rig và animation; model tĩnh đẹp nhưng không có rig không đủ để triển khai boss hoàn chỉnh.

## 6. Nền tảng mục tiêu, trình duyệt và input

### 6.1. Phạm vi nền tảng [Đề xuất]

- **Desktop trước:** Windows và macOS, chuột + bàn phím.
- **Gamepad:** hỗ trợ tùy chọn qua Gamepad API sau khi điều khiển chuột/phím ổn định.
- **Mobile/tablet:** ngoài phạm vi prototype. FPS bằng cảm ứng cần thiết kế điều khiển và ngân sách hiệu năng riêng. Nếu người chơi vào bằng mobile, hiển thị thông báo thân thiện thay vì để game chạy lỗi.

### 6.2. Trình duyệt và API đồ họa [Đề xuất]

- **Baseline: WebGL2.** Đây là mức có hỗ trợ rộng nhất trên các trình duyệt desktop hiện đại.
- **WebGPU:** bật khi trình duyệt hỗ trợ và đã được kiểm thử, có fallback về WebGL2. Không viết shader/tính năng chỉ chạy được trên WebGPU ở giai đoạn đầu.
- **Ma trận kiểm thử tối thiểu:** Chrome, Edge, Firefox (Windows) và Safari, Chrome (macOS), mỗi trình duyệt ở phiên bản ổn định mới nhất.
- **Máy cấu hình tham chiếu:** ít nhất một laptop GPU tích hợp (Intel/AMD iGPU hoặc Apple Silicon đời đầu) làm mức "trung bình", và một máy có GPU rời làm mức "cao". Cần chốt cấu hình cụ thể (mục 21).
- Phát hiện tính năng khi khởi động (WebGL2, nén texture hỗ trợ, WebGPU); nếu thiếu tính năng bắt buộc thì hiển thị thông báo rõ ràng bằng ngôn ngữ của người chơi.

### 6.3. Input trên trình duyệt

- **Pointer Lock API** để điều khiển camera bằng chuột; chỉ yêu cầu khóa chuột sau thao tác của người chơi (click). Dùng tùy chọn `unadjustedMovement` (raw input) khi trình duyệt hỗ trợ để tắt gia tốc chuột của hệ điều hành.
- Phím **Esc** luôn thoát pointer lock do trình duyệt quy định; game bắt sự kiện `pointerlockchange` để tự mở menu tạm dừng.
- Đọc phím theo `KeyboardEvent.code` (vị trí vật lý), không theo `key`, để WASD đúng trên mọi layout bàn phím. Hiển thị tên phím theo layout thực tế khi có thể (Keyboard Map API).
- **Tránh gán tổ hợp mà trình duyệt chiếm:** ví dụ `Ctrl+W` (đóng tab), `Ctrl+T`, `Ctrl+N`. Ngồi/cúi nên dùng `C` hoặc `Shift` thay vì `Ctrl` khi đi kèm `W`.
- Kiểm thử khi bộ gõ tiếng Việt (Unikey, EVKey, bộ gõ macOS) đang bật, vì đây là trường hợp phổ biến với người chơi Việt Nam.
- Hỗ trợ chế độ toàn màn hình (Fullscreen API) từ menu; Keyboard Lock API chỉ dùng như tính năng bổ sung khi có hỗ trợ.
- Cho phép đổi phím (key rebinding) và lưu cấu hình (mục 13).

### 6.4. Hành vi của trang web

- **Tab bị ẩn / mất focus** (`visibilitychange`, `blur`): tạm dừng game PvE, tắt âm thanh hoặc giảm âm lượng, ngừng render để tiết kiệm pin. PvP không thể tạm dừng, chỉ ngừng render.
- **Âm thanh:** trình duyệt chặn autoplay; chỉ khởi tạo/resume `AudioContext` sau thao tác đầu tiên của người chơi (ví dụ nút "Chơi").
- **Mất WebGL context** (`webglcontextlost`): hiển thị thông báo, thử khôi phục khi có `webglcontextrestored`, không để trang treo im lặng.
- **Đổi kích thước cửa sổ / DPI:** cập nhật kích thước canvas, giới hạn `devicePixelRatio` theo preset đồ họa (mục 12.3).
- Cảnh báo trước khi đóng tab khi đang trong trận PvP hoặc có tiến trình chưa lưu.

## 7. Hướng mỹ thuật và tài liệu tham khảo

### 7.1. Hướng hình ảnh ban đầu

- Tiền sử, rừng nguyên sinh, đá, đất, rêu, cây đổ, hang động, vách núi và trại bộ tộc.
- Vũ khí thủ công làm từ gỗ, đá, xương và da.
- Động vật cần tạo cảm giác có trọng lượng và kích thước, nhưng vẫn đảm bảo người chơi đọc được hành vi chiến đấu.
- Ưu tiên một phong cách đồ họa nhất quán; tránh ghép asset photorealistic với low-poly một cách vô chủ đích.

### 7.2. Phong cách đồ họa [Đã chốt]

**Stylized / semi-realistic** (hình khối rõ, texture vẽ tay hoặc PBR đơn giản hóa, bảng màu có chủ đích) — chốt ngày 2026-10-15, thay cho photorealistic vì:

- Phù hợp ngân sách tải 15–30 MB và bộ nhớ GPU của trình duyệt.
- Dễ đọc combat hơn (silhouette, màu báo đòn, điểm yếu).
- Dễ ghép asset từ nhiều nguồn mà không lệch phong cách, và lâu lỗi thời hơn.
- Photorealistic trên web cần texture lớn, scan nặng và hậu kỳ tốn GPU, rủi ro cao với team nhỏ.

Chi tiết (bảng màu, tỷ lệ, mật độ texel, quy tắc vật liệu) ghi trong `docs/ART_GUIDE.md`.

### 7.3. Game tham khảo theo từng khía cạnh

- **Far Cry Primal:** Vũ khí nguyên thủy, bối cảnh bộ tộc, rừng và khu săn bắn.
- **Ancestors: The Humankind Odyssey:** Cảm giác thiên nhiên rộng lớn, địa hình rừng, vách đá và đường di chuyển.
- **ARK: Survival Ascended:** Tỷ lệ sinh vật khổng lồ so với người chơi và cảm giác hệ sinh thái.
- **Horizon Forbidden West:** Cách tạo silhouette boss, báo trước đòn đánh, chỉ dẫn điểm yếu và thiết kế đấu trường.

Dùng ảnh chụp màn hình và hình tham khảo làm moodboard hoặc nghiên cứu bố cục. Không sao chép nguyên xi map hay trích xuất tài nguyên từ game thương mại.

## 8. Âm thanh

Âm thanh là một phần của combat, không chỉ là trang trí: người chơi nghe báo đòn của boss, hướng thú đến gần và biết đòn đánh có trúng hay không.

- Dùng **Web Audio API** (hoặc lớp âm thanh của engine) với các bus riêng: Master, Nhạc, Hiệu ứng, Môi trường, Thoại/UI. Mỗi bus có thanh âm lượng trong cài đặt.
- **Âm thanh 3D có định vị** cho sinh vật, đòn đánh và môi trường; giới hạn số nguồn phát đồng thời và ưu tiên âm thanh quan trọng (báo đòn boss > môi trường).
- Báo đòn boss luôn có tín hiệu âm thanh riêng, dễ nhận biết, kèm tín hiệu hình ảnh để không phụ thuộc hoàn toàn vào âm thanh.
- Định dạng: file nén có hỗ trợ rộng trên các trình duyệt mục tiêu (ví dụ AAC/M4A hoặc MP3; Opus nếu đã kiểm tra trên Safari mục tiêu). Hiệu ứng ngắn có thể gom thành audio sprite.
- Nhạc nền và âm thanh môi trường dài được stream hoặc tải sau, không nằm trong gói tải đầu tiên.
- Giấy phép âm thanh được ghi vào asset register như model/texture.

## 9. Kiến trúc kỹ thuật

### 9.1. Lựa chọn engine [Đã chốt]

**Engine: Babylon.js** (đang dùng bản 9.x), chốt ngày 2026-10-15 sau scene kiểm chứng ở Giai đoạn 1. Đã kiểm chứng được: camera FPS + pointer lock, import glTF có rig và chạy animation, nén Meshopt/WebP, WebGL2 ổn định, tải lần đầu ~736 KB. Số liệu chi tiết: `docs/PERFORMANCE_TESTS.md`.

Bảng so sánh dưới đây giữ lại để tham khảo lý do lựa chọn.

| Engine                                   | Điểm mạnh liên quan đến dự án                                                                              | Cân nhắc                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [Babylon.js](https://www.babylonjs.com/) | Engine game 3D cho web, có sẵn vật lý Havok, pipeline glTF tốt, hỗ trợ WebGL2 và WebGPU, công cụ Inspector | **[Đã chốt]** Đủ tính năng game engine, viết hoàn toàn bằng TypeScript, không phụ thuộc editor online.                     |
| [PlayCanvas](https://playcanvas.com/)    | Engine web-first, có editor trực quan chạy trên trình duyệt                                                | Hợp nếu muốn dựng scene bằng editor; workflow gắn với editor cloud.                                                       |
| [Three.js](https://threejs.org/)         | Thư viện 3D linh hoạt, hệ sinh thái lớn                                                                    | Phải tự lắp nhiều hệ thống (vật lý như Rapier, animation state, asset loading); hợp nếu muốn kiểm soát kiến trúc.         |
| [Unity](https://unity.com/)              | Hệ sinh thái asset lớn                                                                                     | Không phải lựa chọn mặc định; bản build web thường nặng và thời gian tải lâu so với ngân sách của dự án.                  |

**Cách đã quyết định:** dựng một scene thử nghiệm (camera FPS, model có rig, va chạm) trên Babylon.js. Không gặp trở ngại nghiêm trọng nên không thử engine thứ hai.

### 9.2. Stack kỹ thuật [Đã chốt]

- **Ngôn ngữ:** TypeScript với `strict` bật.
- **Build/dev server:** Vite; import engine theo module để tree-shaking giảm dung lượng.
- **Engine:** Babylon.js (`@babylonjs/core`, `@babylonjs/loaders`), import theo từng module.
- **Va chạm / vật lý:** tự viết trong lớp simulation (`src/sim/`): va chạm hình tròn với hộp, đứng lên khối, bước qua bậc thấp. Cách này không tốn dung lượng tải và server PvP dùng lại được. Chỉ thêm **Havok** (WASM ~2 MB) khi cần ragdoll, vật thể vật lý hoặc địa hình phức tạp.
- **UI menu/HUD:** HTML/CSS overlay trên canvas (dễ i18n, dễ hỗ trợ font tiếng Việt, accessibility tốt hơn), giữ nhẹ — không cần framework UI lớn cho prototype.
- **i18n:** module tự viết (`src/i18n/`) đọc JSON, có fallback và tham số; chuyển sang thư viện (ví dụ i18next) nếu cần số nhiều/định dạng phức tạp.
- **Chất lượng code:** ESLint, Prettier, Vitest (unit test), Playwright (smoke test trên trình duyệt).

### 9.3. Tách mô phỏng khỏi render

- Logic gameplay (di chuyển, sát thương, AI, trạng thái vũ khí, máu) nằm trong lớp **simulation** không phụ thuộc vào render, DOM hay engine đồ họa.
- Lớp **render/presentation** đọc trạng thái simulation để hiển thị model, animation, hiệu ứng và âm thanh.
- Lợi ích: unit test được logic gameplay; khi làm PvP có thể chạy cùng code simulation trên server (Node.js/TypeScript) mà không viết lại; dễ thay asset hoặc đổi engine render.
- Input được chuyển thành **lệnh** (command) có đánh số frame trước khi vào simulation, để sau này dùng cho client prediction và replay.

### 9.4. Game loop

- **Simulation chạy theo bước thời gian cố định** (ví dụ 60 Hz), render chạy theo `requestAnimationFrame` và nội suy giữa hai trạng thái simulation.
- Giới hạn delta time tối đa (ví dụ 100–250 ms) để tránh "vòng xoáy tử thần" khi tab bị treo hoặc máy chậm.
- Không phụ thuộc vào tần số màn hình (60/120/144 Hz) để tính tốc độ di chuyển hay sát thương.

### 9.5. Bộ nhớ và hiệu năng runtime

- **Tránh cấp phát trong vòng lặp nóng** (mỗi frame): tái sử dụng vector/matrix, dùng object pool cho mũi tên, lao, particle, decal để giảm giật do garbage collector.
- **Giải phóng tài nguyên** (geometry, texture, material, animation, audio buffer) khi chuyển khu vực hoặc thoát trận; kiểm tra rò rỉ bằng cách vào/ra trận nhiều lần và theo dõi bộ nhớ.
- **Web Worker** cho các tác vụ nặng không cần chạy trên main thread: giải nén Draco/Meshopt, transcode Basis/KTX2 (thường loader đã hỗ trợ), tính toán AI/pathfinding nếu cần.
- Shader được biên dịch/warm-up trong màn hình tải để tránh giật lần đầu một hiệu ứng xuất hiện.

### 9.6. Xử lý lỗi và debug

- **Debug overlay** (bật bằng phím tắt trong bản dev): FPS, frame time, draw call, số tam giác, bộ nhớ ước tính, số entity, trạng thái AI boss.
- Dùng công cụ của engine (ví dụ Babylon Inspector) và Spector.js để phân tích frame.
- Bắt lỗi toàn cục (`error`, `unhandledrejection`); hiển thị màn hình lỗi thân thiện có nút tải lại thay vì canvas đen.
- Báo cáo lỗi từ xa (ví dụ Sentry) chỉ bật khi có thông báo quyền riêng tư phù hợp (mục 14).
- Cờ tính năng (feature flag) và tham số URL cho bản dev (ví dụ `?debug=1`, `?preset=low`, `?scene=arena`) để kiểm thử nhanh.

## 10. Pipeline asset dành cho web

### 10.1. Định dạng và nén

- **glTF/GLB** là định dạng model chuẩn của dự án.
- Nén geometry bằng **Meshopt** hoặc **Draco**; đo cả dung lượng tải và chi phí giải nén. Meshopt thường giải nén nhanh hơn và nén được cả animation.
- Texture dùng **KTX2/Basis Universal**: ETC1S cho texture màu/ít quan trọng (nhẹ), UASTC cho normal map và texture cần chất lượng cao.
- Giữ file nguồn (Blender, texture gốc) trong kho riêng; không ghi đè hoặc làm mất bản gốc, không đưa vào gói tải của người chơi.
- Xác minh chất lượng sau chuyển đổi: vật liệu, normal map, alpha, skinning, rig và animation.

### 10.2. Công cụ pipeline [Đề xuất]

- **glTF-Transform** (CLI/script) để tối ưu: gộp/khử trùng lặp, weld, simplify, nén Meshopt/Draco, resize và chuyển texture sang KTX2.
- **KTX-Software (`toktx`)** hoặc glTF-Transform để tạo texture KTX2.
- Script pipeline nằm trong `tools/`, chạy được bằng một lệnh (ví dụ `npm run assets`) để mọi asset đi qua cùng quy trình, có thể lặp lại.
- Validate glTF bằng glTF Validator trong pipeline; lỗi nghiêm trọng làm fail build.

### 10.3. Quy tắc đặt tên và tổ chức

- Tên file chữ thường, gạch dưới, có tiền tố loại: `wpn_spear`, `crt_mammoth`, `env_rock_moss_01`, `chr_hunter`.
- Đơn vị: 1 unit = 1 mét; trục Y hướng lên; gốc tọa độ model đặt ở chân/điểm tiếp đất.
- Tên animation thống nhất: `idle`, `walk`, `run`, `attack_charge`, `attack_stomp`, `hit`, `death`...
- File đầu ra có hash nội dung trong tên khi build (ví dụ `crt_mammoth.3f9a1c.glb`) để cache dài hạn (mục 11.3).

### 10.4. Texture

- Dùng texture 1K–2K làm điểm xuất phát cho phần lớn asset; chỉ dùng texture lớn hơn khi có lý do rõ ràng.
- Tránh dùng nhiều texture 4K cho vật thể nhỏ hoặc ở xa.
- Dùng mipmap và texture compression phù hợp với engine.
- Đóng gói kênh (channel packing): ví dụ Occlusion/Roughness/Metallic chung một texture theo chuẩn glTF.
- Dùng texture atlas và tái sử dụng material khi thích hợp để giảm bộ nhớ và draw call.

### 10.5. Geometry, LOD và scene

- Dùng LOD cho vật thể lớn hoặc dễ nhìn thấy ở nhiều khoảng cách.
- Dùng instancing cho nhiều bản sao cây, đá hoặc vật thể giống nhau.
- Dùng frustum culling; cân nhắc occlusion culling hoặc chia map thành vùng cho khu vực rừng dày.
- Gộp mesh tĩnh dùng chung material khi hợp lý để giảm draw call.
- Mesh va chạm (collision) là khối đơn giản riêng, không dùng mesh render để tính va chạm.
- Hạn chế cỏ/foliage quá dày, đổ bóng động toàn cảnh, particle và hậu kỳ quá nặng.
- Phân bổ chi tiết theo khoảng cách và tầm quan trọng; không cần mọi vật thể đều có chất lượng như nhau.
- Ánh sáng tĩnh dùng lightmap hoặc ambient occlusion bake sẵn khi có thể; chỉ một nguồn sáng chính đổ bóng động.

### 10.6. Asset register

Mọi asset dùng trong game được ghi vào `docs/ASSET_REGISTER.md` với: tên, nguồn/URL, tác giả, giấy phép, ngày tải, định dạng gốc, các bước chuyển đổi, dung lượng sau tối ưu và nơi sử dụng. Asset không có thông tin giấy phép thì không được đưa vào bản build.

## 11. Tải, cache và phân phối

### 11.1. Các giai đoạn tải

1. **Shell** (HTML, CSS, JS tối thiểu, font): hiển thị logo/màn hình tải gần như ngay lập tức.
2. **Menu chính:** chơi được menu, đổi ngôn ngữ, cài đặt trong khi phần còn lại tải ngầm.
3. **Gói khu vực/trận đấu:** tải asset cần cho map và boss đầu tiên; thanh tiến trình có phần trăm thật.
4. **Tải sau:** nhạc, khu vực tiếp theo, nội dung không cần ngay.

- Tách code theo mode (code splitting / dynamic import): code TDM và networking không nằm trong gói tải của Story Mode.
- Asset được khai báo trong **manifest** (danh sách file, dung lượng, nhóm tải) do pipeline tạo ra; loader đọc manifest để ưu tiên tải và hiển thị tiến trình chính xác.

### 11.2. Nén khi truyền tải

- Bật Brotli (hoặc gzip) trên server/CDN cho JS, CSS, JSON, WASM, glTF dạng văn bản.
- File đã nén sẵn (KTX2, ảnh, âm thanh) không cần nén lại.

### 11.3. Cache

- File có hash trong tên được phục vụ với `Cache-Control: public, max-age=31536000, immutable`.
- `index.html` và manifest không cache lâu (hoặc `no-cache`) để người chơi luôn nhận phiên bản mới.
- **[Đề xuất]** Service Worker để cache asset đã tải, giúp lần chơi sau vào gần như tức thì; cần cơ chế xóa cache cũ khi có phiên bản mới.

### 11.4. Hosting và phân phối

- Host file tĩnh trên CDN có điểm phân phối gần người chơi (Việt Nam, Đông Nam Á) và luôn dùng HTTPS.
- Nếu dùng WASM đa luồng (SharedArrayBuffer), trang phải được phục vụ với header cross-origin isolation (COOP/COEP); cần kiểm tra ảnh hưởng tới việc nhúng iframe trên các portal.
- Kênh phát hành (tự host, itch.io, các web game portal) cần chốt sớm vì mỗi nơi có yêu cầu riêng về dung lượng, SDK, quảng cáo và cách nhúng (mục 21).
- Có trang landing/meta Open Graph cho từng ngôn ngữ để chia sẻ link đẹp trên mạng xã hội.

## 12. Hiệu năng: ngân sách và cài đặt đồ họa

### 12.1. Ngân sách ban đầu cho prototype

Áp dụng cho máy cấu hình "trung bình" ở độ phân giải 1080p, preset Medium. Đây là ngân sách thử nghiệm, không phải bảo đảm.

| Hạng mục                                         | Mục tiêu ban đầu                                            |
| ------------------------------------------------ | ----------------------------------------------------------- |
| Thời gian hiện menu (kết nối tốt, chưa có cache) | ≤ 5 giây                                                    |
| Dung lượng tải đến lúc vào trận đầu tiên         | 15–30 MB                                                    |
| Code JS + WASM sau nén                           | ~3 MB                                                       |
| Tốc độ khung hình                                | 60 FPS; tối thiểu ổn định 30 FPS ở preset Low trên máy yếu  |
| Frame time                                       | ≤ 16,7 ms trung bình; theo dõi cả p95/p99 để phát hiện giật |
| Draw call mỗi frame                              | ≤ 300–500                                                   |
| Tam giác hiển thị mỗi frame                      | ≤ ~1 triệu                                                  |
| Bộ nhớ texture trên GPU                          | ≤ 256–512 MB                                                |
| Boss (LOD0)                                      | ~20k–50k tam giác, ≤ ~100 bone                              |
| Viewmodel vũ khí + tay                           | ~5k–15k tam giác                                            |
| Nguồn sáng đổ bóng động                          | 1 (ánh sáng chính), cascade ≤ 2–3                           |

Nếu chất lượng cần thiết vượt ngân sách, phải đo và điều chỉnh có lý do, không giảm chất lượng một cách máy móc.

### 12.2. Đo đạc hiệu năng

Theo dõi ít nhất:

- Dung lượng tải lần đầu và tổng dung lượng sau khi vào game.
- Thời gian đến lúc thấy menu và đến lúc người chơi điều khiển được nhân vật.
- FPS, frame time trung bình và p95/p99 trong khu vực rừng.
- FPS khi boss tấn công và khi có nhiều hiệu ứng.
- Mức sử dụng bộ nhớ JS heap, bộ nhớ GPU ước tính và hiện tượng mất context/tab bị treo.
- Thời gian chuyển map hoặc tải khu vực mới.
- Chất lượng hình ảnh khi giảm texture, LOD và hiệu ứng.

Không chỉ dựa vào kích thước file để kết luận asset nhẹ. Một file nhỏ vẫn có thể gây chi phí render cao; texture khi nạp lên GPU có thể tiêu tốn bộ nhớ lớn hơn nhiều so với dung lượng tải.

Kết quả đo được ghi vào `docs/PERFORMANCE_TESTS.md` kèm máy, trình duyệt, phiên bản build và preset. Có một **scene benchmark cố định** (camera chạy theo đường định sẵn) để so sánh giữa các phiên bản.

### 12.3. Preset đồ họa và tự điều chỉnh

- Ít nhất ba preset **Low / Medium / High**, điều chỉnh: độ phân giải render, giới hạn `devicePixelRatio`, chất lượng/khoảng cách bóng, khoảng cách LOD và mật độ foliage, hậu kỳ, số particle.
- Tự chọn preset ban đầu dựa trên một bài đo ngắn khi khởi động hoặc thông tin GPU; người chơi có thể đổi.
- **Dynamic resolution** (tùy chọn): tự giảm độ phân giải render khi frame time vượt ngưỡng trong thời gian dài.
- Giới hạn `devicePixelRatio` (ví dụ tối đa 1,5–2) để màn hình Retina/4K không làm GPU quá tải.

## 13. Cài đặt người chơi và accessibility

Cài đặt tối thiểu trong prototype:

- **Ngôn ngữ:** Tiếng Việt / English.
- **Điều khiển:** độ nhạy chuột, đảo trục Y, đổi phím.
- **Hình ảnh:** preset đồ họa, FOV (ví dụ 70–100°), bật/tắt rung camera và head bob (giảm say chuyển động), chế độ toàn màn hình.
- **Âm thanh:** âm lượng theo từng bus (mục 8).
- **Hiển thị:** kiểu/màu crosshair, phụ đề (bật/tắt, cỡ chữ).

Nguyên tắc accessibility:

- Thông tin quan trọng không chỉ truyền bằng màu hoặc chỉ bằng âm thanh (báo đòn có cả hình và tiếng; đội PvP phân biệt bằng hình dạng/biểu tượng, không chỉ màu).
- Chữ UI đủ lớn, độ tương phản tốt trên nền rừng.
- Menu điều hướng được bằng bàn phím.

## 14. Lưu dữ liệu, telemetry và quyền riêng tư

### 14.1. Lưu dữ liệu

- **Cài đặt** lưu trong `localStorage`; **tiến trình Story Mode** lưu trong IndexedDB.
- Dữ liệu lưu có **số phiên bản schema** và có migration khi cấu trúc thay đổi.
- Mọi thao tác đọc/ghi bọc trong try/catch; game vẫn chạy bình thường nếu storage bị chặn (chế độ ẩn danh, chính sách trình duyệt).
- Trình duyệt có thể xóa dữ liệu lưu cục bộ (ví dụ khi người chơi không truy cập trong một thời gian hoặc hết dung lượng); dùng `navigator.storage.persist()` khi phù hợp và cân nhắc cloud save khi có hệ thống tài khoản.

### 14.2. Telemetry hiệu năng

- Thu thập số liệu ẩn danh để quyết định ngân sách đồ họa: thời gian tải, phân bố FPS/frame time, preset, loại GPU/trình duyệt, lỗi runtime.
- Không thu thập dữ liệu cá nhân không cần thiết; không đặt thông tin cá nhân trong URL.

### 14.3. Quyền riêng tư và pháp lý

- Có trang chính sách quyền riêng tư bằng cả hai ngôn ngữ; telemetry, báo lỗi và quảng cáo (nếu có) chỉ bật theo đúng yêu cầu đồng ý của thị trường phát hành.
- Tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành tại Việt Nam và các thị trường khác nếu có người chơi ở đó (ví dụ GDPR với EU).
- Phát hành game online (đặc biệt có PvP, thanh toán hoặc tài khoản) tại Việt Nam có thể cần giấy phép theo quy định hiện hành; cần tìm hiểu trước khi phát hành thương mại.

## 15. Multiplayer — nguyên tắc cho Team Deathmatch

Phần này là định hướng kiến trúc để code prototype không cản trở PvP sau này; chưa triển khai trong prototype.

- **Server authoritative:** server quyết định vị trí, sát thương, trúng/trượt và điểm số. Client chỉ gửi input, không gửi kết quả.
- **Dùng chung code simulation** giữa client và server (Node.js/TypeScript), nhờ kiến trúc ở mục 9.3.
- **Client-side prediction** cho chuyển động của chính người chơi; **nội suy (interpolation)** cho người chơi khác; đối chiếu và sửa khi server trả trạng thái.
- **Lag compensation:** server "tua lại" vị trí đối thủ theo độ trễ của người bắn khi kiểm tra trúng, có giới hạn tối đa để người có ping cao không gây bất công cho người khác. Cận chiến cần được thử nghiệm riêng vì khó hơn hitscan.
- **Giao thức:** WebSocket cho prototype đầu; cân nhắc WebTransport hoặc WebRTC DataChannel (không tin cậy, không thứ tự) khi cần giảm độ trễ. Có thể đánh giá framework phòng chơi như Colyseus.
- **Tick rate server:** khoảng 20–30 Hz là điểm xuất phát; gửi delta trạng thái, nén gói tin.
- **Chống gian lận:** validate input (tốc độ di chuyển, tốc độ tấn công, tầm đánh), rate limit, không tin dữ liệu từ client.
- **Hạ tầng:** đặt server gần người chơi mục tiêu (ví dụ khu vực Singapore cho Việt Nam/Đông Nam Á); đo ping thực tế trước khi chọn.
- Xử lý mất kết nối, kết nối lại, người chơi rời trận và host migration (nếu không dùng dedicated server).

## 16. Kiểm thử và quy trình chất lượng

- **Unit test** (Vitest) cho lớp simulation: sát thương, máu, trạng thái vũ khí, AI boss, i18n key.
- **Smoke test** (Playwright) trên trình duyệt: mở trang, vào menu, đổi ngôn ngữ, vào trận, không có lỗi console.
- **CI** (ví dụ GitHub Actions) chạy trên mỗi commit/PR: type-check, lint, test, kiểm tra i18n key, build, báo cáo dung lượng bundle và asset.
- **Ngân sách dung lượng** trong CI: cảnh báo hoặc fail khi bundle/asset vượt ngưỡng đã định.
- **Preview deploy** cho mỗi nhánh để test trên nhiều máy/trình duyệt.
- **Playtest** định kỳ trên máy tham chiếu, ghi nhận cả cảm giác điều khiển lẫn số liệu hiệu năng.

## 17. Nguồn asset và công cụ

### 17.1. Nguồn asset cần khảo sát

| Nguồn                                              | Dùng để tìm                                                                        | Lưu ý                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [Fab](https://www.fab.com/)                        | Bộ môi trường, cây cối, đá, nhân vật, động vật, vũ khí, animation và VFX           | Kiểm tra engine hỗ trợ, định dạng xuất, chất lượng, yêu cầu rig/LOD và giấy phép của từng asset.          |
| [Poly Haven](https://polyhaven.com/)               | Texture PBR, HDRI, một số model 3D và vật liệu môi trường                          | Tài nguyên trên trang được công bố theo CC0; vẫn nên kiểm tra thông tin giấy phép cụ thể tại nguồn.       |
| [Sketchfab](https://sketchfab.com/)                | Tham khảo hình thể, scan, động vật, sọ và công cụ tiền sử; một số model có thể tải | Mỗi model có thể có giấy phép khác nhau. Chỉ tải và sử dụng theo đúng điều khoản từng model.              |
| [Mixamo](https://www.mixamo.com/)                  | Thử rig và animation nhân vật người hai chân                                       | Không phải giải pháp animation chính cho động vật bốn chân như voi ma mút; kiểm tra điều khoản hiện hành. |
| [Unity Asset Store](https://assetstore.unity.com/) | Gói asset khi chọn Unity                                                           | Chỉ hữu ích nếu dùng Unity; kiểm tra điều khoản từng gói.                                                 |
| [Blender](https://www.blender.org/)                | Tạo/chỉnh sửa model, UV, rig, animation, chỉnh asset tải về                        | Blender là công cụ sản xuất nội dung 3D, không phải marketplace.                                          |

### 17.2. Từ khóa tìm kiếm đề xuất

**Môi trường:**

- `prehistoric environment`
- `jungle biome`
- `tropical forest game assets`
- `forest ground PBR`
- `mossy rocks`
- `cave environment`
- `fallen tree game asset`

**Vũ khí:**

- `stone age weapons`
- `primitive spear game asset`
- `stone axe 3D model`
- `primitive bow and arrow`
- `tribal weapon game prop`

**Động vật/boss:**

- `woolly mammoth rigged animated`
- `Smilodon 3D model rigged`
- `prehistoric creature animation`
- `quadruped locomotion animation`

**Nhân vật:**

- `prehistoric hunter character rigged`
- `tribal warrior game character`
- `first person arms rigged`
- `first person weapon animation`

**Âm thanh:**

- `forest ambience`
- `creature roar sound effects`
- `primitive weapon impact sfx`
- `tribal drums music`

### 17.3. Checklist trước khi tải hoặc mua asset

- Có giấy phép cho phép dùng trong game thương mại dự kiến hay không?
- Có được đóng gói asset bên trong game web theo hình thức dự định không? (Asset trong game web có thể bị người dùng tải ra; một số giấy phép yêu cầu bảo vệ file.)
- Có model gốc để chỉnh sửa không?
- Có thể xuất thành glTF/GLB không, hoặc có pipeline chuyển đổi đáng tin cậy không?
- Có rig, animation và skeleton phù hợp với nhu cầu không?
- Có LOD hay có thể tạo LOD không?
- Texture có độ phân giải và số lượng phù hợp không?
- Có thể nén texture và geometry không?
- Asset có tương thích với engine web đã chọn không?
- Các asset có cùng phong cách nghệ thuật và tỷ lệ không?

Không chọn asset chỉ dựa trên ảnh quảng cáo. Trước khi mua nhiều gói, cần nhập thử một vài asset vào prototype, cho qua pipeline và đo hiệu năng.

## 18. Phạm vi prototype — vertical slice

### 18.1. Nguyên tắc làm prototype

Mục tiêu đầu tiên không phải tạo một khu rừng lớn hoặc có nhiều model đẹp nhất, mà là chứng minh rằng người chơi có thể cầm vũ khí nguyên thủy chiến đấu với một sinh vật tiền sử trong môi trường 3D đủ rõ ràng, mượt và tải được trên trình duyệt.

Dùng blockout, hình khối đơn giản hoặc asset tạm thời để thử gameplay. Chỉ thay bằng model hoàn thiện sau khi bố cục, điều khiển và vòng lặp chiến đấu hoạt động tốt. Asset tạm vẫn đi qua pipeline thật (mục 10) để đánh giá đúng khả năng tương thích.

### 18.2. Nội dung bắt buộc

- Một scene rừng nhỏ hoặc đấu trường tự nhiên.
- Camera FPS và điều khiển cơ bản, pointer lock, menu tạm dừng.
- Một vũ khí hoạt động hoàn chỉnh: giáo với đâm + ném.
- Một kẻ địch nhỏ và một boss (đề xuất voi ma mút nếu tìm được model có rig/animation phù hợp).
- Va chạm, phản hồi khi tấn công và âm thanh cơ bản (đòn đánh, báo đòn boss, môi trường).
- Một vòng lặp chiến đấu có thể chơi từ đầu đến khi thắng/thua hoặc hạ boss.
- UI tối thiểu: máu người chơi, trạng thái vũ khí, máu boss — đầy đủ hai ngôn ngữ.
- Menu cài đặt tối thiểu (mục 13) và ít nhất hai preset đồ họa.
- Tải theo giai đoạn, ít nhất một lượt đo hiệu năng trên máy tham chiếu.

### 18.3. Chưa cần làm ở giai đoạn đầu

- Open world lớn.
- Nhiều boss cùng lúc.
- Hệ thống crafting hoặc progression phức tạp.
- Nhiều phe phái, nhiều nhân vật và nhiều loại vũ khí ngay lập tức.
- Team Deathmatch, networking và tài khoản người chơi.
- Hỗ trợ mobile/cảm ứng.
- Cây cỏ cực dày hoặc hiệu ứng điện ảnh gây áp lực lớn lên GPU.

### 18.4. Tiêu chí hoàn thành prototype

- Người chơi di chuyển và tấn công ổn định bằng camera FPS trên các trình duyệt trong ma trận kiểm thử.
- Vũ khí có animation, va chạm, âm thanh và phản hồi rõ ràng.
- Boss có thể di chuyển, báo đòn, tấn công, nhận sát thương và bị đánh bại.
- Scene đạt ngân sách ở mục 12.1 trên máy tham chiếu, hoặc có số liệu và lý do rõ ràng nếu chưa đạt.
- Đổi ngôn ngữ Việt/Anh hoạt động ở mọi màn hình, không lỗi font.
- Game tạm dừng đúng khi mất focus/thoát pointer lock; không có lỗi console trong smoke test.
- Có thể thay asset thử nghiệm bằng asset khác mà không phải viết lại hệ thống gameplay cốt lõi.
- Quy trình nhập asset, nén và kiểm tra giấy phép được ghi lại đủ để lặp lại.

### 18.5. Checklist vertical slice

- [ ] Repo, build, lint, test, CI và deploy preview hoạt động. *(build/lint/test xong; còn git, CI, deploy preview)*
- [x] Hệ thống i18n với `vi.json` / `en.json` và kiểm tra key (unit test; chạy trong CI khi có CI).
- [x] Debug overlay (FPS, frame time, draw call, bộ nhớ).
- [x] Game loop bước cố định, simulation tách khỏi render.
- [x] Camera góc nhìn thứ nhất, di chuyển, pointer lock, điều khiển chuột.
- [x] Menu chính, menu tạm dừng, menu cài đặt.
- [x] Một vũ khí có model, animation, va chạm, âm thanh và phản hồi khi đánh trúng. *(giáo blockout: đâm + ném; model thật sau)*
- [x] Một kẻ địch nhỏ và một boss có thể phát hiện/đối đầu, báo đòn, tấn công, nhận sát thương và chết. *(boss: ma mút tự dựng bằng Blender, có thể thay bằng model trả phí sau — xem `docs/BOSS_CANDIDATES.md`)*
- [x] Một khu vực nhỏ có cây, đá và vật cản; có thể bắt đầu bằng blockout.
- [x] Một vòng chơi hoàn chỉnh từ lúc bắt đầu đến thắng/thua.
- [x] Pipeline asset chạy bằng một lệnh; asset có hash, nén Meshopt/Draco và KTX2.
- [ ] Tải theo giai đoạn có thanh tiến trình; giải phóng tài nguyên khi thoát trận.
- [x] Preset đồ họa Low/Medium/High và giới hạn `devicePixelRatio`. *(hiện chỉ đổi độ phân giải render; bóng/foliage/hậu kỳ thêm khi có)*
- [ ] Đo thời gian tải, FPS/frame time và bộ nhớ trên máy và trình duyệt tham chiếu; ghi vào `PERFORMANCE_TESTS.md`.
- [x] Ghi giấy phép, nguồn tải, định dạng gốc và các bước chuyển đổi của từng asset vào `ASSET_REGISTER.md`.

## 19. Lộ trình phát triển đề xuất

### Giai đoạn 0 — Nền móng dự án

- Khởi tạo repo, TypeScript, Vite, ESLint/Prettier, Vitest, Playwright, CI.
- Khung i18n Việt/Anh, chọn font hỗ trợ tiếng Việt.
- Game loop bước cố định, cấu trúc simulation/render, debug overlay.
- Deploy preview lên hosting tĩnh để test trên nhiều máy ngay từ đầu.

### Giai đoạn 1 — Rủi ro kỹ thuật và pipeline tối thiểu

- ~~Thử engine đề xuất trong khoảng 1 tuần~~ — xong, đã chốt Babylon.js.
- Xác minh camera FPS, pointer lock, nhập model có rig, animation, va chạm và vật lý.
- Chọn thử một asset vũ khí, một model tay/nhân vật, một model boss và một bộ môi trường; không mua/tải hàng loạt.
- Dựng pipeline glTF-Transform + KTX2, kiểm tra giấy phép, LOD và nén.
- Đo tải lần đầu, FPS/frame time và bộ nhớ trên máy tham chiếu; chốt engine và phong cách đồ họa.

### Giai đoạn 2 — Combat prototype

- Hoàn thiện di chuyển, camera FPS và menu tạm dừng/cài đặt.
- Tích hợp giáo (đâm + ném) với game feel ở mục 5.4.
- Tích hợp kẻ địch nhỏ, sau đó là boss cùng animation và báo đòn.
- Thêm hit detection, máu, sát thương, âm thanh cơ bản và trạng thái thắng/thua.

### Giai đoạn 3 — Environment prototype

- Tạo map nhỏ bằng blockout trước.
- Kiểm tra đường đi, tầm nhìn, cover, khoảng cách chiến đấu và kích thước boss.
- Thay blockout bằng một bộ asset môi trường nhất quán đã qua pipeline.
- Hoàn thiện `ART_GUIDE.md` và `ASSET_REGISTER.md`.
- Thêm instancing, LOD, preset đồ họa và tải tài nguyên theo giai đoạn.
- Chỉ mở rộng số lượng asset sau khi scene mẫu đáp ứng mục tiêu hiệu năng.

### Giai đoạn 4 — Kiểm thử và quyết định phạm vi

- Đo tải lần đầu, bộ nhớ, FPS/frame time và thời gian chuyển khu vực trên toàn bộ ma trận kiểm thử.
- Điều chỉnh chất lượng texture, geometry, bóng và foliage.
- Playtest với người chơi bên ngoài (cả người chơi Việt và quốc tế).
- Kiểm tra asset có thể thay thế/nâng cấp mà không phá gameplay.
- Quyết định quy mô map, kênh phát hành và phạm vi Story Mode/TDM.

### Giai đoạn 5 — Team Deathmatch

- Thiết kế map theo luồng giao tranh.
- Chốt gameplay và cân bằng vũ khí cho PvP.
- Dựng server authoritative dùng chung code simulation; prediction, interpolation, lag compensation (mục 15).
- Kiểm thử nhiều người chơi với điều kiện mạng thực tế (độ trễ, mất gói).

## 20. Cấu trúc thư mục gợi ý

Cấu trúc có thể điều chỉnh theo engine và framework đã chốt:

```text
wildborn-web-game/
├── README.md
├── docs/
│   ├── SPECIFICATION.md
│   ├── ART_GUIDE.md
│   ├── ASSET_REGISTER.md
│   ├── PERFORMANCE_TESTS.md
│   └── GAMEPLAY_NOTES.md
├── public/
│   └── assets/              # asset đã tối ưu (đầu ra của pipeline)
│       ├── environment/
│       ├── characters/
│       ├── creatures/
│       ├── weapons/
│       ├── animations/
│       ├── textures/
│       ├── audio/
│       └── ui/
├── src/
│   ├── main.ts              # khởi động, phát hiện tính năng, màn hình tải
│   ├── core/                # game loop, thời gian, event bus, loader, manifest
│   ├── sim/                 # simulation thuần, không phụ thuộc render (dùng lại cho server)
│   │   ├── player/
│   │   ├── combat/
│   │   └── creatures/
│   ├── render/              # scene, camera, model, animation, VFX
│   ├── input/               # pointer lock, bàn phím, gamepad, rebinding
│   ├── audio/
│   ├── maps/
│   ├── ui/                  # HUD, menu (HTML/CSS overlay)
│   ├── i18n/                # vi.json, en.json, hàm t()
│   ├── config/              # thông số vũ khí, sinh vật, preset đồ họa (data-driven)
│   ├── storage/             # lưu cài đặt, tiến trình, migration
│   └── debug/               # overlay, tham số URL dev
├── tests/
│   ├── unit/
│   └── e2e/
└── tools/
    └── asset-pipeline/      # script glTF-Transform, KTX2, tạo manifest
```

- File nguồn dung lượng lớn (Blender, texture gốc, file asset mua về) lưu trong kho riêng hoặc Git LFS, không đưa vào gói tải của người chơi.
- Khi làm TDM, thêm `server/` và chuyển `src/sim/` thành package dùng chung giữa client và server.

## 21. Những quyết định còn mở

- [x] Chốt tên game: `WILDBORN`.
- [ ] Kiểm tra nhãn hiệu và tên miền cho `WILDBORN`.
- [x] Chốt ngôn ngữ trong game: Tiếng Việt và English.
- [x] Chọn engine: Babylon.js.
- [ ] Trước khi phát hành: tự host bộ giải mã KTX2 (hiện tải từ `cdn.babylonjs.com`), xem ghi chú trong `src/render/loaders.ts`.
- [x] Chọn phong cách đồ họa: stylized/semi-realistic.
- [ ] Xác nhận phạm vi nền tảng — **[Đề xuất]** desktop trước, mobile ngoài phạm vi prototype.
- [ ] Chốt cấu hình máy tham chiếu và ma trận trình duyệt.
- [ ] Chốt ngân sách dung lượng tải lần đầu dựa trên thử nghiệm thực tế.
- [ ] Chọn model boss đầu tiên có rig và animation phù hợp. *(tạm dùng ma mút tự dựng `crt_mammoth`; chốt lại khi có ngân sách)*
- [ ] Xác định ngân sách mua asset và quy tắc ghi lại giấy phép.
- [ ] Chốt thông số vũ khí và vòng lặp combat.
- [ ] Thiết kế cốt truyện và vòng lặp chơi của Story Mode.
- [ ] Chọn kênh phát hành, hosting/CDN và mô hình kinh doanh (miễn phí, quảng cáo, trả phí...).
- [ ] Tìm hiểu yêu cầu pháp lý khi phát hành game online tại Việt Nam.
- [ ] Thiết kế kiến trúc networking cho Team Deathmatch.
- [x] Thiết lập quy trình đo FPS: chế độ `?bench` + debug overlay (F3), ghi kết quả vào `docs/PERFORMANCE_TESTS.md`.

## 22. Danh sách nguồn tham khảo

### Marketplace và asset

- Fab: https://www.fab.com/
- Poly Haven: https://polyhaven.com/
- Poly Haven license: https://polyhaven.com/license
- Sketchfab: https://sketchfab.com/
- Sketchfab licenses: https://sketchfab.com/licenses
- Mixamo: https://www.mixamo.com/
- Adobe Mixamo FAQ: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- Unity Asset Store: https://assetstore.unity.com/
- Blender: https://www.blender.org/

### Engine và kỹ thuật web 3D

- Babylon.js: https://www.babylonjs.com/
- Babylon.js documentation: https://doc.babylonjs.com/
- Babylon.js glTF documentation: https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/
- PlayCanvas: https://playcanvas.com/
- PlayCanvas engine: https://developer.playcanvas.com/
- Three.js: https://threejs.org/
- MDN WebGL best practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

### Pipeline asset

- glTF-Transform: https://gltf-transform.dev/
- KTX-Software: https://github.com/KhronosGroup/KTX-Software
- glTF Validator: https://github.com/KhronosGroup/glTF-Validator
- meshoptimizer: https://github.com/zeux/meshoptimizer
- Khronos glTF / Draco overview: https://www.khronos.org/news/press/khronos-announces-gltf-geometry-compression-extension-google-draco

### Trình duyệt, input và âm thanh

- MDN Pointer Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- MDN Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN Web Audio API best practices: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- MDN Gamepad API: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API
- MDN Fullscreen API: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API

### Game loop và networking

- Gaffer On Games — Fix Your Timestep: https://gafferongames.com/post/fix_your_timestep/
- Gabriel Gambetta — Fast-Paced Multiplayer: https://www.gabrielgambetta.com/client-server-game-architecture.html
- Valve — Source Multiplayer Networking: https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
- Colyseus: https://colyseus.io/

---

## Tóm tắt định hướng

Xây dựng **WILDBORN** — một game FPS tiền sử chạy trên trình duyệt desktop, có Story Mode săn boss và Team Deathmatch, hỗ trợ Tiếng Việt và English ngay từ prototype. Ưu tiên dựng nền móng kỹ thuật vững (TypeScript, simulation tách khỏi render, game loop bước cố định, i18n, debug overlay, CI), sau đó làm một vertical slice nhỏ gồm một khu vực, giáo và một boss. Dùng asset có giấy phép rõ ràng, đi qua pipeline glTF/Meshopt/KTX2 có thể lặp lại; tải theo giai đoạn, cache dài hạn và đo hiệu năng theo ngân sách cụ thể. Không mở rộng map, số lượng asset hay làm PvP trước khi gameplay cốt lõi và hiệu năng đã được đo kiểm.
