/* Miniaturas da galeria, desenhadas em canvas 2D. São ícones, não uma prévia
   fiel do shader — o objetivo é só reconhecer o padrão de relance. */
export function drawThumb(cv, i) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = g.fillStyle = '#9FB3BB';
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };

  if (i === 0) { g.globalAlpha = .3; g.fillRect(4, 4, w - 8, h - 8); g.globalAlpha = 1; }
  if (i === 1 || i === 7) { g.lineWidth = i === 7 ? 5 : 1.4; for (let x = -h; x < w + h; x += i === 7 ? 14 : 8) line(x, h, x + h, 0); }
  if (i === 2) { for (let x = -h; x < w + h; x += 9) { line(x, h, x + h, 0); line(x, 0, x + h, h); } }
  if (i === 3) { for (let y = 6; y < h; y += 9) for (let x = 6; x < w; x += 9) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } }
  if (i === 4) { for (let y = 8; y < h; y += 13) for (let x = 8; x < w; x += 13) { line(x - 4, y, x + 4, y); line(x, y - 4, x, y + 4); } }
  if (i === 5) { for (let y = 8; y < h; y += 13) for (let x = 8; x < w; x += 13) { line(x - 3, y - 3, x + 3, y + 3); line(x - 3, y + 3, x + 3, y - 3); } }
  if (i === 6) { g.globalAlpha = .55; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { if ((x + y) % 2 === 0) g.fillRect(2 + x * 9, 2 + y * 8, 9, 8); } g.globalAlpha = 1; }
  if (i === 8) { for (let y = 10; y < h; y += 16) for (let x = 10; x < w; x += 18) { for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + .5; line(x - Math.cos(a) * 5, y - Math.sin(a) * 5, x + Math.cos(a) * 5, y + Math.sin(a) * 5); } } }
  if (i === 9) {                                    // tijolado
    const bh = 8, bw = 16;
    for (let r = 0, y = 4; y < h; y += bh, r++) {
      line(0, y, w, y);
      const off = (r % 2) * bw * 0.5;
      for (let x = off; x < w + bw; x += bw) line(x, y, x, Math.min(y + bh, h));
    }
  }
  if (i === 10) {                                   // shapeburst
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, '#9FB3BB'); gr.addColorStop(0.55, 'rgba(159,179,187,0.12)'); gr.addColorStop(1, 'rgba(159,179,187,0)');
    g.fillStyle = gr;
    g.fillRect(3, 3, w - 6, h - 6);
    g.strokeStyle = '#9FB3BB';
    g.strokeRect(3, 3, w - 6, h - 6);
  }
}
