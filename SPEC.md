# SPEC v2 — Preenchimentos Cartográficos Procedurais para Polígonos Georreferenciados em Unity (HDRP)

Versão unificada: mescla da spec original com contribuições de segunda revisão. Substitui integralmente a v1.

**Objetivo:** sistema de renderização de polígonos 2D (camadas vetoriais — MVT e GeoJSON) sobre cena 3D georreferenciada com 3D Tiles, com catálogo de preenchimentos cartográficos procedurais, estilo orientado a dados, comportamento correto em todos os níveis de zoom, continuidade entre tiles e oclusão pelo 3D. Entregar **cena demo** que exercite tudo.

---

## 0. Decisões confirmadas

- **Pipeline: HDRP.** Pass via `CustomPass` (§5). Atenção obrigatória ao camera-relative rendering (§9.1).
- **Georreferenciamento: solução própria** — Web Mercator (EPSG:3857) + origem local flutuante (§8). Integrar com o `GeoOrigin` existente do projeto se houver.
- **Modos de escala do padrão: os três** — `WorldMeters`, `ScreenPixels`, `Hybrid` — selecionáveis por estilo (§3). Default: `Hybrid`.
- **Fontes: MVT/PBF e GeoJSON**, atrás de interface comum (§6).
- **Shader procedural unlit** (sem iluminação/sombras — é overlay cartográfico), HLSL puro, sem Shader Graph.
- **Tessellator: LibTessDotNet vendorado** (não implementar ear-clipping próprio) (§7).
- **Unity 6.3 LTS** (HDRP 17.x). Usar as APIs vigentes de `CustomPass` nesta versão; se algum caminho tiver migrado para Render Graph, seguir o recomendado — nunca APIs deprecadas.
- **Elevação: `ClampToTerrain` entra no MVP** (§7.5) — polígonos acompanham o relevo por amostragem de altura + subdivisão de malha.
- **Picking por clique entra no MVP** (§7.6) — CPU-side, sem colliders por polígono, com highlight de seleção no shader.
- Plataforma alvo: desktop. Alvo de performance: 60 fps com ~5k polígonos / 500k triângulos visíveis, < 2 ms de GPU no pass.

Assunção restante: `FeatureId` estável fornecido pelo servidor (fallback: hash da geometria). Nada bloqueia o início — começar pelo milestone 1 (§13).

---

## 1. Catálogo de padrões

### MVP
Cada estilo é uma composição de camadas: `background` (sólido/wash) + `pattern` + `outline` (mesh separado). Todas opcionais.

| ID | Padrão | Parâmetros específicos | Uso cartográfico típico |
|---|---|---|---|
| `Solid` | sólido/wash | cor, alpha | classes, zonas, seleção |
| `Hatch` | linhas paralelas | ângulo, espaçamento, espessura | restrição, zonas especiais (SLD `shape://slash`) |
| `CrossHatch` | duas famílias de linhas | ângulo base, delta (default 90°), espaçamento, espessura | restrição forte, sobreposição |
| `Dots` | grade de pontos | espaçamento, raio, brick offset (bool) | stipple geológico, transição |
| `SparseDots` | Dots com espaçamento ≥ 3× | idem | incerteza, marcação leve |
| `Plus` | símbolo “+” em grade | espaçamento, braço, espessura | SLD `shape://plus`, embasamento |
| `Cross` | símbolo “×” em grade | idem, rotacionado 45° | interdição, alerta (exige legenda) |
| `Checker` | tabuleiro | tamanho da célula | condição composta (usar com moderação) |
| `DiagonalBands` | faixas largas | ângulo, período, fração preenchida | corredores, servidões |
| `Outline` | contorno | espessura, cor, dash (traço/vão; 0 = sólido) | delimitação, casing |

Nota semântica (do revisor, correta): o desenho não carrega significado universal — **a semântica é declarada no estilo/legenda**, nunca inferida do padrão. `CrossHatch` (linhas cruzadas) ≠ `Cross` (símbolos ×) ≠ `Dots` (stipple) ≠ dot-density (quantitativo — fora do MVP).

