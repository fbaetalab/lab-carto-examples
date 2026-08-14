import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import SkyEnvironment from './SkyEnvironment.jsx';
import Terrain from './Terrain.jsx';
import Buildings from './Buildings.jsx';
import Ocean from './Ocean.jsx';
import Demarcation from './Demarcation.jsx';
import Rig from './Rig.jsx';
import Post from '../render/Post.jsx';
import FrameDriver from '../render/FrameDriver.jsx';
import { useStore } from '../store.js';
import { THEMES } from '../config.js';

/* Posição inicial da câmera: mesma composição da referência original
   (θ=-0,55, φ=0,95, dist=760 sobre o alvo em x=60). */
const CAMERA = {
  fov: 55,
  near: 0.5,
  far: 40000,
  position: [-263.1, 442.1, 527.0],
};

export default function Scene() {
  const theme = useStore((s) => s.theme);
  const [dpr, setDpr] = useState(1.5);
  const declines = useRef(0);

  const fog = new THREE.Color(THEMES[theme].fog);

  return (
    <Canvas
      /* flat = sem tone mapping do renderer; quem faz ACES é o efeito no
         composer, senão a imagem passaria duas vezes pelo tone map. */
      flat
      shadows="soft"
      dpr={dpr}
      camera={CAMERA}
      /* preserveDrawingBuffer é exigência do "Exportar PNG"; antialias fica
         desligado porque o SMAA no composer faz esse trabalho melhor. */
      gl={{ preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }}
      /* Ponte de inspeção: só em dev, para conseguir auditar cena, materiais e
         luzes do console sem instrumentar componente por componente. */
      onCreated={(state) => { if (import.meta.env.DEV) window.__three = state; }}
    >
      {/* Névoa exponencial: a 2,4 km de terreno é ela que dá profundidade
          atmosférica e esconde a borda do mundo. */}
      <fogExp2 attach="fog" args={[fog, 0.00006]} />

      <PerformanceMonitor
        onDecline={() => { declines.current += 1; setDpr((d) => Math.max(1, d - 0.25)); }}
        onIncline={() => { if (declines.current === 0) setDpr((d) => Math.min(2, d + 0.25)); }}
      />

      <SkyEnvironment />
      <Terrain />
      <Buildings />
      <Ocean reflectionSize={dpr > 1.25 ? 512 : 256} />
      <Demarcation />

      <Rig />
      <FrameDriver />
      <Post />
    </Canvas>
  );
}
