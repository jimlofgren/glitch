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

const vec3 BEAM = vec3(0.4, 0.9, 1.0);

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float calm = uReducedMotion;
  float g = uGlitchScale;
  float dt = clamp(iTimeDelta, 0.0, 0.1);
  float px = 1.0 / iResolution.y;

  float sweep = fract(iTime * mix(0.06, 0.03, calm) + uBeatCount * 0.37);
  float scanY = 1.0 - sweep;
  if (uPointer.x >= 0.0) scanY = uPointer.y;

  float tau = mix(0.4, 14.0, uSlider);
  float decay = exp(-dt / tau);
  vec4 stored = texture(iChannel1, uv);
  vec3 prev = max(stored.rgb - stored.a * BEAM, 0.0);
  prev = max(prev * decay - 0.0012, 0.0);

  float count = max(uFrameCount, 1.0);
  float layer = mod(uBeatCount, count);
  float width = px * (3.0 + uMid * 12.0);
  float dist = abs(uv.y - scanY);
  float printing = 1.0 - smoothstep(0.0, width, dist);

  vec2 fuv = coverUv(fragCoord);
  float tick = floor(iTime * 12.0);
  float misprint = step(1.0 - uSnap * g * 0.8, hash21(vec2(floor(uv.y / (px * 4.0)), tick)));
  fuv.x += misprint * (hash21(vec2(tick, 2.0)) - 0.5) * 0.3;
  float feed = frameAt(fuv, layer);

  vec3 paper = vec3(0.92, 0.9, 0.84);
  vec3 ink = paper * feed * (0.7 + uBass * 0.5);
  ink = mix(ink, vec3(1.0, 0.25, 0.1) * feed, misprint * 0.8);

  vec3 printed = max(prev, ink * printing);

  float line = 1.0 - smoothstep(0.0, px * 1.5, dist);
  float glow = exp(-dist / (px * 24.0)) * 0.05 * (1.0 + uBass);
  float beam = clamp(line * (0.6 + uTreble * 0.4) + glow, 0.0, 1.0);

  fragColor = vec4(printed + beam * BEAM, beam);
}
