import * as THREE from 'three';
import { MASK, SHAPE_RANGE_M } from '../config.js';
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
  uArrange: { value: 0 }, uSeed: { value: 1337 },
  uBrickOff: { value: 0.5 }, uShapeW: { value: 45 },
  uShapeRange: { value: SHAPE_RANGE_M },
  /* A máscara é compartilhada: o drape lê o canal R, o shapeburst lê o G. */
  uMaskT: { value: maskTex },
  uMaskMin: { value: new THREE.Vector2(MASK.xmin, MASK.zmin) },
  uMaskSize: { value: new THREE.Vector2(MASK.sx, MASK.sz) },
  uSw: { value: 1 }, uF: { value: 0 }, uHwW: { value: 0.05 }, uArmW: { value: 0.3 }, uSymW: { value: 0.6 },
};

export function replaceSymbolTexture(canvas) {
  symTex.dispose();
  symTex = symbolTexture(canvas);
  sharedPat.uTex.value = symTex;
}

/* O terreno só precisa saber das curvas de nível. O drape deixou de ser
   propriedade dele quando virou malha da própria camada — o que é o certo:
   com máscara única no shader do terreno, só UMA camada poderia drapear. */
export const terrainUniforms = { uContours: { value: 1 } };

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

/* Casing = fita concêntrica mais larga por baixo da borda. Existe para a borda
   continuar legível sobre qualquer base — sem ele, uma linha clara some sobre
   areia e uma escura some sobre água funda. Nunca leva dash: é o fundo da
   borda, não a borda. */
export const casingUniforms = {
  uColor: { value: new THREE.Color('#0C1114') }, uDash: { value: 0 }, uAlpha: { value: 1 },
};