### Extensões (§12)
Textura tileable/atlas de símbolos SDF (glifos S-52/FGDC: âncora, marsh…), dot-density quantitativo, halo/máscara de seleção, gradiente, jitter determinístico no stipple (`hash(featureId, cellX, cellY)` — determinístico entre frames e reloads de tile).

---

## 2. Estilo orientado a dados

**Fonte da verdade: JSON** (versionável, servível pelo servidor de tiles no futuro). `FillStyleAsset : ScriptableObject` é o cache de import no editor. Alterar estilo **nunca reconstrói malha** — só material/`MaterialPropertyBlock`.

```json
{
  "id": "restricted-area",
  "filter": { "sourceLayer": "zones", "property": "restriction", "equals": "high" },
  "pattern": {
    "type": "CrossHatch",
    "scaleMode": "Hybrid",
    "spacing": 12, "spacingUnit": "meters",
    "lineWidth": 1.5,
    "rotation": 45,
    "minPixelSpacing": 6, "maxPixelSpacing": 48, "targetPixelSpacing": 24,
    "seed": 123
  },
  "appearance": {
    "baseColor": "#D64545", "baseOpacity": 0.25,
    "patternColor": "#7A1010", "patternOpacity": 0.9,
    "outlineColor": "#FF5050", "outlineWidthMeters": 2, "outlineDash": [8, 4],
    "blendMode": "AlphaBlend"
  },
  "visibility": { "minZoom": 11, "maxZoom": 24, "fadeRange": 1.0 },
  "elevation": { "mode": "AbsoluteHeight", "heightMeters": 0.0, "offsetMeters": 0.05 },
  "occlusion": { "seeThroughGhost": false, "ghostOpacity": 0.15 }
}
```

- `blendMode`: `AlphaBlend` (default; transparência real, sem depth write) ou `AlphaClipDither` (clip + dither Bayer 4×4; mais previsível em 3D, pode escrever depth se necessário).
- `StyleResolver`: lista ordenada de regras `filter → styleId` (igualdade de atributo no MVP; primeira que casa vence; estilo fallback obrigatório).

---

## 3. Modos de escala do padrão

O “zoom” aqui é **visual, derivado da câmera** (px/m no fragmento) — nunca o `z` do vector tile, que só determina resolução de dados.

### `WorldMeters`
Tamanho físico real (`spacing` em metros). Fase e escala ancoradas no mundo. Coerente geograficamente; some em zoom distante e satura em zoom próximo — usar com `visibility` restritiva. Caso de uso: espaçamento com significado métrico (grade de 10 m).

### `ScreenPixels`
Tamanho constante em px (comportamento Mapbox/SLD). Legibilidade constante; o padrão “nada” sobre o terreno com o movimento da câmera (documentar o trade-off no README).

### `Hybrid` (default) — nome de produto/UI: **“Px/metro”** (mesma coisa; o playground usa o nome de produto)
Fase ancorada no mundo + espaçamento adaptado por **snapping log2 com crossfade** — não por clamp contínuo:

> Racional: clamp contínuo do espaçamento em px faz o espaçamento em metros variar continuamente com o zoom → as linhas deslizam sobre o terreno durante o zoom. Snapping em potências de 2 (técnica de curvas de nível/graticule) mantém o padrão estático em mundo dentro de cada nível, com transição por crossfade. `minPixelSpacing`/`maxPixelSpacing` viram os limites do snapping; abaixo do mínimo, **fade para tom** (§9.4), não desaparecimento abrupto.

---

## 4. Visibilidade e comportamento por zoom

Camada de visibilidade por estilo, avaliada por frame na CPU (zoom visual da câmera → alpha global do batch):

- `minZoom` / `maxZoom` / `fadeRange` (em níveis de zoom visual equivalente; fade linear, sem popping).
- **Regras de legibilidade** (avaliadas por batch/polígono, CPU):
  - símbolos (`Plus`/`Cross`/`Checker`): suprimir camada de padrão quando o glifo projetado < 8 px (fade para background);
  - `Dots`: espaçamento projetado nunca < 4–6 px (o snapping do Hybrid garante; em `WorldMeters`, fade para tom);
  - polígonos pequenos (< ~32 px de diagonal projetada): renderizar só background + outline;
  - `CrossHatch`/`Checker`: exigir área projetada mínima (config, default 64×64 px).
