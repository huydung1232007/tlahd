# Chạm — Locket theo cách của bạn

Giao diện web không chính thức cho tài khoản Locket thật. Thiết kế cảm hứng Apple; giao thức máy chủ chuyển thể từ hmk8386/locket.js.

## Sử dụng

1. Chọn Đăng nhập Locket, nhập email và mật khẩu tài khoản Locket của bạn.
2. Chọn Đăng ảnh lên Locket, chọn hoặc chụp ảnh, nhập caption.
3. Chọn Tất cả bạn bè Locket hoặc Chỉ mình tôi trên Locket, rồi gửi.
4. Chỉ báo thành công khi Locket trả về mã bài đăng. Nếu kết nối gián đoạn, kiểm tra trong Locket trước khi gửi lại để tránh đăng trùng.

Chỉ hỗ trợ email/mật khẩu. Chưa hỗ trợ số điện thoại/OTP, chat hoặc chỉnh sửa hồ sơ. API không chính thức có thể bị thay đổi, yêu cầu App Check hoặc giới hạn.

## Chạy và build

Node.js 22 trở lên, không cần cài thư viện. Chạy npm run dev rồi mở http://127.0.0.1:4173. Máy chủ local tự sinh khóa phiên trong bộ nhớ mỗi lần chạy; khởi động lại sẽ cần đăng nhập lại. Cookie bảo mật cần HTTPS hoặc hỗ trợ secure cookies trên localhost.

npm run build tạo máy chủ tự chứa để chạy local. Khi deploy Vercel, public/ được phục vụ trên CDN và api/index.mjs chạy API Node.js với cùng logic trong worker/index.mjs.

## Triển khai Vercel

Import repository trên Vercel, giữ Framework Preset là Other. vercel.json đã cấu hình build, thư mục public, security headers, rewrite API và thời gian chạy tối đa 300 giây.

Thêm biến trong Project Settings → Environment Variables, không commit giá trị thật:

- CHAM_SESSION_SECRET: bắt buộc, chuỗi ngẫu nhiên tối thiểu 32 byte để mã hóa phiên đăng nhập.
- GEMINI_API_KEY: tùy chọn, key phía máy chủ cho chỉnh ảnh AI.
- CHAM_AI_OWNER_UID: UID Locket duy nhất được dùng key AI.

Sau khi đổi biến môi trường cần redeploy. Khi chuyển tên miền, người dùng đăng nhập Locket lại. Repo không chứa key, mật khẩu, phiên đăng nhập hoặc ảnh người dùng.

Vercel giới hạn body mặc định 4.5 MB; frontend chặn yêu cầu vượt 4 MB trước khi gửi. Giới hạn đăng nhập và AI trong bộ nhớ là best-effort theo từng instance.

## Phiên và quyền riêng tư

Mật khẩu chỉ dùng cho yêu cầu đăng nhập Firebase của Locket, không lưu trong database, localStorage hay log. Cookie __Host-cham_locket chứa refresh token mã hóa AES-GCM, có HttpOnly, Secure, SameSite=Strict và thời hạn 7 ngày. Mỗi trình duyệt có phiên riêng; frontend không đọc được token. Đăng xuất xóa cookie trên trình duyệt đó.

POST yêu cầu JSON cùng origin, có giới hạn kích thước và loại ảnh. Ảnh được chuyển WebP trong trình duyệt, gửi qua máy chủ tới Firebase Storage của Locket rồi tạo moment thật. Không lưu ảnh trong database của Chạm. Chỉ nhận dữ liệu ảnh, không nhận URL tải ảnh tùy ý.

Bảng tin, lịch sử và bạn bè lấy từ Locket, không trộn dữ liệu mẫu. Bảng tin đọc lịch sử ảnh được chia sẻ trong `history/<viewer uid>/entries`, mỗi trang 30 ảnh, có nút Tải thêm ảnh. Chọn từng bạn sẽ truy vấn lịch sử theo người gửi, vẫn trong phạm vi tài khoản người xem. Cursor dùng cả thời gian và tên tài liệu để phân trang ổn định khi ảnh trùng thời gian; được kiểm tra theo người xem và bộ lọc. Chỉ những ảnh Locket cấp quyền xem mới xuất hiện. Khi API lịch sử không khả dụng, chế độ chỉ hiện ảnh mới nhất được ghi rõ và có nút thử tải lại. Giới hạn đăng nhập theo IP trong bộ nhớ Worker chỉ là best-effort theo isolate.

## Kiểm tra

npm run check kiểm tra cú pháp. npm test kiểm tra luồng máy chủ bằng mock upstream: đăng nhập, cookie, tách phiên, CSRF, đăng xuất, đăng ảnh và lỗi upstream. Mock không thay thế thử nghiệm với tài khoản Locket thật.

## Bản quyền

