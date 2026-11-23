# Bàn giao Chạm cho Antigravity

Ngày bàn giao: 23/11/2026, giờ Việt Nam. Version: 0.7.1.

Đây là toàn bộ mã nguồn web Chạm mới nhất từ bản local đã kiểm tra. Thư mục này là nơi tiếp tục phát triển sau bàn giao. Đã giữ nguyên mã ứng dụng, tests, giấy phép và launcher. Không cần dựng lại dự án từ đầu.

## Mục tiêu và yêu cầu của chủ dự án

Chạm là giao diện web không chính thức kết nối tài khoản Locket thật, tập trung chụp/chỉnh ảnh, frame photobooth và video. Thiết kế mong muốn: đơn giản, gọn theo cảm hứng Apple. Ngôn ngữ giao diện: tiếng Việt.

Chủ dự án đã từng yêu cầu public, GitHub và Vercel, nhưng yêu cầu đang có hiệu lực là làm local, chưa cần push/deploy. Chỉnh ảnh bằng AI đã chuyển từ OpenAI sang Gemini. Không khôi phục nhà cung cấp cũ.

Hướng dài hạn từng được nhắc tới là IPA cài bằng AltStore/Sideloadly. Bản bàn giao hiện chỉ có web; chưa có native iOS project, file IPA, signing hoặc quy trình build iOS.

## Các tính năng đã có

| Nhóm | Trạng thái |
| --- | --- |
| Locket | Đăng nhập email/mật khẩu, đăng xuất, bạn bè, bảng tin và lịch sử chia trang; chọn một bạn vẫn tải nhiều ảnh cũ |
| Gửi ảnh | Caption, người nhận; chỉ báo thành công khi có moment ID từ Locket |
| Ảnh đầy đủ frame | Trước khi đăng, đặt ảnh vào nền vuông 1200 × 1200, giữ tỷ lệ và lề an toàn; file tải về vẫn giữ dải/lưới gốc |
| Camera/Digital | Camera trước/sau; màu Gốc, CCD, Nắng, Mono, hạt ảnh, dấu ngày |
| Photobooth ảnh | 3/4 tấm, chụp cách nhau 3 giây, dải/lưới; có thể chọn ảnh từ thư viện |
| Frame | Tối giản, Thư tay, Chấm bi, Sao đêm, Vé kỷ niệm, Vườn xanh, Thương mến; Vườn xanh có ô oval |
| Chỉnh từng ô | Kéo/căn, zoom, đổi thứ tự, thay ảnh, chụp lại riêng một ô |
| Khung cá nhân | Tên, lời nhắn, ngày; lưu tối đa 12 mẫu trên thiết bị theo tài khoản |
| Video đơn | MP4 nguồn tối đa 2 phút/40 MB; chọn đoạn tối đa 15 giây, ảnh bìa và tắt tiếng |
| Video đăng Locket | Chuẩn hóa H.264/AAC, vuông 720 × 720, poster WebP; người dùng đã xác nhận đăng video thật thành công ở phiên trước |
| Photobooth động | Ghép 3/4 clip, tổng nguồn 40 MB; tối đa 10 giây và không dài hơn clip ngắn nhất; frame, dải/lưới, đổi thứ tự, chọn tiếng từ một clip |
| Nháp | IndexedDB cho ảnh, crop, frame, video nguồn/đã chuẩn hóa, caption/người nhận; tách theo tài khoản |
| Gemini | Prompt sửa ảnh, trả về PNG/JPEG/WebP; trình duyệt đổi sang WebP trước khi dùng; chỉ tài khoản chủ app được dùng key |
| Công cụ AI | Thanh kéo trước/sau, giữ gốc/dùng ảnh AI, lưu tối đa 20 prompt yêu thích |
| Local launcher | start-local.cmd tự build, kiểm tra máy chủ, chạy nền và mở trình duyệt; stop-local.cmd dừng đúng instance do launcher của thư mục này quản lý |
| UID | Mục Tài khoản hiển thị UID Locket sau khi đăng nhập |

