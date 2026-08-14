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
import FillCatalog from '../scenarios/FillCatalog.jsx';
import Representations3D from '../scenarios/Representations3D.jsx';
import { useStore } from '../store.js';
import { THEMES } from '../config.js';

const CAMERA = { fov: 55, near: 0.5, far: 40000, position: [-263.1, 442.1, 527.0] };
/* A fileira de células corre em Z de -460 a 460; a câmera precisa abraçar isso
   de um ângulo que ainda mostre altura, que é o assunto do cenário. */
const REPS_CAMERA = [980, 580, 330];

export default function Scene() {
  const scenario = useStore((s) => s.scenario);
  const theme = useStore((s) => s.theme);
  const [dpr, setDpr] = useState(1.5);
  const declines = useRef(0);

  const fog = new THREE.Color(THEMES[theme].fog);
  /* O catálogo é uma prancha de contato: sem ambiente, sem pós, sem câmera
     livre. Qualquer um dos três atrapalharia a comparação entre padrões. */
  const isCatalog = scenario === 'catalog';

  return (
    <Canvas
      flat
      shadows="soft"
      dpr={dpr}
      camera={{ ...CAMERA, position: scenario === 'reps' ? REPS_CAMERA : CAMERA.position }}
      gl={{ preserveDrawingBuffer: true, antialias: isCatalog, powerPreference: 'high-performance' }}
      onCreated={(state) => { if (import.meta.env.DEV) window.__three = state; }}
    >
      {isCatalog ? (
        <FillCatalog />
      ) : (
        <>
          <fogExp2 attach="fog" args={[fog, 0.00006]} />
          <PerformanceMonitor
            onDecline={() => { declines.current += 1; setDpr((d) => Math.max(1, d - 0.25)); }}
            onIncline={() => { if (declines.current === 0) setDpr((d) => Math.min(2, d + 0.25)); }}
          />
          <SkyEnvironment />
          <Terrain />
          {/* Os edifícios são fixture de oclusão do sandbox. No comparativo de
              representações eles só disputariam atenção com as células. */}
          {scenario !== 'reps' && <Buildings />}
          <Ocean reflectionSize={dpr > 1.25 ? 512 : 256} />

          {scenario === 'reps' ? <Representations3D /> : <Demarcation />}

          <Rig target={scenario === 'reps' ? [0, 16, 0] : [60, 0, 0]} />
          <FrameDriver />
          <Post />
        </>
      )}
    </Canvas>
  );
}
