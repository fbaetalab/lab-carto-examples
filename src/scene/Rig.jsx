import { OrbitControls } from '@react-three/drei';

/* Câmera orbital. Substitui o rig manual (theta/phi/dist + gestos de pinça
   escritos à mão) — OrbitControls já cobre orbitar, pan com botão direito,
   pinça de dois dedos e os limites, com damping de brinde.

   screenSpacePanning=false faz o pan correr no plano do chão, que é o
   comportamento certo para uma cena cartográfica: arrastar move o mapa, não
   a altura. */
export default function Rig({ target = [60, 0, 0] }) {
  return (
    <OrbitControls
      makeDefault
      target={target}
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
      minDistance={25}
      maxDistance={18000}
      minPolarAngle={0.06}
      maxPolarAngle={1.52}
      zoomSpeed={0.9}
      rotateSpeed={0.7}
    />
  );
}
