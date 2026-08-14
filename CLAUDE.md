# Instruções para Claude Code neste repositório

## O que é
Playground de referência visual (Three.js, arquivo único `index.html`) + spec Unity (`SPEC.md`) para o sistema de estilos cartográficos do digital twin da Lab Secreto.

## Regras
- `SPEC.md` é a fonte de verdade conceitual. Toda mudança de comportamento no playground que contradiga a spec exige atualizar a spec no mesmo commit (e vice-versa).
- `index.html` permanece **arquivo único e autocontido** (CDN só para three.min.js). Não introduzir build step, npm, nem frameworks — o valor do arquivo é ser portável e legível como referência.
- O GLSL deve permanecer portável para HLSL: evitar features fora do subset comum (sem SSBO, sem texelFetch onde texture2D resolve).
- Preservar as cinco "decisões que não devem regredir" listadas no README.
- Testes manuais mínimos após qualquer mudança de shader: zoom contínuo 50 m↔50 km no modo Px/metro sem duplicidade/moiré/pop; polígono com furo íntegro; oclusão por edifícios; pan/orbit/pinça no mobile.
- Deploy: GitHub Pages a partir de `main`, raiz (Settings → Pages → Deploy from a branch). Sem workflow de build. Publicar = dar push em `main`.

## Vocabulário do domínio
Berços de atracação, zonas de fundeio, canal de navegação, curvas de nível terrestres e batimétricas — os presets do playground mapeiam esses conceitos e devem continuar mapeando.
