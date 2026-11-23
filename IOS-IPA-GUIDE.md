# Hướng dẫn xuất & cài file `Cham-unsigned.ipa` lên iPhone (từ máy Windows)

Vì trình biên dịch iOS (`xcodebuild`) của Apple chỉ chạy trên macOS, dự án đã tích hợp sẵn:
1. **Tầng chạy độc lập trên iPhone (`ios/ios-bridge.js`):** Cho phép app trên iPhone tự đăng nhập Locket, tải bảng tin, gửi ảnh/video lên Locket, ghép video vuông `720 × 720` bằng phần cứng iPhone và gọi Cloudflare AI **qua 4G/Wi-Fi mọi nơi mà không cần bật máy tính**.
2. **GitHub Actions tự động xuất `.ipa` (`.github/workflows/build-ipa.yml`):** Dùng máy ảo macOS miễn phí của GitHub để biên dịch ra file `Cham-unsigned.ipa` trong ~3 phút.

---

## Bước 1: Đẩy mã nguồn lên GitHub để lấy file `.ipa`

> **An toàn bảo mật:** File `.gitignore` đã chặn hoàn toàn `.env.local`, nên API Token và khóa cá nhân trên máy bạn **không bao giờ** bị đẩy lên GitHub hay nằm sẵn trong file `.ipa`.

1. Tạo một repository mới trên GitHub (ví dụ `cham-ios`, có thể để *Public* để có số phút build macOS miễn phí không giới hạn, hoặc *Private*).
2. Mở PowerShell tại thư mục dự án này và chạy:
   ```powershell
   git init
   git branch -M main
   git add .
   git commit -m "Cham Locket Noir + iOS IPA builder"
   git remote add origin https://github.com/<TEN_GITHUB_CUA_BAN>/<TEN_REPO>.git
   git push -u origin main
   ```
3. Mở trang GitHub của repository → bấm tab **Actions** → chọn workflow **Build Chạm iOS IPA (Sideloadly / AltStore)**.
4. Chờ khoảng **3–4 phút** cho tới khi hiện dấu tích xanh → cuộn xuống mục **Artifacts** ở cuối trang → bấm tải **`Cham-unsigned-ipa`** về máy Windows rồi giải nén ra file **`Cham-unsigned.ipa`**.

---

## Bước 2: Cài `Cham-unsigned.ipa` vào iPhone bằng Sideloadly (hoặc AltStore)

### Cách A: Dùng Sideloadly trên Windows (Nhanh nhất)
1. Cài [Sideloadly](https://sideloadly.io/) (cần cài bản iTunes & iCloud tải trực tiếp từ trang chủ Apple, không phải bản Microsoft Store).
2. Cắm cáp nối iPhone vào máy tính Windows, bấm **Tin cậy (Trust)** trên màn hình iPhone.
3. Mở **Sideloadly**, kéo thả file **`Cham-unsigned.ipa`** vào ô IPA, nhập email **Apple ID** của bạn rồi bấm **Start**.
4. Cài xong, trên iPhone vào **Cài đặt → Cài đặt chung → Quản lý VPN & Thiết bị** → chọn Apple ID của bạn → bấm **Tin cậy**. *(Trên iOS 16+, nhớ bật **Chế độ nhà phát triển / Developer Mode** trong Cài đặt → Quyền riêng tư & Bảo mật).*

### Cách B: Dùng AltStore / SideStore
1. Chép file `Cham-unsigned.ipa` sang tệp iCloud Drive / Tệp trên iPhone.
2. Mở **AltStore** (khi máy tính đang bật AltServer cùng Wi-Fi) → sang tab **My Apps** → bấm dấu **`+`** ở góc trên trái → chọn `Cham-unsigned.ipa`.

---

## Bước 3: Bật Cloudflare AI trên iPhone (Tùy chọn)
1. Mở app **Chạm** trên iPhone → đăng nhập tài khoản Locket của bạn.
2. Sang tab **Tài khoản** → mở mục **Cloudflare AI trên iPhone** → dán `Account ID` và `API Token` Cloudflare vào rồi bấm **Lưu** (chỉ lưu cục bộ trong bộ nhớ riêng của iPhone bạn).
