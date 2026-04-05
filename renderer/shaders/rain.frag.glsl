#version 300 es
// "Heartfelt" by Martijn Steinrucken aka BigWings - 2017
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
// Adapted for Peace app: stable rain, no fade-in/zoom/lightning.
// Uniforms uRainAmount, uFogAmount, uRefraction driven by JS control panel.
precision highp float;

uniform float     iTime;
uniform vec3      iResolution;
uniform vec4      iMouse;
uniform sampler2D iChannel0;

// ── Peace rain controls (driven from JS) ──────────────────────────────
uniform float uRainAmount;   // 0.0 = drizzle … 1.0 = downpour   (default 0.6)
uniform float uFogAmount;    // 0.0 = crystal clear … 1.0 = heavy (default 0.3)
uniform float uRefraction;   // 0.0 = no distortion … 1.0 = heavy (default 0.5)

out vec4 fragColor;

#define S(a, b, t) smoothstep(a, b, t)

// ── Noise helpers (original BigWings) ──────────────────────────────────
vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec4 N14(float t) {
  return fract(sin(t * vec4(123., 1024., 1456., 264.)) * vec4(6547., 345., 8799., 1564.));
}

float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
  return S(0., b, t) * S(1., b, t);
}

// ── Drop layer: sliding drops with trails ──────────────────────────────
vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 a = vec2(6., 1.);
  vec2 grid = a * 2.;
  vec2 id = floor(uv * grid);

  float colShift = N(id.x);
  uv.y += colShift;

  id = floor(uv * grid);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(.5, 0);

  float x = n.x - .5;

  float y = UV.y * 20.;
  float wiggle = sin(y + sin(y));
  x += wiggle * (.5 - abs(x)) * (n.z - .5);
  x *= .7;
  float ti = fract(t + n.z);
  y = (Saw(.85, ti) - .5) * .9 + .5;
  vec2 p = vec2(x, y);

  float d = length((st - p) * a.yx);

  float mainDrop = S(.4, .0, d);

  float r = sqrt(S(1., y, st.y));
  float cd = abs(st.x - x);
  float trail = S(.23 * r, .15 * r * r, cd);
  float trailFront = S(-.02, .02, st.y - y);
  trail *= trailFront * r * r;

  y = UV.y;
  float trail2 = S(.2 * r, .0, cd);
  float droplets = max(0., (sin(y * (1. - y) * 120.) - st.y)) * trail2 * trailFront * n.z;
  y = fract(y * 10.) + (st.y - .5);
  float dd = length(st - vec2(x, y));
  droplets = S(.3, 0., dd);
  float m = mainDrop + droplets * r * trailFront;

  return vec2(m, trail);
}

// ── Static drops: small beads clinging to glass ────────────────────────
float StaticDrops(vec2 uv, float t) {
  uv *= 40.;
  vec2 id = floor(uv);
  uv = fract(uv) - .5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - .5) * .7;
  float d = length(uv - p);

  float fade = Saw(.025, fract(t + n.z));
  float c = S(.3, 0., d) * fract(n.z * 10.) * fade;
  return c;
}

// ── Composite all drop layers ──────────────────────────────────────────
vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer2(uv, t) * l1;
  vec2 m2 = DropLayer2(uv * 1.85, t) * l2;

  float c = s + m1.x + m2.x;
  c = S(.3, 1., c);

  return vec2(c, max(m1.y * l0, m2.y * l1));
}

// ═══════════════════════════════════════════════════════════════════════
void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * iResolution.xy) / iResolution.y;
  vec2 UV = gl_FragCoord.xy / iResolution.xy;
  UV.y = 1.0 - UV.y;   // flip Y — WebGL texture coords vs image coords
  float T = iTime;
  float t = T * .2;

  // ── Rain intensity from uniform (stable, no oscillation) ────────────
  float rainAmount = uRainAmount;

  // Layer visibility driven by rain amount
  float staticDrops = S(-.5, 1., rainAmount) * 2.;
  float layer1 = S(.25, .75, rainAmount);
  float layer2 = S(.0, .5, rainAmount);

  // ── Compute rain normal map ─────────────────────────────────────────
  vec2 c = Drops(uv, t, staticDrops, layer1, layer2);

  vec2 e = vec2(.001, 0.);
  float cx = Drops(uv + e, t, staticDrops, layer1, layer2).x;
  float cy = Drops(uv + e.yx, t, staticDrops, layer1, layer2).x;
  vec2 n = vec2(cx - c.x, cy - c.x);

  // ── Refraction strength from uniform ────────────────────────────────
  n *= uRefraction * 2.0;

  // ── Background sampling with fog-driven blur ────────────────────────
  // Base blur is LOW so the background image stays sharp and recognisable.
  // Drops act as tiny lenses → focus goes to 0 (crystal clear) where water is.
  // Fog slider adds blur on top for atmosphere when the user wants it.
  float maxBlur = mix(0.0, 0.6, rainAmount);    // near-zero glass blur (no drop)
  float minBlur = 0.0;                          // crystal sharp through water lens
  float fogBlur = uFogAmount * 6.0;             // user-controlled haze
  float focus = mix(maxBlur, minBlur, S(.1, .2, c.x)) + fogBlur;

  vec3 col = textureLod(iChannel0, UV + n, focus).rgb;

  // ── Specular highlight on drops — visible even on smooth backgrounds ─
  // Simulates light catching on the curved water surface.
  // Larger drops (c.x) get a soft white-blue glint; trails (c.y) get
  // a fainter sheen.  The normal `n` drives a directional highlight.
  float specDot = dot(n, vec2(0.4, 0.8));           // directional bias
  float spec    = pow(max(0.0, specDot * 16.0), 3.0);
  float dropVis = c.x * 0.12 + c.y * 0.04;          // base drop visibility
  col += (dropVis + spec * 0.08) * vec3(0.55, 0.65, 1.0);

  // ── Fog overlay: desaturate + lighten toward a cool fog color ───────
  vec3 fogColor = vec3(0.12, 0.12, 0.18);
  col = mix(col, fogColor, uFogAmount * 0.5);

  // ── Gentle ambient color warmth (very subtle, no flash) ─────────────
  float warmth = sin(T * 0.08) * 0.5 + 0.5;
  col *= mix(vec3(1.0), vec3(0.95, 0.97, 1.05), warmth * 0.15);

  // ── Soft vignette ───────────────────────────────────────────────────
  vec2 vUV = UV - 0.5;
  col *= 1.0 - dot(vUV, vUV) * 0.6;

  fragColor = vec4(col, 1.);
}
