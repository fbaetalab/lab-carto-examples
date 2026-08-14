import { useMemo } from 'react';
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { BLD_VS, BLD_FS } from '../shaders/surfaces.js';
import { terrainH } from '../lib/terrain.js';
import { WHITE_1x1 } from '../lib/procTextures.js';
import { useStore } from '../store.js';

/* Edifícios de teste. Existem por um motivo funcional: provar que os overlays
   cartográficos são ocluídos por geometria real — se a zona restrita
   atravessasse o prédio, a leitura de profundidade estaria errada. */
const BLOCKS = [
  [-60, -110, 60, 34, 44],
  [40, -20, 44, 70, 50],
  [130, 90, 50, 26, 60],
  [-210, -40, 36, 52, 40],
  [-150, 90, 40, 22, 36],
  [70, 150, 58, 40, 52],
];

export default function Buildings() {
  const visible = useStore((s) => s.bld);

  const blocks = useMemo(() => BLOCKS.map(([x, z, w, h, d]) => ({
    key: `${x}:${z}`,
    geometry: new THREE.BoxGeometry(w, h, d),
    position: [x, terrainH(x, z) + h / 2 - 1, z],
  })), []);

  return (
    <group visible={visible}>
      {blocks.map((b) => (
        <mesh key={b.key} geometry={b.geometry} position={b.position} castShadow receiveShadow>
          <CustomShaderMaterial
            baseMaterial={THREE.MeshStandardMaterial}
            vertexShader={BLD_VS}
            fragmentShader={BLD_FS}
            roughnessMap={WHITE_1x1}
            metalnessMap={WHITE_1x1}
            emissiveMap={WHITE_1x1}
            emissive="#ffffff"
            roughness={1}
            metalness={0}
            envMapIntensity={1.1}
            dithering
          />
        </mesh>
      ))}
    </group>
  );
}
