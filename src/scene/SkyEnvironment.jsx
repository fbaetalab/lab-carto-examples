import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { useStore } from '../store.js';

/* Céu físico (Preetham) capturado UMA vez por mudança de sol e usado para
   duas coisas: fundo e IBL.

   Por que capturar em vez de deixar o mesh do céu na cena: o Sky do three
   quer escala ~450 000 para ficar atrás de tudo, mas a câmera aqui tem
   far=40 000 (precisão de depth importa numa cena de 2,4 km com geometria
   fina). O mesh seria cortado pelo far plane. Renderizando para um cube
   render target, o fundo passa a ser uma textura — sem profundidade, sempre
   atrás, e de brinde vira a fonte do PMREM.

   O IBL é o que separa PBR crível de "3D de 2010": é dele que vem o azul
   difuso de cima e o calor perto do sol nas superfícies em sombra. */

const SKY_PARAMS = { turbidity: 3.2, rayleigh: 1.15, mieCoefficient: 0.004, mieDirectionalG: 0.82 };

export function sunVector(azDeg, elDeg) {
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  );
}

export default function SkyEnvironment() {
  const { scene, gl } = useThree();
  const sunAz = useStore((s) => s.sunAz);
  const sunEl = useStore((s) => s.sunEl);
  const shadows = useStore((s) => s.shadows);
  const lightRef = useRef();

  /* Plataforma de captura: céu pequeno numa cena isolada, dentro do frustum
     do CubeCamera. A escala é irrelevante para a cor — o shader do Sky
     trabalha por direção. */
  const rig = useMemo(() => {
    const mk = (scale) => {
      const s = new Sky();
      s.scale.setScalar(scale);
      const u = s.material.uniforms;
      u.turbidity.value = SKY_PARAMS.turbidity;
      u.rayleigh.value = SKY_PARAMS.rayleigh;
      u.mieCoefficient.value = SKY_PARAMS.mieCoefficient;
      u.mieDirectionalG.value = SKY_PARAMS.mieDirectionalG;
      s.frustumCulled = false;
      return s;
    };

    /* Skybox de display: escala modesta e ANCORADO NA CÂMERA a cada frame.
       É assim que se resolve o conflito com o far plane sem inflar o far e
       destruir a precisão de depth — a caixa acompanha o observador, então
       nunca é alcançada nem cortada. Mantê-lo como mesh (e não como textura
       de fundo) preserva o HDR do céu até o ACES no fim do composer; num
       cube LDR o céu clipava e virava branco. */
    const sky = mk(20000);

    const captureSky = mk(10);
    const captureScene = new THREE.Scene();
    captureScene.add(captureSky);

    /* LDR de propósito. Com HalfFloatType o PMREM gerado a partir deste cubo
       sai com valores inválidos e enegrece tudo que usa o environment. O
       disco solar clipa, mas isso não custa nada aqui: quem faz o papel do
       sol é a luz direcional, não o IBL. */
    const cubeRT = new THREE.WebGLCubeRenderTarget(512);
    const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);

    return { sky, captureSky, captureScene, cubeRT, cubeCam };
  }, []);

  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl]);

  /* Alvo do sol como objeto real na cena: é dele que o three deriva a matriz
     do shadow camera. Sem estar na árvore, a sombra pode ficar defasada de um
     frame quando o sol se move. */
  const sunTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => () => {
    pmrem.dispose();
    rig.cubeRT.dispose();
    rig.sky.material.dispose();
    rig.sky.geometry.dispose();
  }, [pmrem, rig]);

  useEffect(() => {
    const dir = sunVector(sunAz, sunEl);
    rig.sky.material.uniforms.sunPosition.value.copy(dir);
    rig.captureSky.material.uniforms.sunPosition.value.copy(dir);

    /* Uma passada de cubo + um PMREM, só quando o sol muda — nunca por frame. */
    rig.cubeCam.update(gl, rig.captureScene);

    const pm = pmrem.fromCubemap(rig.cubeRT.texture);
    const prev = scene.environment;
    scene.environment = pm.texture;
    prev?.dispose?.();

    if (lightRef.current) {
      const l = lightRef.current;
      l.position.copy(dir).multiplyScalar(1800);
      /* sol baixo = mais quente e mais fraco, como fim de tarde */
      const t = THREE.MathUtils.clamp((sunEl - 8) / 40, 0, 1);
      l.color.setRGB(1.0, 0.62 + 0.30 * t, 0.34 + 0.58 * t);
      l.intensity = THREE.MathUtils.lerp(1.8, 3.6, t);
      l.target = sunTarget;
      l.target.updateMatrixWorld();
      l.shadow.needsUpdate = true;
    }
  }, [rig, pmrem, gl, scene, sunAz, sunEl, sunTarget]);

  /* Ancora o skybox na câmera. Barato (uma cópia de vetor) e é o que permite
     manter far=40 000 sem perder o céu. */
  useFrame(({ camera }) => { rig.sky.position.copy(camera.position); });

  return (
    <>
      <primitive object={rig.sky} />
      <directionalLight
        ref={lightRef}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={1.2}
        shadow-camera-near={400}
        shadow-camera-far={3400}
        shadow-camera-left={-700}
        shadow-camera-right={700}
        shadow-camera-top={700}
        shadow-camera-bottom={-700}
      />
      <primitive object={sunTarget} position={[0, 0, 0]} />
    </>
  );
}
