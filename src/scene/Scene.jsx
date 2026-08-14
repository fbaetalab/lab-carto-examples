import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import SkyEnvironment from './SkyEnvironment.jsx';
import Terrain from './Terrain.jsx';
import Buildings from './Buildings.jsx';
import Ocean from './Ocean.jsx';
import Layers from './Layers.jsx';
import Rig from './Rig.jsx';
import Post from '../render/Post.jsx';
import FrameDriver from '../render/FrameDriver.jsx';
import { useStore } from '../store.js';

const CAMERA = { fov: 55, near: 0.5, far: 40000, position: [-263.1, 442.1, 527.0] };
const FOG = new THREE.Color('#141B22');

export default function Scene() {
  const scene = useStore((s) => s.scene);
  const [dpr, setDpr] = useState(1.5);
  const declines = useRef(0);

  return (
    <Canvas
      flat
      shadows="soft"
      dpr={dpr}
      camera={CAMERA}
      gl={{ preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }}
      onCreated={(state) => { if (import.meta.env.DEV) window.__three = state; }}
    >
      <fogExp2 attach="fog" args={[FOG, 0.00006]} />
      <PerformanceMonitor
        onDecline={() => { declines.current += 1; setDpr((d) => Math.max(1, d - 0.25)); }}
        onIncline={() => { if (declines.current === 0) setDpr((d) => Math.min(2, d + 0.25)); }}
      />
      <SkyEnvironment />
      <Terrain />
      {scene.buildings && <Buildings />}
      <Ocean reflectionSize={dpr > 1.25 ? 512 : 256} />
      <Layers />
      <Rig />
      <FrameDriver />
      <Post />
    </Canvas>
  );
}
