import * as THREE from 'three';

/* Hex "#RRGGBB" + alfa → Vector4 com componentes 0..1.

   Deliberadamente NÃO passa por THREE.Color: os shaders de padrão tratam
   uBase/uPat como valores já no espaço de trabalho, igual à implementação de
   referência original. Passar pelo color management do three mudaria as cores
   em relação à calibragem da spec. */
export function hex4(h, a) {
  return new THREE.Vector4(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
    a,
  );
}
