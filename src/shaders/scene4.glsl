float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 coverUv(vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float screenAspect = iResolution.x / iResolution.y;
  float frameAspect = 16.0 / 9.0;
  if (screenAspect > frameAspect) {
    uv.y = (uv.y - 0.5) * (frameAspect / screenAspect) + 0.5;
  } else {
    uv.x = (uv.x - 0.5) * (screenAspect / frameAspect) + 0.5;
  }
  return uv;
}

float frameAt(vec2 uv, float layer) {
  return texture(uFrames, vec3(fract(uv), layer)).r;
}

mat2 rotate(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float calm = uReducedMotion;
  float g = uGlitchScale;
  float dt = clamp(iTimeDelta, 0.0, 0.1);
  float aspect = iResolution.x / iResolution.y;

  vec2 center = vec2(0.5);
  float pull = 0.0;
  if (uPointer.x >= 0.0) {
    center = uPointer;
    pull = 1.0;
  }
  float flow = (0.25 + uBass * 0.6) * dt * (1.0 - 0.6 * calm);
  float spin = (0.02 + uMid * 0.08) * dt * (1.0 - 0.7 * calm);
  vec2 d = (uv - center) * vec2(aspect, 1.0);
  d = rotate(spin) * d;
  d *= 1.0 + flow * mix(-1.0, 1.0, pull) * 0.5 + flow * 0.5;
  vec2 puv = center + d / vec2(aspect, 1.0);

  float tick = floor(iTime * 15.0);
  float band = floor(uv.y * 40.0);
  float tear = step(1.0 - uSnap * g * 0.25, hash21(vec2(band, tick)));
  puv.x += tear * (hash21(vec2(band, tick + 3.0)) - 0.5) * 0.08;

  float tau = mix(0.25, 5.0, uSlider);
  float decay = exp(-dt / tau);
  vec3 prev = texture(iChannel1, puv).rgb;
  prev = max(prev * decay * vec3(0.985, 0.992, 1.0) - 0.0015, 0.0);

  float count = max(uFrameCount, 1.0);
  float layer = mod(uBeatCount, count);
  float feed = frameAt(coverUv(fragCoord), layer);
  float stamp = 0.18 + uMid * 0.2 + uBeat * g * 0.7 + uBeat * 0.3;
  vec3 ink = vec3(0.85, 0.95, 1.0) * feed * stamp;

  vec3 col = max(prev, ink);

  fragColor = vec4(col, 1.0);
}