- Presets recomendados por escala visual (guia para os estilos da demo, não hard-code): visão geral → wash discreto, padrões ocultos; regional → wash + borda + hachura esparsa; operacional → wash + padrão pleno; local → padrão detalhado + bordas reforçadas.

---

## 5. Arquitetura de renderização (HDRP)

### 5.1 Pass dedicado
- `VectorOverlayCustomPass : CustomPass`, `CustomPassVolume` global, injection point **`BeforeTransparent`** — depth dos opacos (3D Tiles/terreno) completo → oclusão por depth test. Se os 3D Tiles do projeto não escreverem depth até esse ponto, ativar/criar depth-only pass anterior (**ponto crítico de integração — verificar no dia 1**).
- Desenho via `CommandBuffer.DrawMesh` sobre lista de batches do `CartographicPolygonRenderer` (sem GameObject por polígono/linha/ponto). Culling na CPU por bounds de batch × frustum.
- Shader unlit `Tags { "LightMode" = "SRPDefaultUnlit" }`.
- Estado: `ZTest LEqual` (**nunca `Always`**), `ZWrite Off` (On permitido só em `AlphaClipDither`), `Blend SrcAlpha OneMinusSrcAlpha`, `Cull Off` (configurável).
- **Z-fight:** `Offset -1, -1` + `offsetMeters` por estilo (configurável — depende da escala local).

### 5.2 Modo “visível através” (`seeThroughGhost`)
Segunda sub-passada `ZTest Greater`, mesmo shader, alpha × `ghostOpacity`, padrão suprimido (só tint). Efeito fantasma padrão de digital twin. Implementar; default off.

### 5.3 Batching
Agrupar por `(TileKey, styleId)` → um mesh combinado por grupo (índices 32-bit se necessário), um material por estilo, overrides por `MaterialPropertyBlock`. Zero alocação por frame no pass.

---

## 6. Fontes de dados

```csharp
public interface IPolygonSource {
    Task<IReadOnlyList<PolygonFeatureData>> LoadTileAsync(TileKey tile, CancellationToken ct);
}
// Implementações: MvtPolygonSource, GeoJsonPolygonSource, MockPolygonSource (procedural), FileTileSource (fixtures), HttpTileSource (template {z}/{x}/{y}.mvt)
```

```csharp
public class PolygonFeatureData {
    public string FeatureId;          // estável se o servidor fornecer; senão hash de geometria [ASSUNÇÃO]
    public string SourceLayer;
    public TileKey Tile;
    public List<PolygonRing> Rings;   // exterior + holes, winding normalizado
    public Dictionary<string, object> Properties;
    public double2 MercatorBoundsMin, MercatorBoundsMax;
    public int StyleIndex;
}
```

**Decoder MVT (spec 2.1)** — parser protobuf minimal próprio, deve suportar: Polygon/MultiPolygon (Point/LineString: decodificar e ignorar por ora), anéis externos/internos e buracos, winding inconsistente (normalizar por área assinada), zigzag/delta, `extent` variável (**não assumir 4096**), featureId e atributos, features cortadas/estendidas por buffer, features duplicadas em tiles adjacentes (dedup por featureId no nível de cena é extensão; no MVP o clipping por tile já evita dupla marcação visual).

Conversão: `coord tile → Mercator (double) → local Unity (float, via origem) `. Nunca coordenadas projetadas grandes em float.

---

## 7. Geometria

1. **Clipping na borda exata do tile** (Sutherland–Hodgman em espaço de tile, antes de triangular). Motivo: o buffer do MVT estende features além da borda; com alpha blend, o overdraw entre vizinhos causaria dupla marcação.
2. **Triangulação: LibTessDotNet** (vendorado em `ThirdParty/`, licença no README). Cobre: côncavos, buracos, multipolígonos, winding inconsistente, self-intersection leve, degenerados. Não escrever tessellator próprio.
3. **Vértice:** `position (float3)` + `patternCoordMercator (float2, relativo à origem — ver §8)` + `styleIndex` + `featureIndex` (índice local no batch, para seleção — §7.6). O UV do padrão é **derivado da coordenada geográfica, nunca do tile ou do polígono**.
4. **Outline:** mesh de fita por anel (miter com limite, fallback bevel), espessura em metros no MVP. **Suprimir em arestas de clipping**: arestas cujos dois vértices estão na borda do tile (tolerância = buffer) não recebem outline.
### 7.5 Elevação — `ClampToTerrain` no MVP

