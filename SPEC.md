# Spec — Preenchimentos Cartográficos para Polígonos Vetoriais em Unity 3D

**Projeto:** Sistema de simbolização de área (fill patterns) para camadas vetoriais
georreferenciadas em um visualizador Unity 3D com 3D Tiles.
**Alvo da spec:** Claude Code (ou qualquer agente de código) implementar os exemplos.
**Versão:** 1.1 — 2026-08-13 (ajustada para **Unity 6.3 LTS + HDRP**; v1.0 era URP)

---

## 0. Escopo, premissas e decisões assumidas

O usuário não fixou preferências de stack; esta spec assume os defaults abaixo
(todos intercambiáveis — anotados onde a escolha impacta o código):

| Decisão | Valor definido pelo usuário | Observações |
|---|---|---|
| Unity | **Unity 6.3 LTS (6000.3)** | C# 9; HDRP roda sobre RenderGraph internamente |
| Render pipeline | **HDRP** | Sem Renderer Features do URP — usa-se **Custom Pass Volume** (custom passes) e **HDRP Decal Projectors** |
| Stack 3D Tiles | **Cesium for Unity** (referência) | **Pré-requisito T0:** validar versão do plugin com suporte a HDRP; fallback: ArcGIS Maps SDK for Unity (suporta HDRP) ou tileset próprio |
| Formato vetorial | **MVT (Mapbox Vector Tile)** + GeoJSON | TopoJSON, binário próprio |
| Plataforma | Desktop (HDRP não roda em mobile/WebGL) | Alinhado ao HDRP; VR possível |
| Técnica de padrão | **Shader Graph (HDRP target)** procedural (principal) + **HDRP Decal** para draping em fachadas/terreno | Só textura, só geometria instanciada |
| Unidade de densidade do padrão | **Constante em tela** (como GIS), com tiers de LOD | Constante em metros |

**O que está no escopo:** polígonos (com buracos), vindos de vector tiles ou GeoJSON;
preenchimentos padrão cartográfico; render pass dedicado com oclusão correta contra
malhas 3D (3D Tiles/terreno/prédios); comportamento dependente de zoom.

**Fora do escopo:** simbolização de linhas e pontos (mencionada só onde compartilha
infraestrutura); edição de feições; re-projeção arbitrária (assume Web Mercator /
ECEF via Cesium ou ENU local).

---

# PARTE I — FUNDAMENTAÇÃO CARTOGRÁFICA

## 1. Por que padrões de preenchimento existem

Antes da cor barata, mapas impressos distinguiam áreas por **texturas gráficas**:
hachuras, pontilhados, grades. Jacques Bertin formalizou isso em *Sémiologie
Graphique* como **variáveis visuais** aplicáveis a símbolos de área:

- **Grão (tamanho do elemento)** — pontos/traços maiores ou menores.
- **Textura (densidade/arranjo)** — elementos mais ou menos próximos.
- **Orientação** — ângulo das hachuras (45°, 90°, etc.).
- **Forma** — pontos vs. cruzes vs. traços vs. símbolos figurativos.
- **Cor/valor** — tom médio resultante (uma hachura densa "vale" mais escuro).

Princípio perceptivo-chave: **em escala pequena (zoom baixo), um padrão é percebido
pelo olho como um tom médio contínuo** — a textura agrega-se em "valor". Isso governa
todo o comportamento por zoom (seção 3).

Um padrão cartográfico de área é totalmente descrito por 6 parâmetros:

1. **Elemento** (forma: traço, ponto, cruz, glifo).
2. **Arranjo** (grade quadrada, grade triangular/hexagonal "quincunx", aleatório controlado).
3. **Espaçamento** (distância centro-a-centro).
4. **Calibre/tamanho** (largura do traço, raio do ponto).
5. **Orientação** (rotação do campo de padrão).
6. **Cores** (traço/frente e fundo; fundo pode ser transparente ou sólido).

## 2. Catálogo dos principais padrões cartográficos

### 2.1 Preenchimento sólido (solid fill)
Cor uniforme, geralmente com alfa 0.3–0.8 para não esconder a base. É o default em
GIS digital. Em mapas impressos monocromáticos é substituído por *screentone*.
**Uso:** categorias qualitativas (cor) ou choropleth (valor).
**Parâmetros:** `fillColor`, `fillOpacity`, `outlineColor`, `outlineWidth`.

### 2.2 Hachura simples (hatch / line pattern)
Linhas paralelas retas cobrindo o polígono. O padrão cartográfico mais antigo
(limites em disputa, zonas de restrição, áreas "não classificadas").
**Variantes:** horizontal, vertical, diagonal (45° é a convenção), ângulo livre.
**Uso típico:** zoneamento, áreas de preservação, overlays de alerta.
**Parâmetros:** `spacing`, `lineWidth`, `angle`, `lineColor`, `backgroundColor`.

### 2.3 Hachura cruzada (cross-hatch)
Duas famílias de linhas paralelas cruzando (tipicamente 45°/135° ou 0°/90°).
Densidade percebida ~2× a da hachura simples → hierarquia de "mais intenso".
**Uso:** segundo nível de ênfase; áreas militares/restritas em cartas antigas.
**Parâmetros:** dois conjuntos de `angle/spacing/lineWidth` (geralmente espelhados).

### 2.4 Pontilhado (dot / stipple pattern)
Grade de pontos. Três arranjos clássicos:
- **Grade quadrada** — pontos alinhados em x/y.
- **Grade triangular (staggered / quincunx)** — linhas ímpares deslocadas ½ espaçamento;
  densidade visual mais uniforme, padrão em cartografia (símbolo de areia, vegetação).
- **Aleatório controlado (stipple)** — pontos pseudoaleatórios com densidade fixa
  (solos, desertos em mapas geológicos). Determinístico por semente para não "tremer"
  entre frames/tiles.

**Uso:** densidades populacionais (dot density), solos, cobertura esparsa.
**Parâmetros:** `spacing`, `dotRadius`, `arrangement`, `seed`, `dotColor`.

### 2.5 Grade de cruzes (cross / plus pattern)
Cruzes ("+") em grade — leitura intermediária entre ponto e linha. Muito usado em
atlas antigos e mapas temáticos monocromáticos. Variante: "x" (cruz a 45°).
**Parâmetros:** `spacing`, `armLength`, `lineWidth`, `angle` (0° = "+", 45° = "x").

### 2.6 Grade retangular / quadriculado (grid)
Linhas perpendiculares formando malha contínua (a "caixa" inteira, não cruzes
discretas). Usado para áreas urbanizadas/plantadas em cartas topográficas antigas.
**Parâmetros:** `spacingX`, `spacingY`, `lineWidth`, `angle`.

