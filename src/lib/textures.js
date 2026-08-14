import * as THREE from 'three';
import { MASK, POLY_A_OUTER, POLY_A_HOLE, POLY_B } from '../config.js';

/* Símbolo padrão: asterisco de três traços. */
export function defaultSymbolCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 22; g.lineCap = 'round';
  g.translate(128, 128);
  for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, -96); g.lineTo(0, 96); g.stroke(); }
  return c;
}

export function symbolTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/* Encaixa a imagem carregada num quadrado 256², preservando proporção. */
export function imageToSymbolCanvas(img) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = Math.min(256 / img.width, 256 / img.height);
  g.drawImage(img, (256 - img.width * r) / 2, (256 - img.height * r) / 2, img.width * r, img.height * r);
  return c;
}

/* Máscara top-down dos polígonos (mundo → textura), consumida pelo drape do
   terreno. O furo sai do evenodd, o que mantém o polígono com furo íntegro. */
export function makeMaskTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 1024, 1024);
  g.fillStyle = '#fff';
  const P = (pts) => {
    pts.forEach((p, i) => {
      const px = (p[0] - MASK.xmin) / MASK.sx * 1024;
      const py = (1 - (p[1] - MASK.zmin) / MASK.sz) * 1024;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.closePath();
  };
  g.beginPath(); P(POLY_A_OUTER); P(POLY_A_HOLE); g.fill('evenodd');
  g.beginPath(); P(POLY_B); g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