Enum completo na API: `AbsoluteHeight` (plano XZ na cota do estilo/atributo), `ClampToTerrain`, `RelativeToTerrain` (clamp + offset constante). Os três funcionais no MVP; clamp é o default dos estilos da demo.

Mecanismo do clamp:
- `ITerrainSampler { float SampleHeightMeters(double2 mercator); }`. Implementação MVP: `PhysicsRaycastSampler` — raycast vertical contra os colliders do terreno/3D Tiles. A demo garante colliders; com tileset real, exigir geração de colliders no tileset ou trocar o sampler (anotar no README como requisito de integração).
- **Subdivisão antes de amostrar:** triângulos com aresta > `maxEdgeMeters` (config; default 25 m, adaptativo ao tamanho do polígono) são subdivididos (split recursivo de arestas na malha já triangulada) — um triângulo grande não pode atravessar o relevo. Depois, altura amostrada por vértice + `offsetMeters`.
- Amostragem no load do tile. O LOD dos 3D Tiles pode alterar o relevo depois: MVP expõe `Reclamp()` público (+ botão na demo); reclamp automático por evento do tileset é extensão (§12).
- O z-offset (§5.1) continua necessário — o clamp aproxima, não cola.
- Interação com o padrão: `patternCoordMercator` não muda com o clamp (o padrão é planimétrico, projetado de cima — comportamento cartográfico correto; hachura “métrica” medida ao longo da encosta seria outra semântica, fora de escopo).

### 7.6 Picking e seleção (MVP)

- **Sem colliders por polígono.** `CartographicPolygonPicker.Pick(Ray) → PickResult { FeatureId, SourceLayer, Properties, HitMercator }`:
  1. raycast físico contra terreno/tiles → ponto de impacto → Mercator (double);
  2. filtro grosso por bounds Mercator das features;
  3. teste fino point-in-polygon (ray casting, respeitando buracos) sobre os anéis originais em double.
- **Highlight sem rebuild:** uniform `_SelectedFeature` por batch; o shader compara com o `featureIndex` do vértice e aplica boost de seleção (tint no background + reforço do outline). Selecionar/desselecionar nunca reconstrói malha.
- Evento C# `OnFeaturePicked(PickResult)`; a demo exibe `FeatureId` + properties no painel.
- Picking pixel-perfect por ID-buffer GPU fica como extensão (§12).

---

## 8. Precisão e origem flutuante

- Tudo em `double` (Mercator) até a conversão final para float local.
- `GeoOrigin`: `originMercator (double2)` → posição Unity = `mercator − origin`. Rebase quando câmera > 50 km da origem (evento; batches transladados ou regenerados).
- Fase do padrão estável através de rebase: CPU calcula em double o resíduo `originMercator mod maxSpacing` e envia `_WorldToPatternOffset (float2)` pequeno ao shader.

---

## 9. Shader procedural (`CartographicPolygon.shader` + `PatternSdf.hlsl`)

`multi_compile`: `_PATTERN_{SOLID,HATCH,CROSSHATCH,DOTS,PLUS,CROSS,CHECKER,BANDS}` × `_SCALE_{WORLD,SCREEN,HYBRID}` × `_BLEND_{ALPHA,CLIPDITHER}`.

Uniforms: `_BaseColor, _BaseOpacity, _PatternColor, _PatternOpacity, _Spacing, _LineWidth, _Rotation, _WorldToPatternOffset, _TargetPx, _MinPx, _MaxPx, _MeanCoverage, _GlobalFade, _Seed`.

### 9.1 Espaço do padrão

> **HDRP — camera-relative rendering:** `positionWS` no shader é relativo à câmera. Para fase estável no modo World/Hybrid, usar `GetAbsolutePositionWS(posInput.positionWS)` (ou o `patternCoordMercator` do vértice, preferível — já vem estável da CPU) antes de calcular o padrão. **Bug nº 1 esperado — validar no primeiro quad de teste movendo a câmera.**

