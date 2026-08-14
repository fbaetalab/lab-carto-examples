/* PONTO / SÍMBOLO como primitiva própria.

   Boia, sensor, sinal náutico, ponto de atracação: feições sem extensão. O que
   caracteriza a primitiva é que o símbolo tem tamanho de TELA, não de mundo —
   uma boia não fica maior porque você aproximou. Por isso o billboard é
   dimensionado em pixels no vertex shader, a partir da distância à câmera.

   Os glifos são desenhados por SDF em vez de textura: escalam sem borrar,
   ficam nítidos em qualquer dpr e não custam um atlas. */

export const POINT_VS = `
attribute vec3 offset;     /* posição de mundo da instância */
attribute float kind;      /* índice do glifo */
varying vec2 vUv;
varying float vKind;
uniform float uSizePx;     /* lado do símbolo, em pixels de tela */
uniform vec2  uViewport;

void main(){
  vUv = uv * 2.0 - 1.0;
  vKind = kind;

  vec4 mv = modelViewMatrix * vec4(offset, 1.0);
  vec4 clip = projectionMatrix * mv;

  /* tamanho constante em tela: converte pixels para unidades de clip na
     profundidade desta instância */
  vec2 px = vec2(uSizePx) / uViewport * 2.0 * clip.w;
  clip.xy += (uv - 0.5) * px;
  gl_Position = clip;
}`;

export const POINT_FS = `
precision highp float;
varying vec2 vUv;
varying float vKind;
uniform vec3  uColor;
uniform float uAlpha;

float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdDiamond(vec2 p, float r){ return (abs(p.x) + abs(p.y)) - r; }
float sdTri(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r/k;
  if(p.x + k*p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
  p.x -= clamp(p.x, -2.0*r, 0.0);
  return -length(p)*sign(p.y);
}
float ring(float d, float w, float aa){
  return smoothstep(w+aa, w-aa, abs(d));
}

void main(){
  vec2 p = vUv;
  float aa = fwidth(p.x) * 1.6;
  int k = int(vKind + 0.5);
  float mask = 0.0;

  if(k == 0){                       /* MARCADOR SIMPLES — anel */
    mask = ring(sdCircle(p, 0.62), 0.10, aa);

  } else if(k == 1){                /* ÍCONE FUNCIONAL — quadrado com miolo */
    mask = ring(sdBox(p, vec2(0.60)), 0.10, aa);
    mask = max(mask, 1.0 - smoothstep(0.26-aa, 0.26+aa, length(p)));

  } else if(k == 2){                /* ALERTA / EVENTO — losango */
    mask = ring(sdDiamond(p, 0.72), 0.10, aa);
    /* exclamação: barra vertical + ponto */
    mask = max(mask, (1.0 - smoothstep(0.055, 0.055+aa, abs(p.x))) * step(-0.30, p.y) * step(p.y, 0.26));
    mask = max(mask, 1.0 - smoothstep(0.075-aa, 0.075+aa, length(p - vec2(0.0, -0.45))));

  } else if(k == 3){                /* SENSOR / ESTAÇÃO — anel com núcleo */
    mask = ring(sdCircle(p, 0.66), 0.07, aa);
    mask = max(mask, 1.0 - smoothstep(0.20-aa, 0.20+aa, length(p)));

  } else {                          /* ÂNCORA / ATRACAÇÃO — triângulo com haste */
    mask = ring(sdTri(p * 1.15, 0.66), 0.10, aa);
    mask = max(mask, (1.0 - smoothstep(0.055, 0.055+aa, abs(p.x))) * step(-0.62, p.y) * step(p.y, 0.10));
  }

  if(mask < 0.01) discard;
  gl_FragColor = vec4(uColor, uAlpha * mask);
}`;


/* Variante que amostra o ATLAS náutico em vez de desenhar por SDF.
   As marcas IALA têm partes de cores diferentes (corpo, faixas, topmark), o
   que um SDF de cor única não expressa — daí o atlas. `uTint` fica em 0 para
   marcas náuticas: a cor da boia é informação normativa e não pode ser
   sobrescrita pelo usuário. */
export const POINT_ATLAS_FS = `
precision highp float;
varying vec2 vUv;
varying float vKind;
uniform sampler2D uAtlas;
uniform vec2  uGrid;      /* colunas, linhas */
uniform float uAlpha;
uniform vec3  uTintColor;
uniform float uTint;

void main(){
  /* CanvasTexture vem com flipY ligado: a linha 0 do canvas acaba na ÚLTIMA
     linha da textura. Sem inverter aqui, cada marca mostra o glifo de outra —
     e numa camada onde verde e vermelho têm significado oposto isso troca o
     sentido da sinalização. */
  float cellX = mod(vKind, uGrid.x);
  float cellY = (uGrid.y - 1.0) - floor(vKind / uGrid.x);
  vec2 cell = vec2(cellX, cellY);

  /* vUv chega em −1..1; volta para 0..1 e mapeia na célula */
  vec2 uv = (vUv * 0.5 + 0.5);
  uv.y = 1.0 - uv.y;
  vec2 auv = (cell + uv) / uGrid;

  vec4 c = texture2D(uAtlas, auv);
  if(c.a < 0.02) discard;
  vec3 col = mix(c.rgb, uTintColor, uTint);
  gl_FragColor = vec4(col, c.a * uAlpha);
}`;
