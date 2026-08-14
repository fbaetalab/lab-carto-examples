import * as THREE from 'three';

/* Mapas 1×1 usados só para forçar o three a incluir os chunks correspondentes
   no shader — sem eles, csm_Roughness / csm_Metalness / csm_FragNormal são
   descartados na compilação. Custo de memória desprezível. */
function dataTex(r, g, b, colorSpace) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
  if (colorSpace) t.colorSpace = colorSpace;
  t.needsUpdate = true;
  return t;
}

export const WHITE_1x1 = /* @__PURE__ */ dataTex(255, 255, 255);
export const FLAT_NORMAL_1x1 = /* @__PURE__ */ dataTex(128, 128, 255);

/* Normal map de água, tileável, gerado por soma de senoides de frequência
   INTEIRA (é o que garante a costura perfeita na borda do tile).
   Evita depender de asset externo — a página continua autocontida. */
export function makeWaterNormals(size = 512) {
  const waves = [
    { fx: 3, fy: 1, amp: 1.00, phase: 0.0 },
    { fx: -2, fy: 4, amp: 0.70, phase: 1.7 },
    { fx: 5, fy: -3, amp: 0.45, phase: 0.6 },
    { fx: 7, fy: 6, amp: 0.28, phase: 2.4 },
    { fx: -9, fy: 2, amp: 0.18, phase: 3.1 },
    { fx: 11, fy: 13, amp: 0.10, phase: 1.2 },
  ];
  const TAU = Math.PI * 2;
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let s = 0;
      for (const w of waves) s += w.amp * Math.sin(TAU * (w.fx * u + w.fy * v) + w.phase);
      h[y * size + x] = s;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // normal = normalize(-dx, -dy, 1) codificada em 0..255
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
