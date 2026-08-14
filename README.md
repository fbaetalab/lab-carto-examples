# Cartographic Pattern Lab

Playground de referência para o sistema de preenchimentos cartográficos e demarcação 3D do digital twin (Unity 6.3 LTS / HDRP). Serve como **implementação de referência executável**: o GLSL daqui porta 1:1 para o HLSL da spec (`fract`→`frac`, `mix`→`lerp`).

- **`index.html`** — playground 3D (Three.js r128, arquivo único): terreno costeiro com curvas de nível e batimetria, 9 padrões procedurais, 3 modos de escala (Metros / Px por metro-pirâmide / Pixels), demarcação 3D (drape, paredes animadas ×4 estilos, volumes, distribuição), sombras do sol (shadow map manual + PCF), SSAO, bloom seletivo, ACES, FXAA.
- **`lab-2d.html`** — versão 2D original (validação rápida de padrões).
- **`SPEC.md`** — spec completa para implementação em Unity, incluindo as lições empíricas do playground (§9.4 LOD hierárquico global/temporal; §15 representações 3D).

## Uso
No ar em **https://fbaetalab.github.io/lab-carto-examples/** (raiz = `index.html`; a versão 2D fica em `/lab-2d.html`). Localmente, qualquer servidor estático serve — `file://` também funciona, exceto upload de símbolo em alguns browsers.

Publicação: GitHub Pages servindo `main` na raiz (Settings → Pages → *Deploy from a branch*). Publicar é dar push em `main` — sem build step, sem npm.

Exportar referências: **PNG** (imagem calibrada) + **Copiar JSON** (parâmetros no schema da spec, incluindo `representation3d`).

## Decisões de design que não devem regredir
1. Fase dos padrões ancorada em coordenadas de mundo (nunca UV por polígono/tile).
2. Modo Px/metro = pirâmide de níveis **global e temporal** (nível por frame com histerese; transição ~0,3 s uniforme) — nunca por fragmento, nunca crossfade de dois padrões completos (causa duplicidade).
3. Overlays holográficos (paredes/volumes/planos) não projetam nem recebem sombra.
4. Bloom só por limiar de luminância: brilho onde há semântica.
5. Fog manual em todo shader custom de superfície.
