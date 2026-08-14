/* Biblioteca de padrões — compartilhada entre o shader do plano (fill) e o do
   terreno (drape), para que o mesmo padrão apareça idêntico nas duas
   representações. A fase é ancorada em coordenadas de MUNDO, nunca em UV do
   polígono (decisão 1 do README).

   No modo px/metro (uMode==2) os valores de nível vêm prontos da CPU em uSw /
   uF / uHwW / uArmW / uSymW: um único nível global por frame, com transição
   temporal uniforme. O shader nunca escolhe nível por fragmento (decisão 2). */
export const PAT_LIB = `
uniform int   uPattern;
uniform int   uMode;         /* 0 metros | 1 px tela | 2 px/metro */
uniform float uSpacing, uLw, uSym, uRot;
uniform vec4  uBase, uPat;
uniform sampler2D uTex;
uniform int   uTint;
uniform float uFade;
/* px/metro — pirâmide (valores calculados por frame na CPU): */
uniform float uSw;    /* espaçamento do nível ativo (m) */
uniform float uF;     /* transição temporal 0..1 (uniforme na superfície) */
uniform float uHwW, uArmW, uSymW;  /* meia-espessura / braço / símbolo (m, já com crescimento 2^f) */

mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float lineCov(float x, float s, float hw, float f){
  float n  = floor(x/s + 0.5);
  float d  = abs(x - n*s);
  float aa = max(fwidth(x), 1e-6);
  float c  = 1.0 - smoothstep(hw-aa, hw+aa, d);
  float odd = step(0.5, abs(mod(n, 2.0)));
  return c * mix(1.0, 1.0-f, odd);
}
vec2 cellOf(vec2 p, float s, out vec2 id){
  vec2 q = p/s + 0.5; id = floor(q);
  return (fract(q) - 0.5) * s;
}
float cellFade(vec2 id, float f){
  float odd = max(step(0.5, abs(mod(id.x,2.0))), step(0.5, abs(mod(id.y,2.0))));
  return mix(1.0, 1.0-f, odd);
}
float discCov(float sd, float aa){ return 1.0 - smoothstep(-aa, aa, sd); }
float sdPlus(vec2 c, float arm, float t){
  vec2 a = abs(c);
  return min(max(a.x-arm, a.y-t), max(a.y-arm, a.x-t));
}
float checkerCov(vec2 p, float s){
  vec2 q = p/s; vec2 w = max(fwidth(q), vec2(1e-6));
  vec2 i = 2.0*(abs(fract((q-0.5*w)*0.5)-0.5) - abs(fract((q+0.5*w)*0.5)-0.5))/w;
  return 0.5 - 0.5*i.x*i.y;
}
float meanCov(float s, float hw){
  if(uPattern==1 || uPattern==7) return clamp(2.0*hw/s, 0.0, 1.0);
  if(uPattern==2) return clamp(4.0*hw/s, 0.0, 1.0);
  if(uPattern==3) return clamp(3.14159*hw*hw/(s*s), 0.0, 1.0);
  if(uPattern==4 || uPattern==5) return clamp(2.4*hw/s, 0.0, 1.0);
  if(uPattern==6) return 0.5;
  return 0.3;
}

vec4 evalPattern(vec2 world, vec2 fragPx){
  float ppm = 1.0 / max(length(fwidth(world)), 1e-8);

  vec2 p; float s, hw, symSz, armLen; float f = 0.0;
  if(uMode == 1){
    p = fragPx; s = uSpacing; hw = uLw*0.5; symSz = uSym; armLen = 0.30*uSpacing;
  } else if(uMode == 0){
    p = world; s = uSpacing; hw = uLw*0.5; symSz = uSym; armLen = 0.30*uSpacing;
  } else {
    p = world; s = uSw; f = uF; hw = uHwW; symSz = uSymW; armLen = uArmW;
  }
  p = rot2(-uRot) * p;

  float cov = 0.0; vec3 patRGB = uPat.rgb;
  float aa = max(length(fwidth(p)), 1e-6);

  if(uPattern == 1 || uPattern == 7){ cov = lineCov(p.y, s, hw, f); }
  else if(uPattern == 2){ cov = max(lineCov(p.y, s, hw, f), lineCov(p.x, s, hw, f)); }
  else if(uPattern == 3){ vec2 id; vec2 c = cellOf(p, s, id); cov = discCov(length(c)-hw, aa) * cellFade(id, f); }
  else if(uPattern == 4){ vec2 id; vec2 c = cellOf(p, s, id); cov = discCov(sdPlus(c, armLen, hw), aa) * cellFade(id, f); }
  else if(uPattern == 5){ vec2 id; vec2 c = rot2(0.7853982)*cellOf(p, s, id); cov = discCov(sdPlus(c, armLen, hw), aa) * cellFade(id, f); }
  else if(uPattern == 6){ cov = checkerCov(p, s); }
  else if(uPattern == 8){
    vec2 id; vec2 c = cellOf(p, s, id);
    vec2 uv = c/symSz + 0.5;
    float inside = step(0.0, uv.x)*step(uv.x, 1.0)*step(0.0, uv.y)*step(uv.y, 1.0);
    vec4 t = texture2D(uTex, clamp(uv, 0.0, 1.0)) * inside;
    cov = t.a * cellFade(id, f);
    if(uTint == 0) patRGB = t.a > 0.001 ? t.rgb / max(t.a, 0.001) : patRGB;
  }

  if(uMode == 0 && uPattern != 0){
    float spx = s * ppm;
    cov = mix(cov, meanCov(s, hw), 1.0 - smoothstep(1.5, 3.5, spx));
  }

  vec4 patC = vec4(patRGB, uPat.a * cov);
  float a0  = patC.a + uBase.a * (1.0 - patC.a);
  vec3 rgb  = (patC.rgb*patC.a + uBase.rgb*uBase.a*(1.0-patC.a)) / max(a0, 1e-4);
  return vec4(rgb, a0 * uFade);
}`;
