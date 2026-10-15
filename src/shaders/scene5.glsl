const vec2 GRID = vec2(120.0, 49.0);

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
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

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float calm = uReducedMotion;
  float g = uGlitchScale;
  float aspect = iResolution.x / iResolution.y;
  float beat = uBeat * mix(1.0, 0.5, calm);

  vec2 focus = vec2(0.5);
  if (uPointer.x >= 0.0) focus = mix(focus, uPointer, 0.35);
  float zoom = mix(1.0, 2.6, uSlider);
  vec2 uv = coverUv(fragCoord);
  uv = (uv - focus) / zoom + focus;
  uv.x += iTime * 0.003 * (1.0 - calm);

  float count = max(uFrameCount, 1.0);
  float layer = mod(uBeatCount + floor(iTime / 12.0), count);
  float ch = texture(uFrames, vec3(fract(uv), layer)).r;

  vec2 cell = floor(uv * GRID);
  float seed = hash21(cell + layer * 3.0);
  float rate = (0.6 + seed * 2.5) * (1.0 + uTreble * 2.0);
  float twinkle = 0.55 + 0.45 * sin(iTime * rate + seed * 6.2831);
  twinkle = mix(1.0, twinkle, 1.0 - 0.6 * calm);
  float bright = ch * mix(0.6, 1.3, twinkle) * (1.0 + beat * 0.7);
  vec3 starColor = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.9, 0.7), step(0.82, seed));

  float sky = coverUv(fragCoord).y;
  vec3 col = mix(vec3(0.02, 0.03, 0.09), vec3(0.0, 0.0, 0.01), sky);
  col += (hash21(fragCoord + iTime) - 0.5) * 0.01;
  col += starColor * bright;

  vec2 p = (fragCoord / iResolution.xy) * vec2(aspect, 1.0);
  vec2 start = vec2(0.15 + hash21(vec2(uSnapCount, 1.0)) * 0.7, 0.45 + hash21(vec2(uSnapCount, 2.0)) * 0.5) * vec2(aspect, 1.0);
  vec2 dir = normalize(vec2(-0.8 - hash21(vec2(uSnapCount, 3.0)) * 0.4, -0.45));
  float travel = (1.0 - uSnap) * 0.35;
  vec2 head = start + dir * travel;
  float streak = 1.0 - smoothstep(0.0, 0.004, segment(p, head - dir * 0.12, head));
  float tail = 1.0 - smoothstep(0.0, 0.015, segment(p, head - dir * 0.12, head));
  float alive = step(0.03, uSnap) * g * (1.0 - calm);
  col += (streak + tail * 0.25) * uSnap * alive * vec3(0.9, 0.95, 1.0);

  fragColor = vec4(col, 1.0);
}