Required Notice: Copyright Hmk8386 (https://github.com/hmk8386)

Phần giao thức dựa trên https://github.com/hmk8386/locket.js . PolyForm Noncommercial License 1.0.0: https://polyformproject.org/licenses/noncommercial/1.0.0/ . Xem THIRD_PARTY_NOTICES.md và LICENSE.locket.js.

## Studio v0.4

Giao diện gồm Chụp, Ảnh và Tài khoản. Digital có màu CCD, Nắng, Mono, hạt ảnh và dấu ngày. Photobooth chụp 3/4 tấm cách nhau 3 giây, hoặc ghép ảnh chọn từ thiết bị; có dải dọc, lưới 4 tấm và khung trắng/đen/xanh. Ảnh được xử lý bằng canvas trên thiết bị, chỉ gửi tới máy chủ khi chọn đăng Locket hoặc chỉnh AI.

AI dùng Gemini generateContent, mặc định gemini-2.5-flash-image. Có thể đổi model bằng GEMINI_IMAGE_MODEL. GEMINI_API_KEY và CHAM_AI_OWNER_UID chỉ nằm trong biến môi trường bí mật của máy chủ. Chỉ tài khoản Locket có UID khớp chủ app được dùng key; người dùng khác không được gọi API. GET ai/status kiểm tra quyền model bằng yêu cầu không tạo ảnh; POST ai/edit chỉ chạy khi người dùng bấm Chỉnh ảnh. Giới hạn trong bộ nhớ Worker là 5 lượt/giờ theo tài khoản; cần hạn mức chi tiêu ở nhà cung cấp để kiểm soát chi phí tổng. Ảnh AI được xem lại riêng trước khi chọn dùng. Không đăng ảnh AI tự động.


## Frame photobooth v0.5

Bảy mẫu gồm Tối giản, Thư tay, Chấm bi, Sao đêm, Vé kỷ niệm, Vườn xanh và Thương mến. Mỗi mẫu hỗ trợ dải 3/4 tấm và lưới 4 tấm; có xem trước khi chọn ảnh. Trang trí được vẽ trực tiếp bằng canvas vào ảnh WebP tải về hoặc đăng Locket, không cần API hay tải tài nguyên bên ngoài. Mẫu Vườn xanh dùng cửa sổ ảnh oval. Đổi frame giữ nguyên các ảnh gốc.


## Hiển thị đầy đủ trên Locket v0.5.1

Ảnh gửi Locket được căn giữa trong canvas vuông 1200 × 1200, giữ nguyên tỷ lệ và thêm nền trắng với lề an toàn cho góc bo tròn. Hộp xác nhận hiển thị chính ảnh vuông sẽ gửi. Áp dụng cho photobooth, digital, ảnh từ thư viện và camera. Tải ảnh trong Studio vẫn giữ nguyên file dải dọc/lưới ban đầu. Dải dài hiển thị nhỏ hơn khi nằm trong ô vuông; bố cục lưới phù hợp hơn nếu muốn từng tấm lớn.


## Video local v0.6

Chọn Video trong màn Chụp. Bản local nhận MP4 tối đa 15 giây, 40 MB, độ phân giải tối đa 4K. Máy chạy Node cần FFmpeg và FFprobe trong PATH. Máy chủ local nén H.264/AAC, giữ âm thanh nếu có, căn đủ khung trong nền vuông 720 × 720 và tạo ảnh bìa WebP. File gửi Locket phải nhỏ hơn 6 MB. Có xem lại, tải MP4 đã xử lý, caption và chọn người nhận; mặc định chỉ mình tôi. Không tự đăng khi chọn tệp.

API video dùng Firebase Storage bucket locket-video và postMomentV2 kèm video_url/thumbnail_url. Không nhận URL video bên ngoài, không công khai token Firebase. Tệp xử lý tạm được xóa sau mỗi yêu cầu; lỗi tạo moment không được báo thành công. Phần chuẩn hóa FFmpeg chỉ chạy trên server local, chưa được cấu hình để deploy trên Vercel/Cloudflare.


## Bộ chỉnh sửa local v0.7

- Chỉnh từng ô photobooth: kéo/căn, zoom, đổi thứ tự, thay ảnh hoặc chụp lại riêng một ô.
- Tùy biến tên, lời nhắn và ngày trên frame; lưu tối đa 12 mẫu theo tài khoản trên thiết bị.
- Video đơn: nhận MP4 gốc tối đa 2 phút/40 MB, chọn đoạn tối đa 15 giây, chọn ảnh bìa, tắt âm.
- Photobooth động: ghép 3/4 MP4 (tổng 40 MB) vào frame, dải/lưới, tối đa 10 giây; chọn tiếng từ một clip hoặc tắt âm. Mỗi clip phải đủ dài cho đoạn ghép.
- Nháp ảnh, crop, frame, video gốc/đã xử lý, caption và người nhận lưu trong IndexedDB theo tài khoản Locket hoặc chế độ chưa đăng nhập. Nháp gắn với origin localhost/cổng trình duyệt hiện tại, không đồng bộ thiết bị. Bộ nhớ trình duyệt có thể xóa nháp khi dọn dữ liệu.
- So sánh trước/sau AI bằng thanh kéo; lưu tối đa 20 prompt yêu thích trên thiết bị. Local tự đọc .env.local hoặc biến môi trường GEMINI_API_KEY, GEMINI_IMAGE_MODEL và CHAM_AI_OWNER_UID; không đưa key vào source.

## AI chỉnh ảnh local (Cloudflare Workers AI miễn phí & Gemini) v0.7.2

Chạm hỗ trợ chỉnh ảnh AI phía máy chủ qua **Cloudflare Workers AI** (miễn phí 10.000 Neurons/ngày, không cần thẻ ngân hàng, mặc định `@cf/black-forest-labs/flux-2-klein-9b`) hoặc **Google Gemini** (`gemini-2.5-flash-image`). Nếu khai báo đủ `CLOUDFLARE_ACCOUNT_ID` và `CLOUDFLARE_API_TOKEN` trong `.env.local`, máy chủ tự ưu tiên Cloudflare (có thể chọn tường minh bằng `CHAM_AI_PROVIDER=cloudflare` hoặc `gemini`).

Lưu cấu hình vào `.env.local` ở thư mục dự án cùng với `CHAM_AI_OWNER_UID` (sao chép UID trong mục Tài khoản sau khi đăng nhập Locket). Chỉ tài khoản khớp UID chủ app mới được gọi AI; token và Account ID luôn giữ kín trên máy chủ. Thanh kéo so sánh trước/sau, khôi phục ảnh gốc trước AI và prompt yêu thích giữ nguyên trên trình duyệt.
