# Chạm — hướng dẫn tiếp nhận

- Đọc HANDOFF-ANTIGRAVITY.md trước khi làm việc. Giao tiếp với chủ dự án bằng tiếng Việt.
- Đây là bản web local đang hoạt động, version 0.7.1. Giữ mã hiện có và thiết kế tối giản theo cảm hứng Apple.
- Yêu cầu hiện tại là tiếp nhận dự án: đọc mã, chạy kiểm tra và báo lại hiện trạng. Chưa có yêu cầu làm thêm tính năng sau lần bàn giao.
- Chủ dự án đang yêu cầu local-only. Chỉ push GitHub, deploy, xuất bản hoặc đổi dịch vụ khi có yêu cầu tiếp theo.
- AI hiện dùng Google Gemini, không dùng OpenAI. Giữ API key ở máy chủ và quyền dùng AI theo CHAM_AI_OWNER_UID. Không tự mở quyền cho người đăng nhập đầu tiên.
- Không đọc, sao chép, in hoặc gửi giá trị bí mật từ thư mục khác. Dùng .env.example cho cấu hình mẫu. Không commit/đóng gói .env.local, cookie, mật khẩu, token, ảnh cá nhân hoặc .local-server.*.
- Giữ đăng nhập Locket, lịch sử bạn bè có phân trang, ảnh vuông giữ đầy đủ frame, video/photobooth động, nháp và so sánh AI hoạt động.
- Không tự đăng nội dung lên Locket hoặc gọi tạo ảnh trả phí để kiểm tra. Dùng mock và clip/ảnh tổng hợp; xin chủ dự án chọn nội dung khi cần kiểm tra thật.
- Kiểm tra phù hợp: npm run check, npm test, npm run build. Baseline bàn giao: 55 bài kiểm tra đạt. Không sửa tests chỉ để che lỗi.
- Máy chủ hiện tại của chủ dự án có thể đang chạy ở cổng 4173. Khi kiểm tra bản bàn giao, dùng CHAM_PORT=4175; không dừng máy chủ khác hoặc đổi origin nháp của chủ dự án.
- Chỉ chỉnh public/, worker/, api/, scripts/ và tests/ khi cần; dist/ là kết quả build, không sửa trực tiếp.
- Giữ LICENSE.locket.js và THIRD_PARTY_NOTICES.md. Giao thức Locket có nguồn gốc từ hmk8386/locket.js và giấy phép phi thương mại.
