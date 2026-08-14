# Instruções para Claude Code neste repositório

## O que é
Playground de referência visual (React Three Fiber) + spec Unity (`SPEC.md`) para o sistema de estilos cartográficos do digital twin da Lab Secreto.

## Prioridades, nesta ordem
1. **Performance** — a cena roda em tempo real, inclusive em mobile. Água com reflexão e SSAO são os custos maiores; `PerformanceMonitor` já escala o dpr e a resolução do refletor.
2. **Experiência** — o painel responde na hora; nada de travar durante o zoom.
3. **Fotorrealismo do ambiente** — terreno, água, edifícios e luz. **Não** dos overlays cartográficos, que são sintéticos de propósito.

## Regras
- `SPEC.md` é a fonte de verdade conceitual do sistema de padrões. Mudança de comportamento no playground que contradiga a spec exige atualizar a spec no mesmo commit.
- Preservar as cinco "decisões que não devem regredir" do README.
- O GLSL da **biblioteca de padrões** (`src/shaders/patterns.js`) deve continuar portável para HLSL: sem SSBO, sem texelFetch onde texture2D resolve. Os shaders de ambiente não têm essa restrição — usam chunks do three à vontade.
- Ambiente usa PBR (`three-custom-shader-material` sobre `MeshStandardMaterial`); overlays usam `ShaderMaterial` cru e unlit. Não misturar.
- Nada de estado de React por frame. Quem escreve uniforms a cada frame é o `FrameDriver`, e só ele.
- Preferir efeitos e helpers das bibliotecas (`@react-three/drei`, `@react-three/postprocessing`) a reimplementar à mão — a versão manual existia porque só o core do three vinha por CDN, e essa restrição acabou.

## Armadilhas já pagas (não repetir)
- `PMREMGenerator.fromCubemap` sobre um cube RT `HalfFloatType` gera environment inválido e **enegrece toda a cena**. Manter o cube de captura em LDR.
- O `Sky` do three quer escala ~450 000, o que é cortado por `camera.far=40 000`. A solução aqui é ancorar o skybox na posição da câmera a cada frame.
- Capturar o céu num cube LDR para usar como `scene.background` clipa o HDR e o céu vira branco. O fundo tem que ser o mesh, para o ACES do composer receber HDR.
- `csm_Roughness` / `csm_Metalness` / `csm_Emissive` / `csm_FragNormal` só existem se o material tiver o mapa correspondente — por isso os mapas 1×1 em `lib/procTextures.js`.

## Testes manuais mínimos após mudança de shader
Zoom contínuo 50 m↔50 km no modo Px/metro sem duplicidade/moiré/pop; polígono com furo íntegro; oclusão dos overlays pelos edifícios; pan/orbit/pinça no mobile.

## Deploy
GitHub Actions a cada push em `main` (`.github/workflows/deploy.yml`). Settings → Pages com fonte em **GitHub Actions**.

## Vocabulário do domínio
Berços de atracação, zonas de fundeio, canal de navegação, curvas de nível terrestres e batimétricas — os presets mapeiam esses conceitos e devem continuar mapeando.