```hlsl
float2 PatternSpaceWorld(float2 patternCoord) { return patternCoord + _WorldToPatternOffset; }
float2 PatternSpaceScreen(float4 posCS)       { return (posCS.xy / posCS.w * 0.5 + 0.5) * _ScreenParams.xy; }
```

### 9.2 SDFs de referência
```hlsl
float SdHatch(float2 p, float ang, float s) {
    float y = p.x * sin(ang) - p.y * cos(ang);
    return abs(frac(y / s) - 0.5) * s;
}
float SdCrossHatch(float2 p, float a, float da, float s) { return min(SdHatch(p,a,s), SdHatch(p,a+da,s)); }
float2 CellUv(float2 p, float s, bool brick, out float2 id) {
    float2 q = p / s; id = floor(q);
    if (brick && ((int)id.y & 1) == 1) { q.x += 0.5; id = floor(q); }
    return (frac(q) - 0.5) * s;
}
float SdDot(float2 c, float r) { return length(c) - r; }
float SdPlus(float2 c, float arm, float t) {
    float2 a = abs(c);
    return min(max(a.x - arm, a.y - t), max(a.y - arm, a.x - t));
}
// Cross = SdPlus com c rotacionado 45°. Checker: sign por paridade de célula. Bands: SdHatch com lineWidth = fração do período.
```

### 9.3 Anti-aliasing
```hlsl
float Coverage(float sd, float halfW) {
    float aa = fwidth(sd);
    return 1.0 - smoothstep(halfW - aa, halfW + aa, sd);
}
```
Objetivos: sem serrilhado, sem cintilação, sem moiré, sem desaparecimento abrupto. `_BLEND_CLIPDITHER`: threshold com matriz Bayer 4×4 sobre a coverage.

### 9.4 Adaptação de zoom — modo `Hybrid` (LOD hierárquico)

> **Nunca implementar como crossfade de dois padrões completos** (avaliar o padrão em s0 e s1 e fazer lerp): as fases não coincidem e o resultado é duplicidade visível — linhas/símbolos em pares (bug validado empiricamente no playground de referência). O mecanismo correto é hierárquico: alinhar a fase para que **o nível grosso seja subconjunto do fino** (linhas em `k·s`, células centradas em `k·s`) e fazer fade **apenas dos elementos intermediários** (índice/célula de paridade ímpar).
>
> **Segunda lição empírica (igualmente crítica): o nível e a transição são GLOBAIS e TEMPORAIS, nunca por fragmento.** Calcular `lf` por fragmento em câmera perspectiva faz cada região do chão ficar num ponto diferente do fade — a cena inteira vive num "meio-fade" permanente com elementos de opacidades misturadas (validado empiricamente). O modelo correto é a pirâmide Mapbox: a CPU escolhe **um nível por frame** a partir do zoom da câmera (px/m no centro/alvo), com **histerese** (~±0,75 nível) para não oscilar; o padrão é puramente world-space dentro do nível (escala 100–200% em tela com o zoom); a troca de nível dispara uma **transição temporal de ~0,3 s** uniforme na superfície: `f` anima 0→1 (ou 1→0) como uniform, os elementos de paridade ímpar fazem fade, e os tamanhos (espessura/braço/símbolo) crescem continuamente por `2^f` para chegar proporcionais ao nível seguinte — sem pop de tamanho.

