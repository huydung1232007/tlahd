/* Original canvas frame designs for Chạm. No network, logos or image assets. */
(function (global) {
  'use strict';
  const presets = [
    { id: 'classic', name: 'Tối giản', paper: '#ffffff', ink: '#303030', note: 'Một chút mỗi ngày' },
    { id: 'airmail', name: 'Thư tay', paper: '#f3e8ce', ink: '#8b2726', note: 'Gửi một chút nhớ thương' },
    { id: 'dots', name: 'Chấm bi', paper: '#dceef5', ink: '#4b3933', note: 'Little things, lovely days' },
    { id: 'stars', name: 'Sao đêm', paper: '#392824', ink: '#f4e4b7', note: 'You are my little star' },
    { id: 'ticket', name: 'Vé kỷ niệm', paper: '#fff9e9', ink: '#9e1624', note: 'Admit us to a lovely day' },
    { id: 'garden', name: 'Vườn xanh', paper: '#edf0dc', ink: '#52683b', note: 'Let the little moments bloom' },
    { id: 'love', name: 'Thương mến', paper: '#fbe5ed', ink: '#b64968', note: 'Made with a little love' },
  ];
  function preset(id) { return presets.find(p => p.id === id) || presets[0]; }
  function geometry(count, layout, id = 'classic') {
    if (![2, 3, 4].includes(count)) throw Error('Photobooth cần từ 2 đến 4 ảnh.');
    const themed = id !== 'classic', columns = layout === 'grid' ? 2 : 1;
    const rows = Math.ceil(count / columns), padding = themed ? 40 : 28;
    const gap = themed ? 22 : 14, header = themed ? 100 : 0, footer = themed ? 126 : 96;
    const cellWidth = columns === 1 ? 604 : 460, cellHeight = Math.round(cellWidth * .75);
    return {
      width: columns * cellWidth + (columns - 1) * gap + padding * 2,
      height: rows * cellHeight + (rows - 1) * gap + padding * 2 + header + footer,
      header, footer, padding,
      slots: Array.from({ length: count }, (_, i) => ({
        x: padding + i % columns * (cellWidth + gap),
        y: padding + header + Math.floor(i / columns) * (cellHeight + gap),
        width: cellWidth, height: cellHeight,
      })),
    };
  }
  function star(ctx, x, y, size, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? size * .43 : size;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function heart(ctx, x, y, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.beginPath(); ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-28, -10, -9, -27, 0, -12);
    ctx.bezierCurveTo(9, -27, 28, -10, 0, 8);
    ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  function bow(ctx, x, y, scale, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-50, -38, -45, 26, 0, 0);
    ctx.bezierCurveTo(50, -38, 45, 26, 0, 0);
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(-7, 16, -24, 35);
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, 20, 26, 30); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  function leaf(ctx, x, y, rotation, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, size, size * .42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function flower(ctx, x, y, size) {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      leaf(ctx, x + Math.cos(a) * size * .55, y + Math.sin(a) * size * .55, a, size * .55, '#fffdf2');
    }
    ctx.beginPath(); ctx.arc(x, y, size * .26, 0, Math.PI * 2); ctx.fillStyle = '#c8ad51'; ctx.fill();
  }
  function slotPath(ctx, slot, id) {
    ctx.beginPath();
    if (id === 'garden') ctx.ellipse(slot.x + slot.width / 2, slot.y + slot.height / 2, slot.width / 2, slot.height / 2, 0, 0, Math.PI * 2);
    else ctx.rect(slot.x, slot.y, slot.width, slot.height);
  }
  function isDarkHex(hex) {
    if (!/^#[a-f0-9]{6}$/i.test(hex || '')) return false;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return .299 * r + .587 * g + .114 * b < 115;
  }
  function background(ctx, g, id, color = '#ffffff', custom = {}) {
    const p = preset(id), w = g.width, h = g.height;
    const paper = custom?.paper || (id === 'classic' ? color : p.paper);
    const accent = custom?.ink || p.ink;
    ctx.save(); ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h);
    if (id === 'airmail') {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(15, 15, w - 30, h - 30); ctx.clip('evenodd');
      for (let y = -w; y < h + w; y += 54) {
        ctx.fillStyle = Math.floor(y / 54) % 2 ? '#b95e47' : '#66838c';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + w); ctx.lineTo(w, y + w + 25); ctx.lineTo(0, y + 25); ctx.fill();
      }
      ctx.restore();
      const shade = ctx.createLinearGradient(0, 0, w, h); shade.addColorStop(0, '#b9965525'); shade.addColorStop(.5, '#fffdf000'); shade.addColorStop(1, '#ad86552a');
      ctx.fillStyle = shade; ctx.fillRect(16, 16, w - 32, h - 32);
      ctx.globalAlpha = .13;
      for (let i = 0; i < 140; i++) { ctx.fillStyle = '#795c37'; ctx.fillRect((i * 137.7) % w, (i * 281.3) % h, 1 + i % 3, 1); }
    } else if (id === 'dots') {
      ctx.fillStyle = accent;
      for (let y = 17; y < h; y += 39) for (let x = 17 + (Math.floor(y / 39) % 2) * 19; x < w; x += 39) {
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (id === 'stars') {
      for (let y = 24; y < h; y += 53) { star(ctx, 20, y, 8, accent); star(ctx, w - 20, y + 25, 7, accent); }
      for (let x = 45; x < w - 30; x += 53) { star(ctx, x, 20, 7, accent); star(ctx, x, h - 19, 7, accent); }
    } else if (id === 'ticket') {
      ctx.strokeStyle = accent; ctx.lineWidth = 16; ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(w / 2, 7, 39, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#ba7370'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.moveTo(30, h - 110); ctx.lineTo(w - 30, h - 110); ctx.stroke();
    } else if (id === 'garden') {
      // Gingham paper and small leafy stems, drawn underneath the photograph windows.
      ctx.fillStyle = '#90a36c20';
      for (let x = 0; x < w; x += 40) ctx.fillRect(x, 0, 20, h);
      for (let y = 0; y < h; y += 40) ctx.fillRect(0, y, w, 20);
      for (let y = 70; y < h - 40; y += 65) {
        leaf(ctx, 20, y, -.7, 16, '#718553'); leaf(ctx, w - 20, y + 26, .7, 16, '#90a46b');
      }
    } else if (id === 'love') {
      ctx.strokeStyle = '#dba1b2'; ctx.lineWidth = 2; ctx.strokeRect(12, 12, w - 24, h - 24);
      for (let y = 54; y < h; y += 100) { heart(ctx, 21, y, 9, '#d787a0'); heart(ctx, w - 22, y + 43, 9, '#d787a0'); }
      ctx.fillStyle = '#fff7fa';
      for (let x = 0; x < w + 30; x += 35) { ctx.beginPath(); ctx.arc(x, h - 6, 23, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function overlay(ctx, g, id, time, color = '#ffffff', custom = {}) {
    custom=global.ChamEdits?.custom(custom)||custom;
    const dateLabel=custom.date||date(time);
    const p = preset(id), w = g.width, h = g.height;
    const paper = custom?.paper || (id === 'classic' ? color : p.paper);
    const ink = custom?.ink || (id === 'classic' ? (isDarkHex(paper) ? '#ffffff' : '#303030') : p.ink);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
    if (id !== 'classic') {
      ctx.font = id === 'ticket' ? 'italic 36px Georgia, serif' : id === 'airmail' ? 'bold 32px Georgia, serif' : '600 28px Georgia, serif';
      const title = { airmail: 'DEAR LITTLE MOMENTS', dots: 'a lovely little day', stars: 'written in the stars', ticket: 'Chạm Photo Club', garden: 'a little garden', love: 'with love, chạm' }[id];
      ctx.fillText(custom.title||title, w / 2, g.padding + 47, w - 115);
      g.slots.forEach((s, i) => {
        slotPath(ctx, s, id); ctx.strokeStyle = id === 'garden' ? '#82935b' : id === 'love' ? '#ce8098' : id === 'ticket' ? ink : '#ffffffaa';
        ctx.lineWidth = id === 'garden' ? 11 : id === 'love' ? 5 : 3; ctx.stroke();
        if (id === 'garden') {
          leaf(ctx, s.x + s.width * .15, s.y + 13, -.4, 23, '#809459');
          flower(ctx, s.x + s.width * .1, s.y + 20, 22);
          leaf(ctx, s.x + s.width * .86, s.y + s.height - 11, -.5, 24, '#90a36b');
        } else if (id === 'love') {
          heart(ctx, s.x + 3, s.y + s.height - 3, 19, ink);
          if (i % 2 === 0) bow(ctx, s.x + s.width - 11, s.y + 6, .65, ink);
        } else if (id === 'stars') {
          star(ctx, s.x - 2, s.y - 4, 11, ink); star(ctx, s.x + s.width, s.y + s.height, 11, ink);
        }
      });
      ctx.fillStyle = ink; ctx.font = 'italic 23px Georgia, serif';
      ctx.fillText(custom.message||p.note, w / 2, h - g.padding - 76, w - 100);
      if (id === 'ticket') {
        // Decorative barcode, not a link or tracking identifier.
        for (let i = 0, x = w * .25; x < w * .75; i++, x += 5) ctx.fillRect(x, h - g.padding - 34, i % 3 === 0 ? 3 : 1, 18);
        bow(ctx, w - 52, 60, .82, ink);
      } else if (id === 'love') {
        bow(ctx, w / 2, h - g.padding - 19, .65, ink);
      } else if (id === 'garden') {
        flower(ctx, w / 2, h - g.padding - 17, 17);
      }
      ctx.font = '600 16px ui-monospace, monospace';
      ctx.fillText('CHẠM  ·  ' + dateLabel, w / 2, h - g.padding - 48, w - 100);
    } else {
      ctx.font = '600 22px -apple-system, sans-serif'; ctx.fillText(custom.title||'chạm.', w / 2, h - 67);
      ctx.font='italic 18px Georgia, serif';ctx.fillText(custom.message||'Một chút mỗi ngày',w/2,h-43,w-70);
      ctx.font = '14px ui-monospace, monospace'; ctx.fillText(dateLabel, w / 2, h - 21);
    }
    ctx.restore();
  }
  function date(time) { const d = new Date(time); return [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('.'); }
  const previewCache = new Map();
  function preview(id, count = 4, layout = 'strip', color = '#ffffff', width = 160, custom = {}) {
    const key = [id, count, layout, color, width,JSON.stringify(custom),new Date().toDateString()].join(':');
    if (previewCache.has(key)) return previewCache.get(key);
    const g = geometry(count, layout, id), c = document.createElement('canvas'), scale = width / g.width;
    c.width = width; c.height = Math.round(g.height * scale);
    const ctx = c.getContext('2d'); ctx.scale(scale, scale); background(ctx, g, id, color, custom);
    g.slots.forEach((s, i) => {
      ctx.save(); slotPath(ctx, s, id); ctx.clip();
      ctx.fillStyle = ['#e9e4df', '#dedbd5', '#e5e1d9', '#e7ded7'][i]; ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.fillStyle = '#b4aca4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '24px Georgia, serif';
      ctx.fillText('your moment', s.x + s.width / 2, s.y + s.height / 2); ctx.restore();
    });
    overlay(ctx, g, id, Date.now(), color, custom);
    const url = c.toDataURL('image/png'); if(previewCache.size>=64)previewCache.clear();previewCache.set(key, url); return url;
  }
  global.ChamFrames = { presets, preset, geometry, slotPath, background, overlay, preview };
})(typeof window !== 'undefined' ? window : globalThis);
