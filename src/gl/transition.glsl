float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.1 + vec2(3.7, 1.9);
    amplitude *= 0.5;
  }
  return value;
}

vec3 crossfade(vec2 uv) {
  return mix(texture(iChannel0, uv).rgb, texture(iChannel1, uv).rgb, uMix);
}

vec3 dissolve(vec2 uv) {
  vec2 p = uv * vec2(iResolution.x / iResolution.y, 1.0) * 3.0;
  float n = clamp((fbm(p) - 0.5) * 2.2 + 0.5, 0.0, 1.0);
  float edge = 0.12;
  float threshold = mix(-edge, 1.0 + edge, uMix);
  float m = 1.0 - smoothstep(threshold - edge, threshold + edge, n);
  vec3 col = mix(texture(iChannel0, uv).rgb, texture(iChannel1, uv).rgb, m);
  float rim = (1.0 - abs(m * 2.0 - 1.0)) * (1.0 - uReducedMotion);
  return col + rim * rim * 0.15;
}

vec3 glitch(vec2 uv) {
  float activity = 1.0 - abs(uMix * 2.0 - 1.0);
  float seed = floor(iTime * mix(14.0, 4.0, uReducedMotion)) + uBeatCount * 7.0;
  float rows = mix(8.0, 40.0, hash(vec2(seed, 1.0)));
  float row = floor(uv.y * rows);
  float cols = floor(mix(2.0, 12.0, hash(vec2(seed, row + 2.0))));
  vec2 cell = vec2(floor(uv.x * cols), row);
  float pick = hash(cell + seed * 0.1);
  float shift = (hash(cell + seed + 3.0) - 0.5) * 0.25 * activity * mix(1.0, 0.3, uReducedMotion) * uGlitchScale;
  vec2 shifted = vec2(fract(uv.x + shift), uv.y);
  float split = 0.006 * activity * uGlitchScale;
  vec3 a = vec3(
    texture(iChannel0, shifted + vec2(split, 0.0)).r,
    texture(iChannel0, shifted).g,
    texture(iChannel0, shifted - vec2(split, 0.0)).b
  );
  vec3 b = vec3(
    texture(iChannel1, shifted + vec2(split, 0.0)).r,
    texture(iChannel1, shifted).g,
    texture(iChannel1, shifted - vec2(split, 0.0)).b
  );
  float m = step(pick, uMix);
  vec3 col = mix(a, b, m);
  float flicker = step(0.97, hash(cell + seed + 11.0)) * activity * (1.0 - uReducedMotion) * uGlitchScale;
  col = mix(col, 1.0 - col, flicker * 0.6);
  return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 col;
  if (uMode == 1) {
    col = dissolve(uv);
  } else if (uMode == 2) {
    col = glitch(uv);
  } else {
    col = crossfade(uv);
  }
  fragColor = vec4(col, 1.0);
}
