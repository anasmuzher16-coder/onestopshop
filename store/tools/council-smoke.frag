#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t; uniform vec2 src; uniform float mode; uniform float roll; uniform float asp; uniform float gain;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }
float f2(vec2 p){ return 0.5 * n(p) + 0.25 * n(p * 2.03 + vec2(17.3, 9.1)); }            // two octaves
float o3(vec2 p){ return 0.125 * n(p * 4.1209 + vec2(52.419, 27.573)); }                  // the third
float o4(vec2 p){ return 0.0625 * n(p * 8.3654 + vec2(123.711, 65.073)); }                // the fourth
// BANK: thickness of a low body of smoke. xf = where its front is (0..1 across the band), st = 0 arriving .. 1 settled.
float bk(vec2 uv, float xf, float st, float fine){
  // the smoke is carried with the front (0.8 of its travel), the top lagging the bottom a little so it rolls
  vec2 p = vec2((uv.x - xf * 0.8) * asp + 0.5 * uv.y * (1.0 - exp(-roll * 0.8)) - t * 0.035, uv.y - t * 0.012) * 1.45;
  vec2 w = vec2(f2(p * 0.7 + vec2(0.0, t * 0.045)), f2(p * 0.7 + vec2(5.2 - t * 0.035, 1.3)));   // slow swirl
  vec2 q = p + 1.0 * w;
  float d = f2(q); if (fine > 0.5) d += o3(q);
  float s = (xf - uv.x) * asp + (d - 0.5) * 0.9 + (w.y - 0.5) - (1.0 - uv.y) * 0.25;   // band-heights behind the front, with lobes
  float head = 0.95 * smoothstep(-0.12, 0.6, s) * mix(1.0, 0.653, smoothstep(0.6, 2.1, s));   // raised head, lower body behind it
  float rest = (0.56 + (w.x - 0.5) * 0.5 + 0.16 * smoothstep(src.x - 0.36, src.x + 0.09, uv.x)) * smoothstep(-0.2, 0.4, s);   // settled: low, gathered round the hookah
  float top = mix(head, rest, st) + (d - 0.5) * 0.55 + (w.x - 0.4) * 0.3;                                   // the billowing upper surface
  float T = smoothstep(0.0, 0.6, top - uv.y) * mix(0.35, 1.0, smoothstep(0.2, 0.8, w.y + (d - 0.5) * 0.6));
  T += 0.10 * smoothstep(0.3, 0.8, w.x) * smoothstep(-0.1, 0.5, s) * (1.0 - uv.y * 0.5);   // a thin veil above the body
  return T * mix(1.0, 0.9 * mix(0.8, 1.0, smoothstep(0.15, 0.7, uv.x)), st);              // thins as it settles, a little more under the title
}
// PLUME: thickness of one column rising from src. Shape and texture are both functions of (height - rise), so they travel together.
float pl(vec2 uv, float fine){
  vec2 q = vec2((uv.x - src.x) * asp, uv.y - src.y);
  float up = clamp(q.y / (1.0 - src.y), 0.0, 1.0);
  float turb = smoothstep(0.10, 0.35, up);                       // a smooth thread for the first tenth, then it breaks up
  float ph = q.y - t * 0.075;
  vec2 p = vec2(q.x * 4.5, ph * 2.7);
  vec2 w = vec2(f2(p * 0.8 + vec2(0.0, 3.0 + t * 0.03)), f2(p * 0.8 + vec2(5.2, 1.3 - t * 0.02)));
  vec2 g = p + w * turb;
  float d = f2(g); if (fine > 0.5) d += o3(g) + o4(g);
  float sway = (n(vec2(ph * 2.6, 3.1)) - 0.5) * up * (0.3 + 0.7 * turb);
  float width = mix(0.03, 0.2, pow(up, 1.3));
  float x = (q.x - sway - (w.x - 0.5) * 0.5 * turb * up) / width;
  float puff = mix(1.0, smoothstep(0.2, 0.75, n(vec2(ph * 1.5 + 7.0, 7.1))), 0.45 * turb);   // it leaves in slow breaths
  float body = mix(1.0, smoothstep(0.3, 0.7, d), 0.15 + 0.85 * turb);
  float thin = clamp(mix(1.0, 0.18 / width, 0.55), 0.0, 1.0);    // the same smoke over more width
  float fade = smoothstep(0.0, 0.035, q.y) * (1.0 - smoothstep(0.6, 1.0, up));
  float T = exp(-x * x) * body * puff * thin * fade * gain;
  // hookahs only (gain above 1): smoke pooled along the floor of the tile
  T += 1.1 * clamp(gain - 1.0, 0.0, 1.0) * (1.0 - smoothstep(0.0, 0.2 + (w.x - 0.5) * 0.25, uv.y)) * smoothstep(0.25, 0.75, d + (w.y - 0.5) * 0.5 + 0.1);
  return T;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  float T, T2, k, amax;
  if (mode > 0.5) {
    float xf = 1.32 * (1.0 - exp(-roll / (0.6 + 0.1 * asp))) - 0.08;   // fast in, slowing; a wider band takes a little longer (0.94 s time constant on a phone, 1.18 s on a desktop)
    float st = smoothstep(2.0, 6.5, roll);
    T = bk(uv, xf, st, 1.0) * gain; T2 = bk(uv + vec2(0.10 / asp, 0.14), xf, st, 0.0) * gain;   // second sample: a step toward the light, up and right
    k = 2.4; amax = 0.9 * smoothstep(0.0, 0.05, uv.y + 0.03);
  } else {
    T = pl(uv, 1.0); T2 = pl(uv + vec2(0.05 / asp, 0.08), 0.0);
    k = 2.2; amax = 0.8;
  }
  float a = 1.0 - exp(-k * T);                                   // thickness to opacity: never a flat white slab
  float lit = clamp(0.5 + (T - T2) * 3.5, 0.0, 1.0);             // 1 where the smoke thins toward the light: a bright rim
  float kk = clamp(lit + (1.0 - smoothstep(0.3, 1.0, a)) * 0.25, 0.0, 1.0);
  vec3 c = mix(vec3(0.87, 0.80, 0.795), vec3(1.0, 0.985, 0.955), kk);   // shaded core .. warm white edge
  a = clamp(a * amax + (h(gl_FragCoord.xy) - 0.5) / 255.0, 0.0, 1.0) * step(0.004, a);   // one level of fixed grain so the upscale does not band
  gl_FragColor = vec4(c * a, a);                                  // premultiplied
}
