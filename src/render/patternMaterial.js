import * as THREE from 'three';
import { FILL_VS, FILL_FS } from '../shaders/surfaces.js';
import { SHAPE_RANGE_M } from '../config.js';
import { symTex } from './uniforms.js';

/* Material de padrão INDEPENDENTE.

   O `sharedPat` de uniforms.js existe para que plano e drape da MESMA feição
   nunca divirjam. Aqui é o caso oposto: o catálogo mostra feições diferentes,
   cada uma com um padrão diferente, ao mesmo tempo. Compartilhar uniforms
   tornaria isso impossível — então cada célula ganha o seu.

   Regra prática: mesma feição → mesmos uniforms; feições distintas →
   materiais distintos. */
export function makePatternMaterial(overrides = {}, mask) {
  const uniforms = {
    uPattern: { value: 1 }, uMode: { value: 0 },
    uSpacing: { value: 8 }, uLw: { value: 1 }, uSym: { value: 6 }, uRot: { value: Math.PI / 4 },
    uBase: { value: new THREE.Vector4(0.84, 0.27, 0.27, 0.22) },
    uPat: { value: new THREE.Vector4(1.0, 0.31, 0.31, 0.9) },
    uTex: { value: symTex }, uTint: { value: 1 }, uFade: { value: 1 },
    uArrange: { value: 0 }, uSeed: { value: 1337 },
    uBrickOff: { value: 0.5 }, uShapeW: { value: 14 },
    uShapeRange: { value: SHAPE_RANGE_M },
    uMaskT: { value: mask?.texture ?? null },
    uMaskMin: { value: new THREE.Vector2(mask?.bounds.xmin ?? 0, mask?.bounds.zmin ?? 0) },
    uMaskSize: { value: new THREE.Vector2(mask?.bounds.sx ?? 1, mask?.bounds.sz ?? 1) },
    uSw: { value: 8 }, uF: { value: 0 },
    uHwW: { value: 0.5 }, uArmW: { value: 2.4 }, uSymW: { value: 3 },
  };

  for (const [k, v] of Object.entries(overrides)) {
    if (!uniforms[k]) continue;
    const cur = uniforms[k].value;
    if (cur && typeof cur === 'object' && 'set' in cur && Array.isArray(v)) cur.set(...v);
    else uniforms[k].value = v;
  }

  const m = new THREE.ShaderMaterial({
    vertexShader: FILL_VS,
    fragmentShader: FILL_FS,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.userData.uniforms = uniforms;
  return m;
}

/* Converte "#RRGGBB" + alfa no vec4 que os shaders esperam. */
export function rgba(hex, a) {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
    a,
  ];
}
