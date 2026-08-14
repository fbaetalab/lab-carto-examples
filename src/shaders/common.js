/* Trechos GLSL compartilhados. Portáveis 1:1 para o HLSL da spec
   (fract→frac, mix→lerp, texture2D→Sample, mat2→float2x2). */

/* Vertex de superfície: leva a posição de mundo para o fragment. */
export const FILL_VS = `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/* Sombra do sol (shadow map manual + PCF 3×3) e fog.
   `cameraPosition` vem do prefixo padrão de fragment do three. */
export const SHADOW_GLSL = `
uniform vec3 uSunDir; uniform vec3 uFogCol;
uniform sampler2D uShadow; uniform mat4 uShadowMat; uniform int uShadowOn;
float shadowAt(vec3 w){
  if(uShadowOn == 0) return 1.0;
  vec4 sp = uShadowMat * vec4(w, 1.0);
  vec3 s = sp.xyz / sp.w * 0.5 + 0.5;
  if(s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  float sh = 0.0;
  for(int i = -1; i <= 1; i++) for(int j = -1; j <= 1; j++){
    float d = texture2D(uShadow, s.xy + vec2(float(i), float(j)) / 2048.0).r;
    sh += step(s.z - 0.0025, d);
  }
  return (sh / 9.0) * 0.72 + 0.28;   /* sombra nunca 100% preta (luz de céu) */
}
float fogAt(vec3 w){ return smoothstep(2200.0, 11000.0, length(w - cameraPosition)); }`;
