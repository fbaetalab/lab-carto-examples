import * as THREE from 'three';
import { MASK } from '../config.js';
import { makeMaskTexture, defaultSymbolCanvas, symbolTexture } from '../lib/textures.js';

/* Uniforms como singletons de módulo, de propósito.

   O padrão precisa sair IDÊNTICO no plano e no drape do terreno — os dois
   shaders compartilham literalmente o mesmo objeto `sharedPat`. Recriar isso
   por componente abriria espaço para os dois divergirem de um frame, que é
   exatamente o bug que a implementação original evitava.

   Iluminação, sombra e fog NÃO estão aqui: são do MeshStandardMaterial. */

export const maskTex = makeMaskTexture();

export let symTex = symbolTexture(defaultSymbolCanvas());

export const sharedPat = {
  uPattern: { value: 2 }, uMode: { value: 2 },
  uSpacing: { value: 0 }, uLw: { value: 0 }, uSym: { value: 0 }, uRot: { value: 0 },
  uBase: { value: new THREE.Vector4() }, uPat: { value: new THREE.Vector4() },
  uTex: { value: symTex }, uTint: { value: 1 }, uFade: { value: 1 },
  uSw: { value: 1 }, uF: { value: 0 }, uHwW: { value: 0.05 }, uArmW: { value: 0.3 }, uSymW: { value: 0.6 },
};

export function replaceSymbolTexture(canvas) {
  symTex.dispose();
  symTex = symbolTexture(canvas);
  sharedPat.uTex.value = symTex;
}

export const terrainUniforms = Object.assign({
  uMaskT: { value: maskTex }, uDrape: { value: 1 }, uContours: { value: 1 },
  uMaskMin: { value: new THREE.Vector2(MASK.xmin, MASK.zmin) },
  uMaskSize: { value: new THREE.Vector2(MASK.sx, MASK.sz) },
}, sharedPat);

/* Overlays holográficos: sem iluminação, alfa aditivo-ish, sem sombra. */
export const wallUniforms = {
  uCol: { value: new THREE.Color('#7A1010') }, uTime: { value: 0 }, uSpeed: { value: 1 },
  uGFade: { value: 1 }, uAnim: { value: 1 }, uWStyle: { value: 0 },
};

export const volUniforms = {
  uCol: { value: new THREE.Color('#D64545') }, uGFade: { value: 1 },
  uTime: { value: 0 }, uVolAnim: { value: 0 },
};

export const outUniforms = {
  uColor: { value: new THREE.Color('#FF5050') }, uDash: { value: 6 }, uAlpha: { value: 1 },
};
