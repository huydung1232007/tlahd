/* Fit the complete image inside Locket's square without cropping or stretching. */
(function (global) {
  'use strict';
  function placement(width, height, size = 1200, inset = .06) {
    if (![width, height, size].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(inset) || inset < 0 || inset >= .5) {
      throw Error('Kích thước ảnh không hợp lệ.');
    }
    const available = size * (1 - 2 * inset);
    const scale = Math.min(available / width, available / height);
    const fittedWidth = width * scale, fittedHeight = height * scale;
    return { x: (size - fittedWidth) / 2, y: (size - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
  }
  async function prepare(data) {
    if (typeof data !== 'string' || !/^data:image\/(webp|jpeg);base64,/.test(data)) throw Error('Ảnh chưa sẵn sàng để gửi lên Locket.');
    const image = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(Error('Không đọc được ảnh. Hãy chọn lại ảnh.'));
      im.src = data;
    });
    const box = placement(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // The complete source is drawn once. Extra margin protects frame corners.
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    const webp = canvas.toDataURL('image/webp', .92);
    if (webp.startsWith('data:image/webp;base64,')) return webp;
    const jpg = canvas.toDataURL('image/jpeg', .92);
    if (jpg.startsWith('data:image/jpeg;base64,')) return jpg;
    throw Error('Trình duyệt chưa xuất được ảnh. Hãy thử trình duyệt mới hơn.');
  }
  global.ChamLocketImage = { placement, prepare };
})(typeof window !== 'undefined' ? window : globalThis);