```hlsl
float pxPerMeter = 1.0 / length(fwidth(patternCoord));
float spacingPx  = _Spacing * pxPerMeter;
float lf = log2(_TargetPx / spacingPx);
lf = clamp(lf, log2(_MinPx / spacingPx), log2(_MaxPx / spacingPx));
float s = _Spacing * exp2(floor(lf));      // nível fino ativo
float f = frac(lf);                        // 0..1 dentro do nível

// Linhas em k*s; índices ímpares fazem fade:
float n = floor(x / s + 0.5); float d = abs(x - n*s);
float odd = step(0.5, abs(fmod(n, 2.0)));
cov = lineCoverage(d, halfWidthPx / pxPerMeter) * lerp(1.0, 1.0 - f, odd);

// Células centradas em k*s (q = p/s + 0.5); célula com id ímpar em qualquer eixo faz fade.
// Espessura de linha e tamanho de símbolo derivados de px (constantes em tela):
//   halfWidth = 0.5 * (_LineWidth/_Spacing) * _TargetPx / pxPerMeter
//   armLen    = 0.30 * _TargetPx / pxPerMeter
// Checker: sem hierarquia possível — snap discreto em round(lf), sem fade.
```
- Abaixo de `_MinPx` projetados (só no modo `WorldMeters`, onde não há hierarquia): lerp da camada de padrão para `_MeanCoverage` (cobertura média pré-computada por estilo) — **fade para tom**, o zoom out vira o “cinza” que a hachura historicamente codifica.
- Acima de `_MaxPx`: o clamp de `lf` congela no nível máximo (evita uma linha gigante).
- `WorldMeters`: pular tudo isso; `ScreenPixels`: espaçamento fixo em px.
- **Referência executável:** o playground web (`cartographic-pattern-lab-3d.html`) implementa exatamente este algoritmo em GLSL — portar 1:1 (`fract`→`frac`, `mix`→`lerp`, `mod`→`fmod` com cuidado de sinal: usar `n - 2.0*floor(n/2.0)`).

### 9.5 Composição
`background` embaixo, `pattern` por cima (alpha compositing padrão), `_GlobalFade` (visibilidade §4) multiplica tudo. Outline é mesh/shader separado (`VectorOutline.shader`, com dash por distância acumulada ao longo do anel — atributo de vértice).

---

## 10. Demo (`CartographicPatternsDemo.unity`)

Conteúdo da cena:
- Terreno **com relevo** (Unity Terrain ou mesh deslocado por heightmap, com collider — obrigatório para exercitar o `ClampToTerrain`) + blocos 3D primitivos (papel dos 3D Tiles: oclusão + ghost mode) + slot para conectar tileset real.
- Fixtures em `StreamingAssets/fixtures/` (geradas por `tools/make_fixtures.py`, incluído): polígono convexo, côncavo, com buraco, multipolígono, polígono grande cortado entre **dois tiles adjacentes** (entregar ambos), polígonos pequeno/médio/grande. Mesmo dataset em `.mvt` e `.geojson`.
- Um par de polígonos idênticos lado a lado com o mesmo estilo em `WorldMeters` vs `ScreenPixels` vs `Hybrid` (três cópias) para comparação direta.
- Câmera orbital, zoom exponencial (~50 m a ~50 km equivalentes).
- 6+ estilos JSON prontos (inspirações reais): zona restrita (CrossHatch vermelho + outline dash), fundeio (Plus azul esparso), área dragada (Dots + outline dash), sobreposição (Hatch 45°), buffer (Solid alpha baixo), limite administrativo (Outline only), corredor (DiagonalBands).

HUD/painel (`CartographicPatternPanel`, IMGUI ou UI Toolkit):
`Pattern Type · Base/Pattern Color · Opacity · Spacing · Line Width · Rotation · Scale Mode · Min/Max Zoom · Z Offset · Blend Mode · Terrain Mode · Reclamp · Show Outline · Show Tile Boundaries · Ghost Mode · Fonte (MVT / GeoJSON / Mock)` + leitura de `px/m`, nível de snapping ativo e FPS. Tecla para deslocar visualmente os dois tiles adjacentes (evidenciar continuidade de fase). **Clique** seleciona a feature sob o cursor (highlight) e o painel exibe `FeatureId` + properties.

---

## 11. Critérios de aceite

