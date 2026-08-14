import { useMemo } from 'react';
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { TERRAIN_VS, TERRAIN_FS } from '../shaders/surfaces.js';
import { terrainUniforms } from '../render/uniforms.js';
import { terrainH } from '../lib/terrain.js';
import { WHITE_1x1 } from '../lib/procTextures.js';

/* Malha em 384² sobre 2400 m = ~6 m por quad. Resolução alta o bastante para
   as octaves de detalhe de terrainH virarem normais reais — é isso que faz o
   sombreamento das encostas parecer terreno e não um plano pintado. */
const SEG = 384;
const SIZE = 2400;

export default function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, []);

  /* Recebe sombra, mas NÃO projeta: terreno projetando sobre si mesmo com
     2048 texels cobrindo 1,4 km dá 0,68 m/texel contra uma malha de 6 m — o
     resultado são manchas escuras grandes, não sombra. Quem projeta são os
     edifícios. */
  return (
    <mesh geometry={geometry} receiveShadow>
      <CustomShaderMaterial
        baseMaterial={THREE.MeshStandardMaterial}
        vertexShader={TERRAIN_VS}
        fragmentShader={TERRAIN_FS}
        uniforms={terrainUniforms}
        roughnessMap={WHITE_1x1}
        metalnessMap={WHITE_1x1}
        roughness={1}
        metalness={0}
        dithering
      />
    </mesh>
  );
}