### 2.7 Padrão de símbolos (symbol / picture pattern fill)
Glifos repetidos em grade: arvorezinhas (floresta), tufo de capim (pastagem),
cruzes de cemitério, "v" de pântano, espigas (agricultura). É o *pattern fill* do
QGIS/ArcGIS com SVG/markers e o `fill-pattern` do Mapbox/MapLibre (sprite PNG).
**Parâmetros:** `symbolId` (sprite/atlas), `spacing`, `symbolScale`, `arrangement`, `angle`.

### 2.8 Tijolado / ashlar (brick pattern)
Traços horizontais com deslocamento alternado (tijolos) — litologia em mapas
geológicos. Menos comum, mas trivialmente derivado da hachura com offset por linha.
**Parâmetros:** `spacingX`, `spacingY`, `lineWidth`, `offsetRatio`.

### 2.9 Somente contorno (hollow / outline-only)
Sem preenchimento; borda com *casing* (contorno duplo: linha larga clara sob linha
fina escura) para legibilidade sobre qualquer base. Essencial como tier de zoom
distante (ver seção 3).
**Parâmetros:** `outlineColor`, `outlineWidth`, `casingColor`, `casingWidth`.

### 2.10 Adições recomendadas (fase 2, baixo custo)
- **Shapeburst/gradient fill:** preenchimento que decai da borda para dentro
  (costas/água em cartas antigas; `shapeburst fill` do QGIS). Requer
  distância-à-borda por vértice (ou SDF por tile) — não deriva dos demais padrões.
- **Random marker fill:** glifos pseudoaleatórios (extensão do stipple com atlas
  de símbolos — quase grátis sobre a infra de 2.4 + 2.7).

### 2.11 Tabela-resumo (referência rápida de implementação)

| # | Padrão | Elemento | Arranjo | Params principais |
|---|---|---|---|---|
| 1 | Sólido | — | — | color, opacity |
| 2 | Hachura | traço | linhas ∥ | angle, spacing, width |
| 3 | Hachura cruzada | traço | 2 famílias | angle±, spacing, width |
| 4 | Pontilhado | ponto | quad./triang./rand | spacing, radius, seed |
| 5 | Cruzes | cruz | grade | spacing, arm, width, angle |
| 6 | Grade | traço | malha ⊥ | spacingX/Y, width |
| 7 | Símbolos | glifo | grade/offset | sprite, spacing, scale |
| 8 | Tijolado | traço | linhas c/ offset | spacingX/Y, offset |
| 9 | Contorno | — | — | outline, casing |
| 10 | Shapeburst | gradiente | radial à borda | distância-à-borda, rampa |
| 11 | Random marker | glifo | aleatório | atlas, densidade, seed |

## 3. Comportamento dos padrões conforme o nível de zoom (GIS)

Esta seção é o modelo conceitual que o sistema Unity deve reproduzir.

### 3.1 Unidade de tela vs. unidade de mapa
- **GIS clássico (QGIS, ArcGIS):** os parâmetros do padrão (espaçamento,
  calibre) são definidos em **unidades de tela** (mm, pt). A densidade do
  padrão é **constante na tela** em qualquer zoom — o padrão é propriedade do
  *símbolo*, não da *geografia*. **Atenção — não vale para o `fill-pattern` do
  Mapbox/MapLibre:** lá o sprite é ancorado no espaço do tile e *escala com o
  zoom* (comportamento geográfico, queixa recorrente de usuários). Já
  `line-width` em px é constante em tela. Ou seja: a escolha desta spec
  (constante em tela) segue o GIS desktop, deliberadamente **divergindo** do
  `fill-pattern` do MapLibre.
- **Unidade de mapa:** raro; usado quando o padrão tem significado métrico real
  (ex.: grade de 100 m). A densidade aparente muda com o zoom.
- **Default desta spec:** densidade constante em tela, com tiers de LOD (3.4),
  porque é o comportamento que cartógrafos esperam e evita moiré.

### 3.2 Agregação perceptual em zooms baixos
Afastando a câmera, o espaçamento em pixels do padrão cai. Abaixo de ~4–6 px de
espaçamento aparente:
1. o padrão começa a produzir **moiré/aliasing** e cintilação temporal;
2. perceptivamente já virou **tom médio** (Bertin) — não carrega mais informação
   de "textura", só de "valor".

Prática cartográfica: **trocar a simbolização**, não apenas encolher o padrão.

### 3.3 Simbolização dependente de escala (o modelo GIS)
- **SLD/GeoServer, QGIS, ArcGIS:** regras com `MinScaleDenominator` /
  `MaxScaleDenominator` — classes de símbolo diferentes por faixa de escala.
- **Mapbox/MapLibre (vector tiles):** `stops` por zoom e `interpolate` —
  ex.: `fill-opacity` cresce com o zoom; `fill-pattern` trocado por `fill-color`
  em zooms baixos; `line-width` interpolada.
- **Vector tiles:** a *geometria* já chega generalizada/simplificada por zoom
  (o servidor entrega z14 com menos vértices que z18). O padrão é aplicado pelo
  *estilo* no cliente — portanto a camada de estilo deve ser independente da
  camada de dados.

### 3.4 Tiers de LOD recomendados (a implementar)

| Tier | Condição (espaçamento aparente) | Render |
|---|---|---|
| **T0 — distante** | spacing < ~4 px ou zoom < z_min | Sólido (tom médio do padrão) + contorno fino |
| **T1 — médio** | 4–12 px | Padrão **esparso** (spacing multiplicado ×2) |
| **T2 — perto** | > 12 px | Padrão **pleno** (spacing de design) |
| Transições | — | Crossfade alfa (ou dither screen-door) entre tiers, histérese de ±0.5 zoom para não oscilar |

Tom médio para o T0: `tone = mix(bg, fg, duty)`, onde `duty ≈ lineWidth/spacing`
(hachura) ou `π·r²/spacing²` (pontos). Isso mantém a "leitura de valor" estável
quando o padrão some — regra de ouro da generalização cartográfica.

### 3.5 Regras práticas
1. **Nunca** deixar o espaçamento aparente < ~3 px — fundir para sólido antes.
2. Anti-aliasing **analítico** no shader (derivadas `fwidth`), não MSAA — padrões
   finos explodem em MSAA com transparência.
3. Manter a **fase do padrão contínua entre tiles** (padrão definido em espaço
   global do tile pyramid, não por-mesh) — senão as hachuras "quebram" nas bordas.
4. Ao fazer **overzoom** (zoom da câmera além do maxzoom do tile), manter geometria
   do tile pai e densidade de tela constante — como o MapLibre faz.
5. Histérese nas trocas de tier e nos re-downloads de tiles (evita flicker).

---

# PARTE II — SPEC TÉCNICA UNITY

## 4. Arquitetura geral

Pipeline de dados (por camada vetorial configurada):