1. Todos os padrões corretos sobre polígonos côncavos; buracos vazios; multipolígonos corretos.
2. Sem costura visível entre tiles adjacentes; o padrão **não reinicia por tile** (fase contínua em qualquer nível de zoom).
3. Zoom contínuo 50 m ↔ 50 km sem moiré, sem popping, sem “linha única gigante”; crossfade de snapping imperceptível; em `Hybrid`, padrão **não desliza** sobre o terreno durante zoom dentro de um nível.
4. Padrão estável durante movimento de câmera (valida camera-relative).
5. Oclusão correta por terreno/blocos; ghost mode funcional; sem z-fighting perceptível em plano coincidente.
6. Nenhum GameObject por polígono/linha/ponto; zero alocação por frame no pass (Profiler).
7. Alterar estilo (cor, opacidade, rotação, espaçamento, scale mode) **não reconstrói malha**.
8. Decoder aceita `extent ≠ 4096`; features cortadas por tile sem falhas; outline suprimido em arestas de clipping.
9. `AlphaClipDither` e `AlphaBlend` funcionais e alternáveis.
10. Visibilidade min/max/fade funcional; regras de legibilidade (§4) ativas.
11. Testes (EditMode) para: decoder MVT (fixture binária), winding/normalização, clipping, triangulação com buracos e multipolígono, subdivisão de malha, point-in-polygon com buracos, resíduo de fase pós-rebase.
12. `ClampToTerrain`: polígonos acompanham o relevo sem triângulos atravessando morros/vales (subdivisão ativa); `Reclamp()` funcional; padrão contínuo e ancorado mesmo sobre superfície inclinada.
13. Picking: clique retorna a feature correta (clicar dentro de um buraco **não** seleciona); highlight sem rebuild de malha; funciona sobre terreno inclinado.
14. `HttpTileSource` compila e busca tile real se apontado (teste manual).
15. README: instalação, arquitetura, trade-offs dos 3 scale modes, requisito de colliders para o clamp, limitações, licença LibTessDotNet.

## 12. Fora do MVP (registrar no README)

Reclamp automático por evento de LOD do tileset, draping/decal sobre a malha dos 3D Tiles (alternativa ao clamp por vértice), outline screen-space, atlas SDF de símbolos (S-52/FGDC), dot-density quantitativo, halo/máscara de seleção, gradiente, jitter determinístico por célula (`hash(featureId, cell)`), dedup de features entre tiles por featureId, estilos servidos pelo servidor (subset Mapbox Style Spec), picking pixel-perfect por ID-buffer GPU, instanciamento GPU de símbolos 3D.

## 13. Ordem de implementação (milestones)

1. **Shader isolado num quad hardcoded**: SDFs, AA, camera-relative, os 3 scale modes, snapping+crossfade, fade-to-tone. *Gate de avaliação visual antes de qualquer tubulação.*
2. LibTessDotNet + fixtures GeoJSON → meshes na cena.
3. CustomPass HDRP + oclusão + ghost + z-offset.
4. Decoder MVT + clipping + bordas de tile + outline.
5. `ClampToTerrain` (subdivisão + sampler + `Reclamp()`) + picking com highlight.
6. Estilos JSON + StyleResolver + visibilidade/legibilidade + HUD.
7. Testes + critérios de aceite + README.

## 14. Estrutura de arquivos

```
Assets/VectorOverlay/
  Runtime/
    Rendering/  VectorOverlayCustomPass.cs
    Geometry/   MvtParser.cs, GeoJsonParser.cs, RingNormalizer.cs, TileClipper.cs, OutlineMesher.cs, PolygonMesher.cs, MeshSubdivider.cs
    Geo/        GeoOrigin.cs, WebMercator.cs, TileKey.cs
    Terrain/    ITerrainSampler.cs, PhysicsRaycastSampler.cs
    Picking/    CartographicPolygonPicker.cs, PointInPolygon.cs
    Styling/    FillStyleAsset.cs, StyleSchema.cs (JSON), StyleResolver.cs, VisibilityEvaluator.cs
    Sources/    IPolygonSource.cs, MvtPolygonSource.cs, GeoJsonPolygonSource.cs, MockPolygonSource.cs, FileTileSource.cs, HttpTileSource.cs
    CartographicPolygonRenderer.cs
  ThirdParty/LibTessDotNet/            // vendorado, licença incluída
  Shaders/    CartographicPolygon.shader, VectorOutline.shader, PatternSdf.hlsl
  Styles/     *.json + FillStyleAssets importados
  Tests/      CartographicPatternTests.asmdef + testes EditMode
Scenes/CartographicPatternsDemo.unity
StreamingAssets/fixtures/
tools/make_fixtures.py
README.md
```


## 15. Representações 3D de demarcação (fase 2 — validadas visualmente no playground v4)

Cada estilo pode combinar até cinco representações, controladas pelo bloco `representation3d` do JSON de estilo (schema exportado pelo playground):