## Cấu trúc và luồng dữ liệu

Không có React, Vite hoặc package runtime bên ngoài. JavaScript thuần, CSS và các module máy chủ dùng Node built-ins. Các module trình duyệt dùng namespace window.Cham*; thứ tự script được khai báo ở public/index.html.

| Tệp/nhóm | Vai trò |
| --- | --- |
| public/app.js | Điều hướng, đăng nhập, bạn bè/lịch sử, hộp đăng ảnh và API callbacks |
| public/studio.js | Camera, chụp/ghép ảnh, preset màu, draft ảnh và điều phối AI |
| public/frames.js | Hình học và trang trí frame bằng canvas |
| public/photo-editor.js, edit-core.js | Chỉnh từng ô, phép crop và chuẩn hóa ảnh Gemini về WebP |
| public/studio-tools.js | Chữ/ngày trên frame, mẫu khung, prompt yêu thích, thanh so sánh |
| public/locket-image.js | Đặt đầy đủ ảnh vào ô vuông trước khi đăng |
| public/video.js, motion-frame.js | Giao diện chỉnh video, nháp video và lớp frame PNG trong suốt cho ghép động |
| public/drafts.js | IndexedDB cho nháp; localStorage chỉ cho tùy chọn nhỏ |
| worker/index.mjs | API Locket, xác thực, cookie, upload, lịch sử và API Gemini |
| scripts/video.mjs | FFmpeg/FFprobe, trim/poster/mute và ghép clip; chỉ chạy trên máy chủ local |
| scripts/dev.mjs | HTTP server local, đọc .env.local và ghép Worker API với FFmpeg API |
| scripts/start-local.mjs | Launcher, log/PID/instance và xác minh máy chủ trước khi tái sử dụng/dừng |
| scripts/build.mjs | Nhúng 16 asset frontend vào dist/server/index.js |
| api/index.mjs, vercel.json | Adapter/cấu hình Vercel có sẵn; chưa hỗ trợ FFmpeg video trên Vercel |
| tests/ | 55 bài kiểm tra baseline, gồm upstream mock và xử lý FFmpeg thật |

Ảnh: canvas → WebP → xem lại → căn vuông nếu đăng → Worker → Firebase Storage của Locket → postMomentV2.

Video: MP4 → API local FFmpeg → MP4 vuông + poster WebP → xem lại → /api/videos → locket-video Storage → postMomentV2 có video_url/thumbnail_url.

AI: WebP + prompt → /api/ai/edit có xác thực → Gemini generateContent → ảnh inline PNG/JPEG/WebP → browser chuẩn hóa WebP → so sánh → chủ dự án chọn dùng. Không tự đăng ảnh AI.

## Chạy và kiểm tra

Cần Node.js 22.x, FFmpeg và FFprobe trong PATH. Các công cụ FFmpeg đã được cài trên máy hiện tại, nhưng terminal/IDE mở từ trước lúc cài có thể cần khởi động lại để nhận PATH. Không cần npm install: package.json không có dependencies.

```powershell
npm run check
npm test
npm run build
```

Kiểm tra bản bàn giao trên cổng riêng để không đụng app của chủ dự án:

```powershell
$env:CHAM_PORT='4175'
npm run dev
```

Mở http://127.0.0.1:4175, dừng máy chủ thử bằng Ctrl+C khi xong. Nháp phụ thuộc origin/cổng, nên nháp tại 4173 không xuất hiện tại 4175.

Để dùng launcher ở cổng mặc định, mở start-local.cmd. Nếu 4173 thuộc một bản Chạm khác, launcher không tự dừng bản đó. Chỉ chuyển sang dùng bản bàn giao ở 4173 khi chủ dự án muốn; dùng stop-local.cmd của đúng thư mục đang chạy trước.

## Cấu hình máy chủ

Bản bàn giao cung cấp .env.example. Tạo .env.local trong thư mục này hoặc đặt biến môi trường máy chủ:

| Biến | Ý nghĩa |
| --- | --- |
| CHAM_SESSION_SECRET | Chuỗi ngẫu nhiên tối thiểu 32 byte, dùng giữ phiên qua các lần khởi động; nếu để trống, server sinh khóa tạm và restart sẽ cần đăng nhập lại |
| GEMINI_API_KEY | Key Google Gemini ở máy chủ |
| GEMINI_IMAGE_MODEL | Mặc định gemini-2.5-flash-image |
| CHAM_AI_OWNER_UID | UID Locket được phép dùng AI; xem trong mục Tài khoản |

Giá trị thật không đi kèm bản bàn giao hoặc ZIP. Bản local hiện tại trên máy có cấu hình riêng trong .env.local của nó; không đọc file đó hoặc đưa vào ngữ cảnh agent. Khi cần dùng AI ở workspace mới, hướng dẫn chủ dự án tự cấu hình trên máy và không gửi key trong chat. Khi thay cấu hình, dừng/khởi động lại server. Biến môi trường có sẵn được ưu tiên hơn .env.local.

Cookie chứa phiên mã hóa, HttpOnly, Secure, SameSite=Strict. API chỉ dùng quyền tài khoản đăng nhập; giữ kiểm tra Origin, giới hạn kích thước và xác nhận moment ID. Không đưa token Firebase/Locket vào JavaScript trình duyệt hoặc log.

## Những gì đã kiểm chứng và giới hạn của bằng chứng

- Baseline trước bàn giao: check, 55 tests và build thành công.
- Tests máy chủ dùng mock cho Locket/Gemini: không phải bằng chứng mọi API upstream hiện luôn hoạt động.
- Video đăng thật đã được chủ dự án xác nhận ở phiên trước. Bộ trim/ghép động mới có kiểm tra FFmpeg thật và trình duyệt bằng media tổng hợp; chưa tự đăng bộ clip thử lên Locket.
- Gemini: key thật đã đọc được metadata model, HTTP 200. Chưa gọi tạo ảnh trả phí trong quá trình kiểm tra; quota/thanh toán và chất lượng ảnh thật vẫn cần chủ dự án thử khi muốn.
- Đã kiểm tra ảnh PNG mô phỏng → WebP → dùng ảnh AI trong Studio, thanh so sánh, template, zoom/căn, thay riêng ô, lưu/khôi phục nháp, tách tài khoản và bố cục 390px.
- Camera vật lý và luồng chụp lại một ô phụ thuộc quyền camera và thiết bị; không có kiểm thử tự động cho camera thật.

## Giới hạn cần giữ rõ

- Locket API không chính thức; có thể thay đổi, bị giới hạn hoặc yêu cầu App Check. Chưa hỗ trợ đăng nhập OTP/số điện thoại.
- Video chuẩn hóa/ghép cần FFmpeg trên máy chủ local. Không khẳng định deploy Vercel sẽ xử lý được video.
- Nháp lưu tại trình duyệt, không đồng bộ thiết bị và có thể mất khi xóa dữ liệu trình duyệt.
- Rate limit đăng nhập/AI nằm trong bộ nhớ, best-effort; chưa có quota dùng chung bền vững.
- Sau lỗi đăng không chắc chắn, kiểm tra trong Locket trước khi thử lại để tránh trùng bài.
- Nội dung không thương mại theo giấy phép giao thức đi kèm. Giữ thông báo bản quyền và kiểm tra quyền trước khi thay đổi mục đích sử dụng.

## Việc tiếp nhận đề nghị

1. Đọc AGENTS.md, tài liệu này và các entrypoint liên quan.
2. Chạy check/tests/build, báo lại kết quả thực tế và vấn đề nếu có.
3. Tóm tắt hiểu biết và các giới hạn cho chủ dự án bằng tiếng Việt.
4. Chờ yêu cầu tính năng tiếp theo; không tự redesign, đổi framework, push/deploy hoặc xây IPA.

Tài liệu Antigravity về workspace rules: https://antigravity.google/docs/rules/ .
