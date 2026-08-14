import * as THREE from 'three';
import { FILL_VS, FILL_FS } from '../shaders/surfaces.js';
import { WALL_VS, WALL_FS, VOL_FS, OUT_VS, OUT_FS } from '../shaders/demarcation.js';
import { sharedPat, wallUniforms, volUniforms, outUniforms } from './uniforms.js';

/* Materiais dos OVERLAYS. Todos unlit e transparentes: são dado sintético
   desenhado sobre o mundo, não superfície física. Nenhum deles projeta ou
   recebe sombra, e nenhum entra no PBR — se entrassem, a leitura da
   demarcação mudaria com a hora do dia, que é justamente o que não se quer. */

export const fillMat = new THREE.ShaderMaterial({
  vertexShader: FILL_VS,
  fragmentShader: FILL_FS,
  uniforms: sharedPat,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export const wallMat = new THREE.ShaderMaterial({
  vertexShader: WALL_VS,
  fragmentShader: WALL_FS,
  uniforms: wallUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export const volMat = new THREE.ShaderMaterial({
  vertexShader: WALL_VS,
  fragmentShader: VOL_FS,
  uniforms: volUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export const capMat = new THREE.MeshBasicMaterial({
  color: '#D64545',
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export const outMat = new THREE.ShaderMaterial({
  vertexShader: OUT_VS,
  fragmentShader: OUT_FS,
  uniforms: outUniforms,
  transparent: true,
  side: THREE.DoubleSide,
});

export const scatterMat = new THREE.MeshBasicMaterial({
  color: '#7A1010',
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
