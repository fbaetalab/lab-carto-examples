import { PAT_LIB } from './patterns.js';

/* Superfícies do AMBIENTE. Diferente dos overlays, elas são fisicamente
   sombreadas: os shaders abaixo escrevem em csm_DiffuseColor / csm_Roughness /
   csm_Metalness e deixam iluminação, IBL, sombra e fog por conta do
   MeshStandardMaterial do three. */

/* Cores da paleta foram escritas em sRGB. Como agora o albedo entra no
   pipeline linear, converte na entrada. */
const SRGB = `
vec3 sRGBToLinear(vec3 c){ return pow(c, vec3(2.2)); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y);
}`;

/* ---------------- Plano do polígono (overlay, não é ambiente) ---------------- */
export const FILL_VS = `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const FILL_FS = `
precision highp float;
varying vec3 vW;
` + PAT_LIB + `
void main(){
  vec4 c = evalPattern(vW.xz, gl_FragCoord.xy);
  if(c.a < 0.003) discard;
  gl_FragColor = c;
}`;

/* ---------------- Terreno (CSM sobre MeshStandardMaterial) ---------------- */
export const TERRAIN_VS = `
varying vec3 vW;
varying vec3 vWN;
void main(){
  vW  = (modelMatrix * vec4(position, 1.0)).xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  csm_Position = position;
}`;

export const TERRAIN_FS = `
varying vec3 vW;
varying vec3 vWN;
` + SRGB + `
uniform int uContours;

float contourLine(float h, float itv, float w){
  float d  = abs(fract(h/itv + 0.5) - 0.5) * itv;
  float aa = max(fwidth(h), 1e-5);
  return 1.0 - smoothstep(w*aa, (w+1.2)*aa, d);
}

void main(){
  float h = vW.y;

  /* fundo submerso × solo emerso */
  vec3 col = h < 0.0
    ? mix(vec3(0.130,0.150,0.140), vec3(0.070,0.085,0.090), clamp(-h/25.0, 0.0, 1.0))
    : mix(vec3(0.230,0.265,0.195), vec3(0.330,0.330,0.270), clamp(h/32.0, 0.0, 1.0));
  col = sRGBToLinear(col);

  float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
  float rock  = smoothstep(0.22, 0.52, slope) * step(0.0, h);

  /* granulação em três escalas: quebra a leitura de "plano matemático" */
  float g = vnoise(vW.xz * 0.06) * 0.55 + vnoise(vW.xz * 0.31) * 0.30 + vnoise(vW.xz * 1.7) * 0.15;
  col *= 0.86 + 0.28 * g;
  col = mix(col, sRGBToLinear(vec3(0.300,0.300,0.305)) * (0.8 + 0.4*g), rock);

  /* faixa de praia: onde o terreno cruza o nível do mar */
  float beach = (1.0 - smoothstep(0.0, 2.6, abs(h))) * (1.0 - rock);
  col = mix(col, sRGBToLinear(vec3(0.400,0.375,0.320)), beach * 0.55);

  float rough = mix(0.94, 0.99, rock);
  rough = mix(rough, 0.72, beach * 0.5);            /* areia molhada reflete mais */
  rough = mix(rough, 0.55, smoothstep(0.0, -6.0, h)); /* fundo submerso, liso */
  rough *= 0.94 + 0.12 * g;

  if(uContours == 1){
    float minor = contourLine(h, 2.0, 1.0);
    float major = contourLine(h, 10.0, 1.5);
    vec3 cc = h < 0.0 ? vec3(0.36,0.56,0.72) : vec3(0.50,0.69,0.64);
    col = mix(col, sRGBToLinear(cc), minor*0.16 + major*0.34);
  }


  csm_DiffuseColor = vec4(col, 1.0);
  csm_Roughness    = clamp(rough, 0.04, 1.0);
  csm_Metalness    = 0.0;
}`;

/* ---------------- Edifícios (CSM sobre MeshStandardMaterial) ---------------- */
export const BLD_VS = `
varying vec3 vW;
varying vec3 vWN;
void main(){
  vW  = (modelMatrix * vec4(position, 1.0)).xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  csm_Position = position;
}`;

export const BLD_FS = `
varying vec3 vW;
varying vec3 vWN;
` + SRGB + `
void main(){
  vec3 col = sRGBToLinear(vec3(0.400,0.420,0.440));
  float rough = 0.82;
  float metal = 0.0;
  vec3 emis = vec3(0.0);

  if(abs(vWN.y) < 0.5){                        /* fachadas */
    vec2 fuv  = (abs(vWN.x) > 0.5) ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
    vec2 cs   = vec2(3.4, 2.8);
    vec2 cell = floor(fuv / cs);
    vec2 fr   = fract(fuv / cs);
    float win = step(0.22, fr.x)*step(fr.x, 0.82)*step(0.25, fr.y)*step(fr.y, 0.78);
    float lit = step(0.62, hash21(cell));      /* ~38% acesas, estático — sem flicker */

    /* vidro: escuro, liso e levemente metálico; concreto ao redor fica rugoso */
    col   = mix(col, sRGBToLinear(vec3(0.045,0.065,0.085)), win);
    rough = mix(rough, 0.12, win);
    metal = mix(0.0, 0.55, win);

    /* janela acesa vira fonte de luz — é isso que o bloom por limiar captura */
    emis  = sRGBToLinear(vec3(1.00,0.86,0.62)) * win * lit * 1.35;

    /* sujeira/variação vertical no concreto */
    float grime = vnoise(fuv * vec2(0.09, 0.05));
    col *= mix(1.0, 0.80 + 0.30*grime, 1.0 - win);
  } else if(vWN.y > 0.5){
    col *= 1.06;                                /* cobertura */
    rough = 0.90;
  }

  csm_DiffuseColor = vec4(col, 1.0);
  csm_Roughness    = clamp(rough, 0.04, 1.0);
  csm_Metalness    = metal;
  csm_Emissive     = emis;
}`;
