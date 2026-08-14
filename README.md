# Cartographic Pattern Lab

Playground de referência para o sistema de preenchimentos cartográficos e demarcação 3D do digital twin (Unity 6.3 LTS / HDRP). Serve como implementação de referência executável: o GLSL dos padrões porta para o HLSL da spec (`fract`→`frac`, `mix`→`lerp`).

No ar em **https://fbaetalab.github.io/lab-carto-examples/** — versão 2D de validação em `/lab-2d.html`.

## Stack

React 19 + React Three Fiber 9 + three 0.185, empacotado com Vite.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

## Divisão fundamental

O ambiente é **fotorrealista**; os overlays cartográficos são **holográficos** de propósito. É a divisão que um digital twin faz: cenário fisicamente plausível, dado sintético legível por cima. Os overlays não recebem iluminação nem sombra — se recebessem, a leitura da demarcação mudaria com a hora do dia.

| Ambiente (PBR) | Overlays (unlit) |
| --- | --- |
| terreno, edifícios, água, céu | plano, drape, paredes, volume, distribuição, borda |
| `MeshStandardMaterial` via `three-custom-shader-material` | `ShaderMaterial` cru |
| recebe IBL, sombra e fog | alfa puro, sem sombra |

## Estrutura

```
src/
  shaders/      patterns.js (biblioteca de padrões) · surfaces.js (PBR) · demarcation.js (overlays)
  scene/        SkyEnvironment · Terrain · Buildings · Ocean · Demarcation · Rig · Scene
  render/       uniforms · materials · FrameDriver · Post · readouts
  ui/           Header · Panel · controls · PatternGallery · Presets
  lib/          geometry · terrain · lod · textures · procTextures · exporters · color
  config.js     constantes do domínio · presets.js
```

`FrameDriver` é o único lugar que escreve nos uniforms por frame. O estado do React reage a mudanças de **controle**, nunca ao relógio — LOD e readouts não passam por `setState`.

## Iluminação

Céu Preetham capturado uma vez por mudança de sol, servindo três papéis: skybox ancorado na câmera, fonte de IBL via PMREM, e referência para cor/intensidade da luz direcional. O IBL é o que separa PBR crível de sombra chapada.

Pós-processamento pela stack pmndrs: N8AO, bloom por limiar de luminância, ACES e SMAA.

## Decisões que não devem regredir

1. Fase dos padrões ancorada em coordenadas de mundo (nunca UV por polígono/tile).
2. Modo Px/metro = pirâmide de níveis **global e temporal** (nível por frame com histerese; transição ~0,3 s uniforme) — nunca por fragmento, nunca crossfade de dois padrões completos (causa duplicidade).
3. Overlays holográficos não projetam nem recebem sombra.
4. Bloom só por limiar de luminância: brilho onde há semântica.
5. O plano e o drape compartilham o **mesmo objeto de uniforms** — se divergirem, o padrão sai diferente nas duas representações.

## Exportar

**PNG** (imagem calibrada) e **Copiar JSON** (parâmetros no schema da spec, incluindo `representation3d`). O JSON é a saída que atravessa a fronteira para a Unity.

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) roda `npm ci && npm run build` e publica `dist/` a cada push em `main`. Em Settings → Pages, a fonte precisa estar em **GitHub Actions**.
