import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { makeWaterNormals } from '../lib/procTextures.js';
import { sunVector } from './SkyEnvironment.jsx';
import { useStore } from '../store.js';

/* Água com reflexão planar real (three/Water): reflete céu, terreno e
   edifícios. É o item que mais paga em fotorrealismo numa cena portuária —
   sem reflexo, água vira um plano azul translúcido e a cena inteira
   denuncia que é sintética.

   Custo: uma passada extra da cena por frame na resolução do refletor.
   Por isso a resolução cai junto com o dpr quando o PerformanceMonitor
   detecta queda de fps. */
export default function Ocean({ reflectionSize = 512 }) {
  const { scene } = useThree();
  const visible = useStore((s) => s.scene.sea);
  const sunAz = useStore((s) => s.scene.sun.az);
  const sunEl = useStore((s) => s.scene.sun.el);

  const water = useMemo(() => {
    const geo = new THREE.PlaneGeometry(4000, 4000);
    const w = new Water(geo, {
      textureWidth: reflectionSize,
      textureHeight: reflectionSize,
      waterNormals: makeWaterNormals(512),
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x0d2a33,
      distortionScale: 3.4,
      fog: scene.fog !== undefined,
    });
    w.rotation.x = -Math.PI / 2;
    /* size = repetições do normal map. Alto porque a escala aqui é portuária:
       com valor baixo a onda fica do tamanho de um navio. */
    w.material.uniforms.size.value = 18.0;
    /* O refletor não deve capturar os overlays holográficos nem a si mesmo. */
    w.material.transparent = true;
    return w;
  }, [reflectionSize, scene.fog]);

  useEffect(() => () => {
    water.geometry.dispose();
    water.material.dispose();
  }, [water]);

  useEffect(() => {
    water.material.uniforms.sunDirection.value.copy(sunVector(sunAz, sunEl)).normalize();
  }, [water, sunAz, sunEl]);

  useFrame((_, dt) => {
    if (visible) water.material.uniforms.time.value += dt * 0.42;
  });

  return <primitive object={water} visible={visible} />;
}