```
Servidor ──► Fonte de dados ──► Decode ──► Reprojeção ──► Triangulação ──► Mesh por tile ──► Render (pass dedicado)
 (MVT /      (VectorTileSource  (MVT/      (tile space →   (Earcut +       (MeshBuilder,     (HDRP Custom Pass +
  GeoJSON)    /GeoJsonLoader)    GeoJSON)    Unity world)     holes)        UV em espaço       shaders de padrão
                                                                            global de tile)    + ZoomLodController)
```

Camadas de código (assemblies sugeridos):

1. **Data** — download/cache de tiles, decode MVT/GeoJSON, modelo `VectorFeature`.
2. **Geometry** — conversão de coordenadas, triangulação, geração de mesh + UVs.
3. **Style** — `PatternDefinition` (ScriptableObject) + catálogo + resolução por zoom.
4. **Render** — materiais/Shader Graphs, Custom Pass Volume (HDRP), `VectorOverlayLayer`.
5. **LOD** — seleção de zoom de tile, tiers de padrão, crossfade.

## 5. Ingestão de dados

### 5.1 Vector tiles (MVT)
- Formato: protobuf, spec **Mapbox Vector Tile 2.1**. Tiles endereçados por `z/x/y`,
  esquema XYZ (y cresce ao sul), projeção Web Mercator (EPSG:3857).
- **Extent:** tipicamente 4096 unidades inteiras por tile (ler o campo `extent` da
  layer — não assumir). Coordenada local: origem no canto **superior esquerdo**, y para baixo.