1. **Plano em cota fixa** — o pass do MVP, com `elevationMeters`. Some dentro do relevo; usar quando a cota tem significado (carta náutica, cota de projeto).
2. **Drape na geometria** — padrão projetado sobre 3D Tiles/terreno. No HDRP: **Decal Projector** com o material de padrão, ou máscara top-down (RT ortográfica dos polígonos) amostrada por posição de mundo num CustomPass com reconstrução por depth. O playground valida a segunda via (máscara + `evalPattern` compartilhado); a fase mundial do padrão garante continuidade sobre qualquer relevo, cruzando linha de costa e batimetria.
3. **Paredes de perímetro (cortinas)** — anéis subdivididos a ~8 m; base = `min(ITerrainSampler(x,z) − 0.6, topo − 1)` (clamp obrigatório: sem ele, terreno acima do topo gera quads invertidos — bug encontrado em revisão), topo em cota. Shader unlit transparente, `ZWrite Off`, gradiente vertical (α ≈0,34 na base → 0,05 no topo) + fio de luz no topo (`smoothstep(0.965, 1.0, vT)`). **Quatro estilos animados** (uniform `_WallStyle` + tempo global), repertório alinhado à prática de holograma/energy-shield da indústria (scanlines em Y de mundo; malha hexagonal + varredura grande):
   - `Pulse` — varreduras horizontais subindo (`frac(y/9 − t·0.25)`).
   - `Flow` — traços correndo ao longo do perímetro via distância acumulada `vD` (comunica direção; ideal para canal de navegação).
   - `Hex` — malha hexagonal por SDF (célula ~7 m no espaço (vD, y)) + varredura grande lenta (escudo).
   - `Energy` — interferência de senos em (vD, y) com duas frequências.
4. **Volume extrudado** — cortinas com base/topo planos + tampa superior (mesma triangulação do fill), α ≈0,10–0,18, pulso opcional (`0.8 + 0.25·sin(1.1t)` + bandas sutis subindo). Caso canônico: coluna d'água do canal/fundeio (−16 a +1 m).
5. **Volumes distribuídos** — grade PIP (~26 m) × camadas verticais (~12 m) dentro do prisma, GPU instancing de marcadores translúcidos (cap ~2,4k instâncias).

Regras transversais: todas as representações respeitam `visibility` (o fade global multiplica os alfas); paleta única por estilo (paredes/distribuição = `patternColor`, volume/tampa = `fillColor`); renderização no pass transparente pós-opacos com `ZTest LEqual` (oclusão por prédios/terreno de graça); ordem: mar < planos < cortinas/volumes < contornos. Curvas de nível (2 m/10 m, cores distintas acima/abaixo do zero) pertencem ao shader do terreno/3D Tiles, não ao sistema de estilos.

**Iluminação e realismo (validado no playground v6):** sombra direcional do sol (no playground: shadow map manual ortográfico 2048², PCF 3×3, bias 0.0025, piso de 28% para simular luz de céu — no HDRP: shadow maps nativos do Directional Light) com a regra semântica de que **overlays holográficos (paredes/volumes/planos de demarcação) não projetam nem recebem sombra** — são camada de informação; SSAO (contato dos edifícios com o chão, vincos de relevo — HDRP: Ambient Occlusion do Volume); fog aéreo aplicado a TODO shader de superfície (shaders custom não herdam o fog da engine — inconsistência clássica a evitar no Unity também); céu com gradiente zenith→horizonte + glow do sol, horizonte casado com a cor do fog; tone mapping ACES (default do HDRP); sol com azimute/elevação configuráveis invalidando o shadow map cacheado.

**Pós-processamento (linguagem visual "ops room"):** bloom **seletivo por limiar de luminância** (~0.55, soft knee até 0.90) — só os acentos animados (pulsos das paredes, glints da água, fio de topo) florescem; a paleta base fica intocada. Vinheta sutil (~0.30 nas bordas) e grão fino (±0.015) completam. No HDRP, usar Bloom/Vignette/Film Grain nativos do Volume com estes valores como ponto de partida; a regra de design é: brilho só onde há semântica (acento animado = informação), nunca na massa.

**Referência executável:** `cartographic-pattern-lab-3d.html` (v5) — GLSL portável 1:1 (`fract`→`frac`, `mix`→`lerp`), incluindo o pipeline de post manual (bright pass → blur separável meia-resolução ×2 → composite).
