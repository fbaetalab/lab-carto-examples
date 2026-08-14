import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useStore } from '../store.js';

/* Stack de pós. Substitui o pipeline manual que existia quando só o core do
   three vinha por CDN — bright/blur/composite/FXAA e o ping-pong de 5 render
   targets sumiram inteiros.

   N8AO reconstrói AO a partir do depth (não exige normal pass, então funciona
   com os materiais custom). O Bloom continua por LIMIAR de luminância, não
   global: brilho só onde há semântica — janelas acesas, fio de luz no topo das
   paredes, glint do sol na água. */
export default function Post() {
  const post = useStore((s) => s.scene.post);
  const ssao = useStore((s) => s.scene.ssao);
  const bloom = useStore((s) => s.scene.bloom);

  if (!post) return null;

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {ssao ? (
        <N8AO
          aoRadius={18}
          distanceFalloff={0.9}
          intensity={2.4}
          halfRes
          screenSpaceRadius={false}
        />
      ) : null}
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.62}
        luminanceSmoothing={0.28}
        mipmapBlur
        radius={0.72}
      />
      <Vignette offset={0.42} darkness={0.38} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}