- **Comandos de geometria:** MoveTo/LineTo/ClosePath (zigzag deltas). Polígonos são
  um ou mais *linear rings*; **buracos são detectados pelo sinal da área assinada**
  (surveyor's formula): anéis exteriores e interiores têm sinais opostos. Não confiar
  na ordem dos rings — calcular a área assinada de cada ring e agrupar: cada ring com
  sinal "exterior" inicia um novo polígono; rings de sinal oposto seguintes são seus
  buracos. (Em tile space com y-down, exteriores têm área assinada positiva e buracos
  negativa, conforme a spec 2.x.)
- **Buffer:** tiles vêm com margem além da borda (tippecanoe default ≈ 5% do
  extent, ~205/4096; outras fontes 64–128) — **não hardcodar**: clipar à borda
  ou aceitar sobreposição controlada.
- **Overzoom:** se a câmera pede z > `maxzoom` da fonte, reutilizar o tile de
  `maxzoom` ancestral (mesma geometria, recortada) e manter densidade do padrão em
  tela (ver 10).
- **Decode sugerido:** port leve da spec (≈300 linhas, sem dependência) ou a lib C#
  `vector-tile-cs`/`Mapbox.Vector.Tile`. Gerar structs intermediárias
  `VectorFeature { LayerName, GeomType, Rings[][], Attributes }`.
- **Deduplicação entre tiles:** feições cruzam bordas clipadas; usar
  `layer + id` para deduplicar atributos **quando `id` existir** (campo opcional
  no MVT 2.1 — muitas fontes OSM omitem; fallback: não deduplicar, ou chave fraca
  por hash de geometria+atributos). A geometria pode permanecer clipada por
  tile (é o normal em renderizadores) **desde que a fase do padrão seja global** (7.3).

### 5.2 GeoJSON (fallback / camadas pequenas)
- RFC 7946, WGS84 lon/lat. Tipos: `Polygon` e `MultiPolygon` (com buracos).
- Conversão: lon/lat → Web Mercator metros (ou lon/lat → ECEF via Cesium) →
  espaço local Unity (origem ENU ou `CesiumGeoreference`).
- Reutilizar o mesmo `VectorFeature` intermediário do MVT.

### 5.3 Sistema de coordenadas Unity
Duas estratégias (escolher por configuração `GeoSpaceMode`):
- **Globe (Cesium):** vértices em ECEF double → `CesiumGeoreference` +
  `CesiumGlobeAnchor` por tile; mesh gerada em espaço local do tile, ancorada.
- **Local ENU (áreas metropolitanas):** escolher origem (ex.: centroide do primeiro
  tile), converter para metros ENU, vertices float diretamente. Mais simples e
  preciso; recomendado para os exemplos iniciais.

Toda matemática em **double** até o offset final para float (padrão "floating
origin" por tile).

## 6. Geração de geometria

### 6.1 Triangulação
- Usar **Earcut** (port C# existe; ~200 linhas) ou **LibTessDotNet**. Earcut:
  rápido, suporta buracos via lista achatada + `holeIndices`. LibTess: mais robusto
  para polígonos auto-intersectantes (dados sujos de MVT acontecem).
- Normalizar rings antes: remover pontos duplicados consecutivos, garantir
  fechamento, orientação consistente. **Invariante observável (não depender de
  "CCW/CW" abstrato — a conversão MVT y-down → Unity y-up inverte sinais):**
  os triângulos finais devem ter normal `+Y` (visíveis de cima, front-face
  clockwise visto de cima, ou usar `Cull Off`); teste EditMode verifica
  `normal.y > 0` da primeira face triangulada de um quadrado conhecido.
  Rings sujos de MVT: aplicar snap-rounding antes do Earcut; validar contenção
  (point-in-polygon) ao associar buraco→exterior como fallback.
- Rodar triangulação fora da main thread (C# Job + Burst, ou `Task.Run` com
  marshalling de arrays) — tiles z15+ com hidrografia são pesados.
- **Pooling:** reutilizar `Mesh` (`.Clear()` + `SetVertices/SetTriangles` com
  `MeshUpdateFlags.DontNotifyMeshUsers` cuidado) e buffers nativos.

### 6.2 Malha resultante (por tile × camada × estilo)
- `vertices`: posições locais do tile (float3).
- `uv0`: **coordenada de padrão** — ver 7.3 (crucial).
- `uv1` (opcional): atributos para data-driven styling (ex.: índice de classe).
- `normals`: up local (para lighting opcional) — ou shader unlit.
- Submesh por faixa de estilo se necessário; idealmente 1 material por
  (camada, tier de padrão).

### 6.3 Bordas/contorno
Contornos de polígono são gerados como **fitas trianguladas** (polyline mesh com
miter joins) a partir dos rings, num segundo mesh/mesh section, com `outlineWidth`
em px convertido a metros por frame (constante de tela — mesma técnica do padrão)
ou em metros fixos. **Obrigatório `miterLimit`** (2–4× width; fallback bevel)
para não gerar spikes em vértices agudos; caps butt ou round nas pontas.
Casing = duas fitas concêntricas.

## 7. Sistema de padrões (Style)

### 7.1 `PatternDefinition` (ScriptableObject)

```csharp
public enum PatternKind { Solid, Hatch, CrossHatch, Dots, Crosses, Grid, Symbol, Brick, OutlineOnly }
public enum PatternArrangement { Square, Staggered, Random }

[CreateAssetMenu(menuName = "Cartography/Pattern Definition")]
public class PatternDefinition : ScriptableObject
{
    public PatternKind kind;
    [Header("Densidade (design-time, em px de tela de referência)")]
    public float spacingPx = 16f;       // espaçamento centro-a-centro
    public float elementSizePx = 2f;    // calibre do traço OU raio do ponto OU braço da cruz
    public float angleDeg = 45f;
    public PatternArrangement arrangement = PatternArrangement.Square;
    public int randomSeed = 1337;
    [Header("Cores")]
    public Color foreground = new Color(0.1f, 0.1f, 0.1f, 1f);
    public Color background = new Color(1f, 1f, 1f, 0f); // alfa 0 = sem fundo
    [Header("Contorno")]
    public float outlineWidthPx = 1.5f;
    public Color outlineColor = Color.black;
    [Header("Símbolo (kind = Symbol)")]
    public Texture2D symbolAtlas;
    public Vector4 symbolUvRect;        // rect no atlas
    [Header("Zoom / LOD")]
    public Vector2 zoomRange = new Vector2(10, 22); // fora disso, camada some ou degrada
    public float sparseFactor = 2f;     // multiplicador de spacing no tier T1
    public float minApparentSpacingPx = 4f; // abaixo disso → tier sólido (T0)
}
```

`PatternLibrary` (SO) guarda o catálogo da seção 2 (1 asset por padrão) para o
painel de exemplos.

### 7.2 Resolução de estilo por zoom (`StyleResolver`)
Entrada: zoom efetivo da câmera + `PatternDefinition`.
Saída: tier (T0/T1/T2), cores efetivas (T0 = tom médio calculado por duty cycle —
fórmula em 3.4), spacing efetivo, alfa de crossfade.

**Como passar os parâmetros ao shader (restrição do SRP Batcher):**
`MaterialPropertyBlock` **é proibido** — torna o renderer inelegível ao SRP
Batcher e estoura o budget de draw calls (11). Usar, em ordem de preferência:
1. **Valores por-frame/globais** (`_TierFade`, `_LayerOpacity`, `_PatternScale`,
   `metersPerPixel`): `Shader.SetGlobalFloat/Vector` — compatível com SRP Batcher.
2. **Parâmetros do padrão** (spacing, cores, angle): no material compartilhado
   por (camada × tier), dentro de `CBUFFER(UnityPerMaterial)` — **nunca**
   instanciar material por tile.
3. **`tileOrigin`** (7.3): derivar no vertex shader a partir da translação de
   `unity_ObjectToWorld` (a mesh já é ancorada por tile — custo zero).
4. Dados realmente por-feição: vértice (uv1/color) ou `Texture2DArray`.

### 7.3 Espaço de UV do padrão — regra de ouro
O padrão deve ter **fase contínua através de tiles adjacentes** e ficar estável
quando um tile é recarregado. Portanto:

```
uv0 = coordenada global do tile pyramid em "unidades de tile" (float2):
   gu = tileX * extent + localX        // localX ∈ [0, extent] do MVT
   gv = tileY * extent + localY
   uv0 = (gu, gv) / extent             // 1.0 = um tile inteiro no zoom do tile
```

- Como um tile no zoom z cobre sempre a mesma área geográfica, esse espaço é
  estável e compartilhado entre tiles irmãos. Padrão definido em "ciclos por tile".
- Overzoom: dividir por `2^(zCam - zTile)` mentalmente — o shader recebe
  `_PatternScale` para compensar e manter densidade de tela (abaixo).
- GeoJSON/ENU: usar metros ENU como espaço de padrão + mesma compensação.
- Precisão: valores de uv0 crescem com z (z15 → até 32768×). Normalizar pelo
  tile atual (`uv0 = uv0Global - tileOrigin`) e passar `tileOrigin` por material
  property — o shader soma de volta (float no shader é suficiente após subtração
  porque o padrão é periódico: usar `frac()`).

### 7.4 Densidade constante em tela
O shader trabalha no espaço uv0 (geográfico). Para densidade de tela constante,
a CPU calcula por frame (ou por mudança de zoom):

```
metersPerPixel ≈ (dimensão da tela em metros no plano do overlay) / screenHeight
```

Para mapa 3D oblíquo isso varia com a profundidade — solução pragmática: calcular
`metersPerPixel` no centro da tela (ou por tile, pela distância do tile à câmera)
e passar `_SpacingWorld = spacingPx * metersPerPixel` (convertido a unidades de
uv0). Em visualização oblíqua extrema, aceitar a aproximação ou usar o modo
alternativo `_DensityMode = ScreenSpace` que deriva o espaçamento por-fragmento
via `ddx/ddy` do uv0 (custo pequeno, robusto em obliquo):

```hlsl
// Densidade por fragmento (modo robusto para câmeras oblíquas):
float2 fw = fwidth(uv * _CyclesPerTile);
float  px = max(fw.x, fw.y);          // ciclos do padrão por pixel
float  scale = max(px * _SpacingPx, 1.0);
// Anti "phase swimming": QUANTIZAR scale em oitavas (potências de 2, estilo mip)
// — casa com os tiers discretos (3.4) e impede o padrão de "deslizar" no zoom:
scale = exp2(round(log2(scale)));
float2 p = uv * _CyclesPerTile / scale; // padrão com ~_SpacingPx px de espaçamento
```

## 8. Shaders (HDRP) — padrões procedurais

**Host do shader em HDRP:** escrever shader HLSL "na mão" para HDRP é inviável
(lighting loop complexo). Duas rotas, nesta ordem de preferência:
1. **Shader Graph com target HDRP (recomendado):** grafo `PatternFill` do tipo
   **Unlit** com `Surface Type = Transparent`, `Blending Mode = Alpha`,
   `ZWrite = Off`, `ZTest = LEqual`. O núcleo matemático abaixo entra como
   **Custom Function Node** (arquivo `.hlsl` incluído) — derivadas (`DDX/DDY`)
   funcionam normalmente em HDRP. Um grafo por família (Linhas / Pontos /
   Símbolo) com enum keyword por `PatternKind`, ou 9 subgrafos compostos.
2. **HLSL cru via Custom Pass (avançado):** o `DrawRenderersCustomPass` (9)
   aceita override de shader por material — viável para o pass de overlay sem
   lighting. Usar só se a rota 1 bloquear.

Anti-aliasing **sempre** por derivadas (o núcleo abaixo é pipeline-agnóstico — em
Shader Graph, portar 1:1 para Custom Function):

```hlsl
// Núcleo reutilizável: traço suavizado analítico
float AALine(float d, float w) // d = distância ao centro do traço, w = meia-largura
{
    float a = fwidth(d) * 0.75;
    return 1.0 - smoothstep(w - a, w + a, d);
}
// NOTA sub-pixel: quando o elemento fica menor que ~1 px (a > w), NÃO tentar
// fundir dentro do shader — essa decisão é do tier T0 (3.4): o StyleResolver
// (CPU) troca para o material sólido de tom médio antes disso acontecer.

// HACHURA / GRADE / CROSS-HATCH -----------------------------------------
// p = ponto no espaço do padrão (ciclos), rotacionado por _Angle
float HatchPattern(float2 p, float widthCycles)
{
    float d = abs(frac(p.y) - 0.5);              // distância à linha (em ciclos)
    return AALine(d, widthCycles * 0.5);
}
// CrossHatch = max(Hatch(p1), Hatch(p2)); Grid = max(Hatch(p.x), Hatch(p.y));

// PONTOS / CRUZES --------------------------------------------------------
float DotsPattern(float2 p, float rCycles)
{
    // staggered: offset de ½ espaçamento por LINHA inteira (floor, não p.y contínuo):
    p.x += 0.5 * mod(floor(p.y), 2.0);
    float2 g = frac(p) - 0.5;
    return AALine(length(g), rCycles);
}
float CrossPattern(float2 p, float arm, float w)
{
    // invariante: clampar arm ≤ 0.5 − 2w, senão cruzes se fundem e viram Grid
    float2 g = abs(frac(p) - 0.5);
    float a = fwidth(g.x) * 0.75 + 1e-4;
    float h = AALine(g.y, w) * smoothstep(arm + a, arm - a, g.x); // AA também nas pontas
    float v = AALine(g.x, w) * smoothstep(arm + a, arm - a, g.y);
    return max(h, v);
}

// ESTIPPLE ALEATÓRIO (determinístico) ------------------------------------
// hash22(célula + seed) → posição do ponto dentro da célula; raio fixo.

// SÍMBOLO (kind=Symbol) ---------------------------------------------------
// uv do glifo = frac(p) remapeado para _SymbolUvRect do atlas; amostra
// TEXTURE2D(_SymbolAtlas) com filtro bilinear; multiplica por _Foreground.
```

Composição final:

```hlsl
half4 frag(Varyings i) : SV_Target
{
    float2 p = PatternSpace(i.uv0);       // 7.4: rotação + escala de densidade
    float m  = EvalPattern(p);            // máscara 0..1 do elemento
    half4 col = lerp(_Background, _Foreground, m);
    col.a *= _LayerOpacity * _TierFade;   // crossfade de tier (10.2)
    return col;
}
```

Notas de implementação:
- `fwidth` (DDX/DDY): suporte pleno em HDRP (DX11+/Vulkan/Metal) — sem restrição.
- Fundo transparente: `background.a = 0` → descarte barato via lerp, sem `clip()`
  (preserva ordenação de transparentes e TAA do HDRP).
- **TAA/anti-aliasing temporal do HDRP:** padrões finos cintilam sob TAA se o
  contraste for alto — mitigar com o AA analítico acima + tiers de LOD (10);
  opção adicional: **"Exclude from Temporal Upscaling and Anti-Aliasing"**
  (disponível para superfícies transparentes HDRP). Com DLSS/DRS, definir se o
  "1 px" de design é no render target interno ou na saída final, e validar
  parado e em movimento.
- `Symbol` usa atlas (um `Texture2DArray` ou atlas único + rects) — mesma técnica
  do sprite `fill-pattern` do MapLibre.
- **Decals HDRP (rota de draping, 9.3):** o núcleo do padrão deve ser um
  **subgrafo** que recebe uma **coordenada de padrão abstrata** (float2) — os
  targets Unlit (mesh, usa uv0) e Decal (projector, usa UV de projeção) são
  grafos/materiais separados que alimentam essa coordenada mantendo a fase
  global (7.3). Não assumir que "uv0" significa a mesma coisa nos dois.
- **Custom Function Node — contrato obrigatório:** o `.hlsl` externo só compila
  no Shader Graph se: (a) começar com `//UNITY_SHADER_NO_UPGRADE` + include
  guard único; (b) funções com sufixo `_float` (ex.: `GeoHatch_float`) e/ou
  `_half`, com o campo `Name` do nó SEM o sufixo; (c) assinatura (args + `out`)
  casando exatamente com as portas do nó; (d) precisão do nó travada em Float;
  (e) uso apenas em contexto **Fragment**. `DDX/DDY` funcionam no caminho
  raster/fragment do HDRP (não prometer para ray tracing/path tracing).
- **Override de shader no custom pass (rota avançada):** `Override Mode =
  Shader` substitui só o shader preservando propriedades do material;
  `Override Mode = Material` substitui tudo. Shader manuscrito deve nascer do
  template **HDRP Custom Renderers Pass** (pass `ForwardOnly`) — não portar
  shader URP genérico.

## 9. Render pass dedicado e oclusão contra o 3D (HDRP)

Requisito: polígonos marcam o espaço do terreno/modelo 3D — devem ser **visíveis
sobre a superfície** mas **ocludidos por prédios/elevação à frente** (oclusão real
do 3D, sem "raio-x").

**HDRP não tem Renderer Features.** O equivalente é o **Custom Pass Volume**
(componente, global ou local) com passes `DrawRenderersCustomPass`:

1. **Layer dedicada** `VectorOverlay` em todos os meshes vetoriais.
2. **Custom Pass Volume "VectorOverlay"** (modo Global, prioridade configurável):
   - Pass: `DrawRenderersCustomPass`,
   - **Injection Point = `BeforeTransparent`** (neste ponto o depth buffer opaco
     dos 3D Tiles já existe e está disponível para teste),
   - **CRÍTICO — remover `VectorOverlay` de `Camera.cullingMask`**: sem isso a
     camada renderiza duas vezes (pass transparente normal + custom pass) →
     preenchimento duplicado/mais opaco e overdraw em dobro. Aceite no Frame
     Debugger: exatamente UM evento de render por mesh de overlay,
   - Config completa do pass: `Target Color Buffer = Camera`,
     `Target Depth Buffer = Camera`, `Clear Flags = None`, Queue = Transparent,
     `Layer Mask = VectorOverlay`, `Override Depth = true`,
     `Depth Test = LessEqual`, `Write Depth = false`,
     **Sorting = `CommonTransparent | RendererPriority`**,
   - Frame Settings da câmera: **Custom Pass habilitado**,
   - **Depth: LEqual sem depth write** — herda o depth dos 3D Tiles → oclusão
     real e gratuita,
   - Ressalvas a documentar: overlays ficam atrás de transparentes do 3D Tiles
     (vidro, folhagem alpha); onde não há geometria (horizonte), o overlay
     renderiza sobre o céu já desenhado (sky renderiza antes de transparentes);
     em Unity 6 o HDRP roda sobre **RenderGraph** — custom passes continuam
     sendo a API pública suportada (compatível).
3. **Z-fighting contra a superfície (config `OverlayZFightMode`):**
   - **Elevação geométrica (default):** deslocar vértices +N metros ao longo da
     normal (`drapeHeightMeters`, 0.5–2 m). Simples e estável; erra em
     encostas/fachadas — documentar limitação. *(O `Offset`/depth-bias clássico
     do ShaderLab **não** é exposto pelo `DrawRenderersCustomPass`; alternativa
     intermediária: `Depth Offset` no Shader Graph HDRP Unlit, que escreve
     `BuiltinData.depthOffset`.)*
   - **HDRP Decal Projectors (recomendada para qualidade/draping real):**
     renderizar o padrão como **decal** projetado sobre a superfície (Shader
     Graph target Decal, 8). Draping correto inclusive em fachadas de 3D Tiles.
     **Checklist obrigatório (sem ele, decal não aparece):**
     (a) **Decals + Decal Layers habilitados no HDRP Asset** e nas Frame
     Settings da câmera; (b) `Receive Decals = true` no material dos tiles —
     como o Cesium gera materiais em runtime, adicionar adaptador no evento de
     criação de tile setando material + `MeshRenderer.renderingLayerMask`;
     (c) `DecalProjector.decalLayer` correspondente; (d) projector com eixo Z
     local alinhado à direção de projeção, `Size`/`Pivot` = bounds do tile +
     folga, `Projection Depth` cobrindo o relevo, `Draw Distance` e
     `Angle Fade` configurados; (e) `Affects Transparent = false`.
     **Pooling:** usar **material compartilhado por (camada × tier)** — nunca
     clonar material por tile (memória + perda de instancing); o prefab do
     projector não clona material automaticamente. Budget: 1 projector ativo
     por tile visível no frustum central.
   - **Mesh decal (fase 2):** quando projeção em caixa produzir artefatos em
     geometria muito íngreme (`Mesh Decal Depth/View Bias` vale só para mesh
     decals, não para projector).
4. **Ordem entre camadas vetoriais (modelo HDRP — não usar renderQueue):**
   mapear `layerOrder` para **Material Sorting Priority** (único controle entre
   materiais transparentes em HDRP; range **[-50, 50]** — clampar; mais de 101
   camadas simultâneas exige múltiplos custom passes) e usar
   `Renderer.rendererPriority` apenas como desempate entre renderers do mesmo
   material (exige `Sorting = CommonTransparent | RendererPriority` no pass).
   Na rota decal, `Draw Order` é propriedade do **material de decal** (um
   material compartilhado por camada, com Draw Order único e estável).
5. **Máscaras (opcional):** HDRP Decal Layers / stencil custom pass para excluir
   overlays de regiões (túneis, interiores de edifícios selecionados).

## 10. Controlador de LOD por zoom

### 10.1 Zoom efetivo da câmera
- Modo Globe/Cesium: derivar de metros/pixel no nadir (única forma correta —
  depende de FOV e resolução de tela):

```
mpp   = 2·h·tan(fovY/2) / screenHeightPx          // metros/pixel no nadir
zoom  = log2( 2πR·cosφ / (mpp · tileSizePx) )      // tileSizePx = 256 (512 retina)
```

  Implementar como `CameraZoomEstimator` com `_ZoomBias` calibrável para casar
  com o zoom de geração dos tiles do servidor. Em câmera oblíqua o zoom varia
  pela tela — amostrar no centro (ou por tile, pela distância do tile à câmera).
- Modo ENU: mapear distância câmera→plano do overlay para zoom via tabela
  configurável.

### 10.2 Máquina de tiers (por camada)
Estados: `T0_Solid`, `T1_Sparse`, `T2_Full`, `Hidden` (fora de `zoomRange`).
Transições com **histérese** (±0.25–0.5 zoom) e **crossfade** de 200–300 ms:
`_TierFade` animado por `Mathf.SmoothDamp`; durante a transição, desenhar apenas
o tier entrante com fade (evita double-draw; dither screen-door opcional em fase 2).
Regras:
- Espaçamento aparente < `minApparentSpacingPx` → forçar T0.
- T0 usa **tom médio por duty cycle** (3.4) — nunca a cor pura do traço.
- Troca de tile (novo z) durante crossfade → concluir fade antes de reciclar mesh
  (evita pop).

### 10.3 Seleção de tiles
`TileManager`: dado zoom efetivo `zc` → tile z = `clamp(round(zc), minzoom, maxzoom)`;
manter tiles dos 4 filhos + pai; LRU cache com budget (ex.: 64 tiles/camada);
cancelamento de downloads em voo; dedupe de requisições; HTTP/2 keep-alive;
retry com backoff. Sobrezoom além de maxzoom: reutilizar pai + `_PatternScale`
(7.3).

## 11. Performance (budgets e técnicas)

| Item | Budget (desktop) | Técnica |
|---|---|---|
| Triângulos vetoriais visíveis | < 2 M | tiling + culling por frustum (bounds por tile) |
| Draw calls de overlay | < 60 | 1 material por (camada × tier); SRP Batcher compatível (CBUFFER UnityPerMaterial); **sem** Material instanciado por tile |
| Triangulação | < 4 ms/tile (média) | Burst Job ou thread pool; Earcut; fila com prioridade por distância |
| Memória de mesh | pooling | `Mesh.Clear()` + reuse; `VertexAttributeDescriptor` fixo |
| GC | ~0/frame em steady-state | pools de arrays (`ArrayPool<T>`), structs, sem LINQ no hot path |
| Rede | cache LRU + disco | `UnityWebRequest` + cache em `Application.persistentDataPath` com ETag |

Notas HDRP/Unity 6:
- **SRP Batcher** continua valendo em HDRP — mesma proibição de MPB (7.2).
- **Decal Projectors:** budget de ~1 projector ativo por tile visível (pool com
  material compartilhado — com material compartilhado cabem muitos; os limites
  reais são overdraw, DBuffer e nº de materiais de decal únicos). `Decal Layers`
  controlam **atribuição**, não são culling barato (aumentam memória/variantes) —
  performance vem de bounds pequenos, Draw Distance/frustum e
  `Receive Decals = false` em materiais não receptores. Em tilesets enormes,
  preferir a rota Custom Pass (mesh) para zooms distantes e decal só no tier T2.
- **TAA:** padrões finos + TAA = cintilação; o AA analítico (8) + tiers (10) são
  a mitigação primária. Testar com DLSS/FSR ligados (upscalers amplificam moiré).
- Plataforma: HDRP = desktop/console/VR — sem mobile/WebGL; se surgir requisito
  mobile, portar o núcleo HLSL (8) para URP (a matemática é pipeline-agnóstica).

## 12. Estrutura de código proposta

```
Assets/CartoOverlay/
├── Runtime/
│   ├── Data/
│   │   ├── VectorTileSource.cs      // URL template {z}/{x}/{y}, cache, LRU
│   │   ├── MvtDecoder.cs            // protobuf → VectorFeature (spec 2.1)
│   │   ├── GeoJsonLoader.cs
│   │   └── VectorFeature.cs         // rings + attributes + layer
│   ├── Geometry/
│   │   ├── Earcut.cs                // triangulação com holes
│   │   ├── PolygonNormalizer.cs     // winding, dedupe, closing
│   │   ├── OutlineMeshBuilder.cs    // fitas de contorno com miter
│   │   └── TileMeshBuilder.cs       // mesh + uv0 (espaço global de tile)
│   ├── Style/
│   │   ├── PatternDefinition.cs     // SO (7.1)
│   │   ├── PatternLibrary.cs        // catálogo da seção 2
│   │   └── StyleResolver.cs         // tier, cores, PropertyBlock
│   ├── Render/
│   │   ├── VectorOverlayLayer.cs    // MonoBehaviour por camada
│   │   ├── VectorOverlayCustomPassSetup.cs // cria/configura Custom Pass Volume (9)
│   │   ├── OverlayDecalPool.cs      // Decal Projectors por tile (rota decal, 9.3)
│   │   └── Shaders/
│   │       ├── PatternFillLines.shadergraph   // HDRP Unlit transparent (8)
│   │       ├── PatternFillDots.shadergraph
│   │       ├── PatternFillSymbols.shadergraph
│   │       ├── PatternCore.hlsl     // AALine + padrões (Custom Function Node)
│   │       └── VectorOutline.shadergraph
│   └── Lod/
│       ├── CameraZoomEstimator.cs
│       ├── PatternTierController.cs
│       └── TileManager.cs
├── Samples~/DemoScene/              // cena com terreno/3D Tiles + painel de padrões
└── Tests/                           // EditMode: decoder, earcut, winding
```

**Assembly definitions:** se o código for modular, criar `.asmdef` por pasta com
referências explícitas a `Unity.RenderPipelines.HighDefinition.Runtime`,
`Unity.RenderPipelines.Core.Runtime` e ao assembly do plugin de 3D Tiles; caso
contrário, declarar que tudo fica em `Assembly-CSharp`. Entregar também os
assets de configuração: prefab do `CustomPassVolume`, prefab do `DecalProjector`
e HDRP Asset/Frame Settings de referência (T0/T1).

**MVT mínimo para os testes:** aceitar também fixtures `.mvt` locais
(Resources/StreamingAssets) para desenvolver offline — gerar 3–4 tiles de teste
com polígonos conhecidos (quadrado, quadrado com buraco, multipolígono cruzando
borda de tile, ring com winding invertido).

## 13. Plano de tasks para o Claude Code (ordem + critérios de aceite)

| Task | Entregável | Critério de aceite |
|---|---|---|
| **T0** Validação de stack | Unity **6000.3.x fixado** + HDRP Wizard verde + Cesium for Unity **≥ 1.12** (corrige clipping em HDRP) ou alternativa; adaptador de material/rendering layer dos tiles; decal de teste sobre tile Cesium; cor Linear; backend gráfico/OS alvo declarados | Tileset real renderizando em HDRP; decal de teste aparece sobre o tile; validado em **standalone player** (não só no Editor); decisão Cesium vs. alternativa documentada |
| **T1** Custom Pass de overlay | Cena vazia, layer `VectorOverlay` **fora do culling mask da câmera**, Custom Pass Volume + `DrawRenderersCustomPass` (BeforeTransparent, buffers Camera/Camera, Clear None, depth LEqual sem write, Sorting CommonTransparent+RendererPriority) | Cube 3D opaco oclui quad de teste; quad não escreve depth; **Frame Debugger mostra exatamente 1 evento por mesh de overlay** (sem dupla renderização) |
| **T2** GeoJSON → mesh | `GeoJsonLoader` + Earcut + normalização | FeatureCollection de teste renderiza polígono com buraco corretamente (buraco visível); teste EditMode: `normal.y > 0` da 1ª face |
| **T3** Shader de padrões v1 | Hatch, CrossHatch, Dots (square+staggered), Crosses, Grid, Brick, Solid em `PatternCore.hlsl` + Shader Graphs HDRP (Unlit transparent) | Materiais lado a lado; critério mensurável: screenshot a 2× e 8× de distância, desvio do tom médio de cinza < 10% vs. referência; sem serrilhado visível a 100% de escala; sem cintilação excessiva sob TAA |
| **T4** PatternDefinition + catálogo + símbolos | 9 assets SO (seção 2.11) + pipeline de atlas p/ `Symbol` (importador de sprites → rect) | Trocar SO troca o padrão em runtime; padrão Symbol renderiza glifo do atlas |
| **T5** Densidade de tela + ZoomEstimator | `CameraZoomEstimator` (fórmula 10.1), `_SpacingWorld` por tile + modo `fwidth` quantizado em oitavas | Espaçamento aparente constante ±20% z12→z18 (medir por screenshot + contagem de px); zoom estimado bate com zoom de tile do servidor ±0.5 após calibrar `_ZoomBias` |
| **T6** Tiers de LOD | `PatternTierController` + crossfade + tom médio T0 | Afastando, padrão funde para sólido sem pop; histérese impede oscilação (log de estado sem flicker em 10 s de zoom oscilante) |
| **T7** MVT decode + tiles | `MvtDecoder` + `TileManager` + **fixtures `.mvt` entregáveis** (gerar com tippecanoe a partir de GeoJSON fixture e commitar os binários) | Fixtures renderizam (quadrado, quadrado c/ buraco, multipolígono cruzando borda, winding invertido); buracos por área assinada; dedupe por id c/ fallback documentado |
| **T8** Continuidade inter-tile | uv0 global + normalização por tile (tileOrigin via `unity_ObjectToWorld`) | Hachura contínua e em fase cruzando borda de 2 tiles adjacentes (screenshot diff na costura < 1 px de deslocamento) |
| **T9** Overzoom + contorno | Reuso de tile pai + `VectorOutline.shadergraph` (miterLimit + casing) | Zoom além de maxzoom mantém padrão/densidade; contorno sem spikes em polígono serrilhado de teste |
| **T10** Integração Cesium/3D Tiles + draping HDRP | Cena com Cesium World Terrain (ou tileset local) + overlay em Custom Pass; rota decal (`OverlayDecalPool`) no tier T2 | Prédio/elevação oclui polígono corretamente em câmera oblíqua; sem z-fighting visível em tilt raso a 60 fps por 30 s; decal drapeia fachada de prédio sem artefato de projeção |
| **T11** Painel demo + perf | UI (uGUI ou ImGUI) trocando padrão/zoom; contadores de draw call | Demo navegável; < 60 draw calls overlay com SRP Batcher ativo; ≤ 1 decal projector por tile visível; 0 GC alloc/frame steady |

Notas para o agente: retry/backoff/HTTP2 da §10.3 são fase 2 (fora dos aceites);
testes EditMode obrigatórios em T2/T7/T8.

Convenções para o agente: C# 9 (Unity 6.3 LTS); HDRP + Shader Graph (sem pacotes
fora do registry oficial + libs citadas); testes EditMode para T2/T7/T8; README
por pasta quando não óbvio; comentários em pt-BR ou en, consistentes.

## 14. Referências normativas

1. Mapbox Vector Tile Specification 2.1 (geometria, winding, extent).
2. RFC 7946 — GeoJSON.
3. Bertin, J. *Sémiologie Graphique* — variáveis visuais (grão, textura, orientação).
4. OGC SE/SLD 1.1 — `MinScaleDenominator`, `GraphicFill`, hachuras.
5. MapLibre GL Style Spec — `fill-pattern`, `stops`, `interpolate` (modelo de
   estilo dependente de zoom em vector tiles).
6. Unity HDRP (Unity 6) — Custom Pass Volume / `DrawRenderersCustomPass` e
   injection points; Decal Projectors e Decal Layers; Shader Graph target HDRP
   (Unlit transparent + target Decal); SRP Batcher; RenderGraph.
7. Cesium for Unity — `CesiumGeoreference`, `CesiumGlobeAnchor` (ancoragem ECEF);
   compatibilidade HDRP da versão do plugin (validar em T0).
8. Earcut (Mapbox) / LibTessDotNet — triangulação de polígonos com buracos.

---

## Apêndice A — Glossário rápido
- **Duty cycle:** fração de área coberta pelo elemento do padrão (define o tom médio).
- **Tier (T0/T1/T2):** nível de detalhe do padrão por zoom (sólido/esparso/pleno).
- **Overzoom:** renderizar zoom de câmera maior que o maxzoom do tile, reusando geometria.
- **Fase do padrão:** alinhamento espacial do padrão; deve ser global, não por-mesh.
- **Screen-door/dither fade:** transição por descarte estocástico de fragmentos.

---

## Apêndice B — Implementação de referência em three.js (divergências)

O playground deste repositório é a implementação executável desta spec, mas em
**React Three Fiber**, não em Unity. Boa parte da PARTE II é infraestrutura
específica do HDRP e não tem contrapartida; o que segue registra o que foi
implementado, o que diverge e por quê. Onde há divergência, a **spec continua
sendo a fonte de verdade para o alvo Unity** — o playground só demonstra que a
matemática fecha.

### B.1 Catálogo (§2) — implementado

| Spec | Playground | Nota |
|---|---|---|
| 2.1 Sólido | `Solid` | |
| 2.2 Hachura | `Hatch` | |
| 2.3 Hachura cruzada | `CrossHatch` | |
| 2.4 Pontilhado — quadrado / quincunx / stipple | `Dots` + `arrangement` | eixo separado, como no `PatternDefinition` |
| 2.5 Cruzes (+ e ×) | `Plus`, `Cross` | |
| 2.6 Grade | `CrossHatch` com `rotation = 0` | mesmo caminho de shader |
| 2.7 Símbolos | `Symbol` | textura única, **sem atlas + `symbolUvRect`** |
| 2.8 Tijolado | `Brick` + `brickOffsetRatio` | tijolo 2:1 |
| 2.9 Contorno + casing | fita de borda + fita de casing | duas fitas concêntricas |
| 2.10 Shapeburst | `Shapeburst` | ver B.4 |
| 2.11 Random marker | `Symbol` + `arrangement = Random` | cai fora do stipple |

Extras fora do catálogo: `Checker` e `Bands`.

### B.2 Zoom (§3) — divergência deliberada

A spec descreve **tiers discretos T0/T1/T2 com crossfade alfa** entre eles.
O playground implementa uma **pirâmide contínua de níveis** (modelo Mapbox):
um único nível global por frame, histerese de ±0,75 nível e transição temporal
de ~0,28 s feita por **paridade** — os elementos de índice ímpar somem ou
entram, em vez de dois padrões completos se sobreporem.

Motivo: crossfade de dois padrões completos produz **duplicidade visual** no
meio da transição (o olho lê duas grades sobrepostas), que é exatamente o
artefato que §3.5 quer evitar. A transição por paridade preserva a leitura de
"um padrão só" em qualquer instante.

O **tom médio por duty cycle** (§3.4) está implementado (`meanCov`) e é aplicado
nos modos Metros e Px de tela quando o espaçamento aparente cai abaixo de ~3 px.
No modo Px/metro ele nunca dispara, porque o clamp em `minPixelSpacing` já
impede o padrão de chegar lá.

### B.3 Dados (§5, §6.1, §10.3) — não implementado

Sem MVT, sem GeoJSON, sem `TileManager`, sem reprojeção, sem detecção de furo
por área assinada. Os polígonos são fixos e sintéticos, com furo conhecido.

É uma escolha: o playground existe para isolar o **sistema de padrões** da
sujeira de dado real. A consequência a registrar é que o critério de aceite
**T8 (continuidade inter-tile)** não pode ser executado aqui. A fase é ancorada
em coordenadas de mundo, o que deveria satisfazê-lo, mas isso permanece
**não verificado** nesta implementação.

### B.4 Shapeburst

§2.10 aponta que shapeburst exige distância-à-borda e não deriva dos demais
padrões. Aqui ela é pré-calculada na CPU por **transformada de distância
chamfer anisotrópica**, gravada no canal G da mesma máscara top-down que o
drape já usava no canal R, em metros normalizados por `SHAPE_RANGE_M`.

Como a máscara é gerada com `fill('evenodd')`, a distância **respeita o furo**:
a orla decai tanto da borda externa quanto da interna.

Para o alvo Unity isso vira um SDF por tile, com o cuidado adicional de que a
distância precisa ser contínua **através da borda do tile** — caso contrário a
orla quebra na costura, pelo mesmo motivo da §7.3.

### B.5 Oclusão e draping (§9)

Em three.js a oclusão sai de graça: os overlays são desenhados no passe
transparente com `depthTest` ligado e `depthWrite` desligado, herdando o depth
da geometria opaca. Não há equivalente de Custom Pass Volume nem a armadilha da
dupla renderização por culling mask.

O drape usa a máscara top-down projetada no terreno — equivalente funcional de
um Decal Projector para **superfície de terreno**, mas **não drapeia em fachada
vertical**. Essa é a única capacidade de §9.3 genuinamente ausente, e não é
diferença de API: é limitação de projeção.

### B.6 Sem contrapartida

Custom Pass Volume, Decal Projectors e Decal Layers, SRP Batcher e a proibição
de `MaterialPropertyBlock`, Shader Graph e o contrato do Custom Function Node,
Sorting Priority / `renderQueue`, Cesium e ancoragem ECEF, budgets de draw call
da §11 — tudo específico do HDRP.

O ambiente do playground (terreno, água, edifícios, céu) é PBR com IBL, o que
**não** faz parte desta spec: ela trata só dos overlays. Os overlays seguem
unlit e holográficos, e devem seguir — a leitura da demarcação não pode mudar
com a hora do dia.
