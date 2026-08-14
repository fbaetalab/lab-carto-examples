/* Shaders das representações 3D: paredes de perímetro, volume extrudado e
   borda. São overlays holográficos — não projetam nem recebem sombra
   (decisão 3 do README). */

/* aT = 0 na base, 1 no topo. dist = comprimento acumulado no perímetro,
   o que dá direção ao padrão de fluxo. */
export const WALL_VS = `
attribute float aT;
attribute float dist;
varying float vT; varying float vD; varying float vY;
void main(){ vT=aT; vD=dist; vY=position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export const WALL_FS = `
precision highp float;
varying float vT; varying float vD; varying float vY;
uniform vec3 uCol; uniform float uTime, uSpeed, uGFade; uniform int uAnim, uWStyle;
float hexDist(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
float hexGrid(vec2 p, float s){
  vec2 q = p / s;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 a2 = mod(q, r) - r*0.5;
  vec2 b2 = mod(q - r*0.5, r) - r*0.5;
  vec2 g = dot(a2,a2) < dot(b2,b2) ? a2 : b2;
  return smoothstep(0.40, 0.5, hexDist(g));
}
void main(){
  float a = mix(0.34, 0.05, vT);
  float t = (uAnim == 1) ? uTime * uSpeed : 0.0;
  float glow = 0.0;
  if(uWStyle == 0){                        /* PULSO: varreduras subindo */
    float p = fract(vY/9.0 - t*0.25);
    glow = (smoothstep(0.0,0.05,p) - smoothstep(0.05,0.16,p)) * 0.32;
  } else if(uWStyle == 1){                 /* FLUXO: tracos correndo no perimetro (direcao) */
    float m = fract(vD/22.0 - t*0.5);
    glow = (smoothstep(0.0,0.08,m) - smoothstep(0.42,0.55,m)) * 0.22;
  } else if(uWStyle == 2){                 /* HEX: malha de escudo + varredura grande */
    glow = hexGrid(vec2(vD, vY), 7.0) * 0.26;
    float p = fract(vY/26.0 - t*0.12);
    glow += (smoothstep(0.0,0.10,p) - smoothstep(0.10,0.30,p)) * 0.18;
  } else {                                 /* ENERGIA: interferencia senoidal */
    float n = sin(vD*0.32 + t*2.1) * sin(vY*0.85 - t*1.4)
            + 0.5*sin(vD*0.11 - t*1.3) * sin(vY*0.37 + t*0.8);
    glow = max(n, 0.0) * 0.20;
  }
  a += glow;
  a += smoothstep(0.965, 1.0, vT) * 0.45;  /* fio de luz no topo */
  gl_FragColor = vec4(uCol + glow*0.6, a * uGFade);
}`;

export const VOL_FS = `
precision highp float;
varying float vT; varying float vD; varying float vY;
uniform vec3 uCol; uniform float uGFade, uTime; uniform int uVolAnim;
void main(){
  float a = 0.09 + 0.09*(1.0-vT);
  if(uVolAnim == 1){
    a *= 0.8 + 0.25*sin(uTime*1.1);
    float p = fract(vY/7.0 - uTime*0.18);
    a += (smoothstep(0.0,0.08,p) - smoothstep(0.08,0.2,p)) * 0.05;
  }
  gl_FragColor = vec4(uCol, a * uGFade);
}`;

/* Borda: fita de largura em metros, com dash medido em metros de perímetro. */
export const OUT_VS = `
attribute float dist;
varying float vD;
void main(){ vD = dist; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export const OUT_FS = `
precision highp float;
varying float vD;
uniform vec3 uColor; uniform float uDash; uniform float uAlpha;
void main(){
  if(uDash > 0.0){
    float period = uDash * 1.6;
    if(fract(vD / period) > uDash / period) discard;
  }
  gl_FragColor = vec4(uColor, uAlpha);
}`;
