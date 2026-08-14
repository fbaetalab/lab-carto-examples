/* LINHA como primitiva própria — não como borda de polígono.

   Canal, duto, linha de transmissão, curso d'água e limite administrativo são
   feições LINEARES: têm comprimento e largura, mas não área. Modelá-las como
   contorno de um polígono degenerado seria mentira geométrica, e quebraria na
   hora de exportar para a Unity.

   A fita chega com dois atributos:
     dist   comprimento acumulado em metros — governa dash, ponto e traço-ponto
     cross  −1..1 na largura — governa linha dupla e o decaimento do glow
   Ambos em METROS de mundo, então o padrão de traço é físico e não muda com o
   zoom (que é o comportamento cartográfico correto para feição linear). */

export const LINE_VS = `
attribute float dist;
attribute float cross;
varying float vD;
varying float vC;
void main(){
  vD = dist; vC = cross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const LINE_FS = `
precision highp float;
varying float vD;
varying float vC;
uniform vec3  uColor;
uniform float uAlpha;
uniform float uDash;     /* comprimento do traço, em metros */
uniform float uGap;      /* comprimento do vão, em metros */
uniform int   uStyle;    /* 0 contínua 1 tracejada 2 pontilhada 3 traço-ponto 4 dupla 5 glow */

void main(){
  float a = uAlpha;
  vec3  col = uColor;
  float across = abs(vC);

  if(uStyle == 1){                                  /* TRACEJADA */
    float p = uDash + uGap;
    if(fract(vD / p) > uDash / p) discard;

  } else if(uStyle == 2){                           /* PONTILHADA */
    /* ponto = traço muito curto; o vão domina */
    float p = uDash * 0.35 + uGap;
    if(fract(vD / p) > (uDash * 0.35) / p) discard;

  } else if(uStyle == 3){                           /* TRAÇO-PONTO */
    float p = uDash + uGap + uDash * 0.22 + uGap;
    float t = fract(vD / p) * p;
    bool inDash = t < uDash;
    bool inDot  = t > (uDash + uGap) && t < (uDash + uGap + uDash * 0.22);
    if(!inDash && !inDot) discard;

  } else if(uStyle == 4){                           /* DUAS LINHAS */
    /* dois filetes nas bordas da fita, vão limpo no meio */
    if(across < 0.55) discard;

  } else if(uStyle == 5){                           /* LINHA + GLOW */
    /* núcleo sólido com halo caindo para as bordas — o brilho é o que o
       bloom por limiar captura, então só aqui há semântica de destaque */
    float core = 1.0 - smoothstep(0.0, 0.30, across);
    float halo = 1.0 - smoothstep(0.15, 1.0, across);
    a   = uAlpha * (core + halo * 0.42);
    col = uColor + uColor * core * 0.85;
  }

  if(a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;
