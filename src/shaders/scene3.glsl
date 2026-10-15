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
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rot * p * 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float pixelate = uBeat * uGlitchScale * (1.0 - 0.7 * uReducedMotion);
  float blocks = mix(400.0, 24.0, pixelate);
  uv = floor(uv * blocks) / blocks;
  float speed = mix(1.0, 0.3, uReducedMotion);
  float t = iTime * 0.12 * speed;
  float warp = 2.5 + uMid * 3.0 * mix(1.0, 0.4, uReducedMotion);
  float detail = 1.8 + uTreble * 1.5;

  vec2 q = vec2(
    fbm(uv * detail + t),
    fbm(uv * detail + vec2(5.2, 1.3) - t * 0.7)
  );
  vec2 r = vec2(
    fbm(uv * detail + warp * q + vec2(1.7, 9.2) + t * 0.4),
    fbm(uv * detail + warp * q + vec2(8.3, 2.8) - t * 0.3)
  );
  float f = fbm(uv * detail + warp * r);

  vec3 a = vec3(0.05, 0.08, 0.2);
  vec3 b = vec3(0.9, 0.3, 0.5);
  vec3 c = vec3(0.1, 0.8, 0.7);
  vec3 d = vec3(1.0, 0.85, 0.3);

  vec3 col = mix(a, b, clamp(f * f * 3.0, 0.0, 1.0));
  col = mix(col, c, clamp(length(q) * (0.6 + uTreble), 0.0, 1.0));
  col = mix(col, d, clamp(r.x * r.y * (0.8 + uMid * 2.0), 0.0, 1.0));

  float lum = f * f * (2.0 + uBass) + 0.1;
  col *= lum;
  col *= 1.0 - 0.4 * dot(uv, uv);
  float levels = mix(64.0, 5.0, pixelate);
  col = floor(col * levels) / levels;

  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  gray = smoothstep(0.02, 0.9, gray);
  vec3 mono = vec3(pow(gray, 0.95));
  vec3 colored = pow(col, vec3(0.95));

  fragColor = vec4(mix(mono, colored, uColor), 1.0);
}
